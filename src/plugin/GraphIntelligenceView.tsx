import { StrictMode } from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import { GraphDashboard, ErrorBoundary } from '../ui';
import type { DashboardData, Suggestion, LLMState } from '../ui';
import { parseVault, buildGraph, getOrphans, getTotalLinks, getClusters } from '../core';
import type { Graph } from '../core/types';
import { SemanticCache } from '../semantic/cache';
import { computeEmbedding } from '../semantic/embeddings';
import { findSimilarNotes } from '../semantic/similarity';
import { LLMOrchestrator, LLMSettingsService } from '../llm';
import type { LLMSettings } from '../llm';
import type GraphIntelligencePlugin from '../main';

export const VIEW_TYPE_GRAPH_INTELLIGENCE = 'graph-intelligence-view';

/**
 * Custom Obsidian view that mounts the React-based Graph Intelligence dashboard.
 * Handles full React lifecycle: mount on open, unmount on close.
 *
 * LLM integration:
 *  - Uses LLMOrchestrator for query execution (with AbortController)
 *  - Uses LLMSettingsService for isolated settings persistence
 *  - All LLM calls are async and never block the UI
 *  - Prevents concurrent requests via the orchestrator's cancellation
 */
export class GraphIntelligenceView extends ItemView {
  private root: Root | null = null;
  private semanticCache: SemanticCache;
  private currentDashboardData: DashboardData;

  // ── LLM ──────────────────────────────────────────────────────────
  private plugin: GraphIntelligencePlugin;
  private llmOrchestrator: LLMOrchestrator;
  private llmSettingsService: LLMSettingsService;
  private llmState: LLMState;
  private llmSettings: LLMSettings;

  constructor(leaf: WorkspaceLeaf, plugin: GraphIntelligencePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.semanticCache = new SemanticCache(this.app);
    this.currentDashboardData = GraphIntelligenceView.EMPTY_DATA;

    // LLM initialization
    this.llmOrchestrator = new LLMOrchestrator();
    this.llmSettingsService = new LLMSettingsService({
      load: () => this.plugin.loadData(),
      save: (data) => this.plugin.saveData(data),
    });
    this.llmState = { isQuerying: false, currentInsight: null, error: null };
    this.llmSettings = { ...this.llmSettingsService.get() };
  }

  getViewType(): string {
    return VIEW_TYPE_GRAPH_INTELLIGENCE;
  }

  getDisplayText(): string {
    return 'Graph Intelligence';
  }

  getIcon(): string {
    return 'brain-circuit';
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();

    this.root = createRoot(container);

    // Load LLM settings from disk
    this.llmSettings = await this.llmSettingsService.load();

    // Render loading state
    this.renderDashboard(this.currentDashboardData);

    try {
      // Step 1: Fast structural graph build
      const { data, graph } = await this.computeStructuralData();
      this.currentDashboardData = data;
      this.renderDashboard(this.currentDashboardData);

      // Step 2: Background semantic analysis (non-blocking)
      this.processSemanticDataAsync(graph);
    } catch (err) {
      console.error('[ogi] Failed to compute dashboard data:', err);
    }
  }

  async onClose(): Promise<void> {
    // Cancel any in-flight LLM request
    this.llmOrchestrator.cancelActiveRequest();

    this.root?.unmount();
    this.root = null;
  }

  // ── Structural Pipeline ────────────────────────────────────────────

  private async computeStructuralData(): Promise<{ data: DashboardData, graph: Graph }> {
    const nodes = await parseVault(this.app);
    const graph = buildGraph(nodes);
    
    const orphanNodes = getOrphans(graph);
    const totalLinks = getTotalLinks(graph);
    const rawClusters = getClusters(graph);

    const data = GraphIntelligenceView.mapToDashboardData(graph, orphanNodes, totalLinks, rawClusters);
    return { data, graph };
  }

  // ── Semantic Pipeline (Background) ─────────────────────────────────

  private async processSemanticDataAsync(graph: Graph): Promise<void> {
    await this.semanticCache.load();
    
    const validIds = new Set(graph.nodes.map(n => n.id));
    let cacheChanged = this.semanticCache.cleanup(validIds);
    
    // Prioritize orphans to get embeddings first
    const orphanSet = new Set(this.currentDashboardData.orphans.map(o => o.id));
    const nodesToProcess = [...graph.nodes].sort((a, b) => {
      const aOrphan = orphanSet.has(a.id) ? 1 : 0;
      const bOrphan = orphanSet.has(b.id) ? 1 : 0;
      return bOrphan - aOrphan; // descending: 1 (orphan) comes before 0
    });

    const total = nodesToProcess.length;
    let processedCount = 0;

    this.updateSemanticProgress(true, processedCount, total);

    // Batch process to avoid UI freeze
    const BATCH_SIZE = 5;
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = nodesToProcess.slice(i, i + BATCH_SIZE);
      
      for (const node of batch) {
        const cached = this.semanticCache.get(node.id, node.mtime);
        if (!cached) {
          try {
            const emb = await computeEmbedding(node.contentSnippet);
            this.semanticCache.set(node.id, emb, node.mtime);
            cacheChanged = true;
          } catch(e) {
            console.warn('[ogi] Embedding failed for node', node.id, e);
          }
        }
        processedCount++;
      }
      
      this.updateSemanticProgress(true, processedCount, total);
      
      // Yield control to UI thread
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    if (cacheChanged) {
      await this.semanticCache.save();
    }

    this.updateSemanticProgress(false, total, total);

    // Generate similarity suggestions once embeddings are ready
    this.generateSemanticSuggestions(graph);
  }

  private updateSemanticProgress(isAnalyzing: boolean, processed: number, total: number) {
    this.currentDashboardData = {
      ...this.currentDashboardData,
      semanticProgress: { isAnalyzing, processed, total }
    };
    this.renderDashboard(this.currentDashboardData);
  }

  private generateSemanticSuggestions(graph: Graph) {
    const embeddingsMap = this.semanticCache.getAllValid();
    const suggestions: Suggestion[] = [];
    const seenPairs = new Set<string>();
    let idCounter = 0;

    for (const node of graph.nodes) {
      if (suggestions.length >= 10) break; // Hard limit to avoid spam

      const similar = findSimilarNotes(node.id, embeddingsMap, graph, 0.75, 2);
      
      for (const sim of similar) {
        const pairId = [node.id, sim.targetId].sort().join('|');
        if (seenPairs.has(pairId)) continue;
        seenPairs.add(pairId);

        const targetNode = graph.nodes.find(n => n.id === sim.targetId);
        if (targetNode) {
          suggestions.push({
            id: `sem-sug-${idCounter++}`,
            type: 'link',
            description: `Consider linking "${node.title}" ↔ "${targetNode.title}" (high semantic similarity).`
          });
        }
        
        if (suggestions.length >= 10) break;
      }
    }

    this.currentDashboardData = {
      ...this.currentDashboardData,
      suggestions
    };
    this.renderDashboard(this.currentDashboardData);
  }

  // ── LLM Query Handler ──────────────────────────────────────────────

  /**
   * Handles an AI query from the UI.
   *
   * - Cancels any in-flight request (via orchestrator)
   * - Sets loading state → re-renders
   * - Executes query asynchronously
   * - Sets result or error → re-renders
   *
   * Never blocks the main thread. Only the latest result is rendered.
   */
  private handleLLMQuery = async (query: string): Promise<void> => {
    // Prevent concurrent requests — the orchestrator cancels internally
    if (this.llmState.isQuerying) {
      this.llmOrchestrator.cancelActiveRequest();
    }

    // Set loading state
    this.llmState = { isQuerying: true, currentInsight: null, error: null };
    this.renderDashboard(this.currentDashboardData);

    try {
      const insight = await this.llmOrchestrator.query(
        query,
        this.currentDashboardData,
        this.llmSettings
      );

      // Success — show result
      this.llmState = { isQuerying: false, currentInsight: insight, error: null };
    } catch (err) {
      // Don't show error if it was just a cancellation
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // A new query replaced this one — silently discard
      }

      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.warn('[ogi:llm] Query failed:', message);

      this.llmState = {
        isQuerying: false,
        currentInsight: null,
        error: message,
      };
    }

    this.renderDashboard(this.currentDashboardData);
  };

  // ── LLM Settings Handler ──────────────────────────────────────────

  private handleLLMSettingsChange = async (settings: LLMSettings): Promise<void> => {
    this.llmSettings = settings;
    await this.llmSettingsService.save(settings);
    this.renderDashboard(this.currentDashboardData);
  };

  private handleTestLLMConnection = async (): Promise<boolean> => {
    return this.llmOrchestrator.testConnection(this.llmSettings);
  };

  // ── Mappers & Render ───────────────────────────────────────────────

  private static mapToDashboardData(
    graph: Graph,
    orphanNodes: ReturnType<typeof getOrphans>,
    totalLinks: number,
    rawClusters: string[][],
  ): DashboardData {
    const idToTitle = new Map<string, string>();
    for (const node of graph.nodes) {
      idToTitle.set(node.id, node.title);
    }

    const meaningfulClusters = rawClusters.filter((c) => c.length >= 2);

    return {
      stats: {
        totalNotes: graph.nodes.length,
        totalLinks,
        orphanNotes: orphanNodes.length,
        clusters: meaningfulClusters.length,
      },
      orphans: orphanNodes.map((node) => ({
        id: node.id,
        title: node.title,
      })),
      clusters: meaningfulClusters.map((ids, idx) => ({
        id: `cluster-${idx}`,
        title: idToTitle.get(ids[0]) ?? `Cluster ${idx + 1}`,
        notesCount: ids.length,
        notes: ids.map((id) => idToTitle.get(id) ?? id),
      })),
      suggestions: [],
    };
  }

  private renderDashboard(data: DashboardData): void {
    if (!this.root) return;

    this.root.render(
      <StrictMode>
        <ErrorBoundary>
          <GraphDashboard
            {...data}
            onSearch={(q) => console.log('[ogi:search]', q)}
            onSuggestLinks={(id) => console.log('[ogi:suggest-links]', id)}
            onAcceptSuggestion={(id) => console.log('[ogi:accept]', id)}
            onDismissSuggestion={(id) => console.log('[ogi:dismiss]', id)}
            // LLM integration
            onLLMQuery={this.handleLLMQuery}
            llmState={this.llmState}
            llmSettings={this.llmSettings}
            onLLMSettingsChange={this.handleLLMSettingsChange}
            onTestLLMConnection={this.handleTestLLMConnection}
          />
        </ErrorBoundary>
      </StrictMode>
    );
  }

  private static readonly EMPTY_DATA: DashboardData = {
    stats: { totalNotes: 0, totalLinks: 0, orphanNotes: 0, clusters: 0 },
    orphans: [],
    clusters: [],
    suggestions: [],
  };
}

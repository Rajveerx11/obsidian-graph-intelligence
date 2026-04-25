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
import { detectKnowledgeGaps } from '../gap/gapDetector';
import { LearningEngine } from '../learning/learningEngine';
import { LLMOrchestrator, LLMSettingsService } from '../llm';
import type { LLMSettings, ConnectionTestResult } from '../llm';
import type GraphIntelligencePlugin from '../main';
import { linkNotes, openNotes, createNote, createBridgeNote } from '../actions';
import type { ActionResult } from '../actions';

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
  private learningEngine: LearningEngine;
  private currentDashboardData: DashboardData;

  // Persisted across pipeline phases so gap detection can access them
  private currentGraph: Graph | null = null;
  private currentRawClusters: string[][] = [];
  private currentOrphanNodes: import('../core/types').NoteNode[] = [];

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
    this.learningEngine = new LearningEngine(this.app);
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
    
    // Load learning data
    await this.learningEngine.load();

    // Render loading state
    this.renderDashboard(this.currentDashboardData);

    try {
      // Step 1: Fast structural graph build
      const { data, graph, rawClusters, orphanNodes } = await this.computeStructuralData();
      this.currentDashboardData = data;
      this.currentGraph = graph;
      this.currentRawClusters = rawClusters;
      this.currentOrphanNodes = orphanNodes;
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

  private async computeStructuralData(): Promise<{
    data: DashboardData;
    graph: Graph;
    rawClusters: string[][];
    orphanNodes: import('../core/types').NoteNode[];
  }> {
    const nodes = await parseVault(this.app);
    const graph = buildGraph(nodes);
    
    const orphanNodes = getOrphans(graph);
    const totalLinks = getTotalLinks(graph);
    const rawClusters = getClusters(graph);

    const data = GraphIntelligenceView.mapToDashboardData(graph, orphanNodes, totalLinks, rawClusters);
    return { data, graph, rawClusters, orphanNodes };
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

    // Run gap detection after semantic phase completes
    this.runGapDetection();
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

      const similar = findSimilarNotes(node.id, embeddingsMap, graph, this.learningEngine.getLearningData(), 0.5, 2);
      
      for (const sim of similar) {
        const pairId = [node.id, sim.targetId].sort().join('|');
        if (seenPairs.has(pairId)) continue;
        seenPairs.add(pairId);

        const targetNode = graph.nodes.find(n => n.id === sim.targetId);
        if (targetNode) {
          suggestions.push({
            id: `sem-sug-${idCounter++}`,
            type: 'link',
            description: `Consider linking "${node.title}" ↔ "${targetNode.title}" (high semantic similarity).`,
            sourceNoteId: node.id,
            targetNoteId: targetNode.id,
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

  // ── Gap Detection ─────────────────────────────────────────────────

  /**
   * Runs knowledge gap detection using pre-computed structural and semantic data.
   * Called once after the semantic phase completes — never recomputes embeddings.
   */
  private runGapDetection(): void {
    if (!this.currentGraph) return;

    const embeddingsMap = this.semanticCache.getAllValid();
    if (embeddingsMap.size === 0) return;

    try {
      const knowledgeGaps = detectKnowledgeGaps(
        this.currentGraph,
        this.currentRawClusters,
        this.currentOrphanNodes,
        embeddingsMap,
        this.learningEngine.getLearningData(),
      );

      this.currentDashboardData = {
        ...this.currentDashboardData,
        knowledgeGaps,
      };
      this.renderDashboard(this.currentDashboardData);
    } catch (err) {
      console.warn('[ogi] Gap detection failed:', err);
    }
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

  private handleTestLLMConnection = async (): Promise<ConnectionTestResult> => {
    return this.llmOrchestrator.testConnection(this.llmSettings);
  };

  // ── Action Handlers ───────────────────────────────────────────────

  /**
   * Links two notes by appending a wikilink.
   * After a successful link, triggers a lightweight graph recompute
   * so the dashboard reflects the new connection immediately.
   */
  private handleLinkNotes = async (sourceId: string, targetId: string): Promise<ActionResult> => {
    const result = await linkNotes(this.app, sourceId, targetId);
    if (result.success) {
      await this.learningEngine.recordAction({
        type: 'accept',
        sourceNoteId: sourceId,
        targetNoteId: targetId,
        timestamp: Date.now()
      });
      // Recompute graph to reflect new link
      this.recomputeGraphAsync();
    }
    return result;
  };

  /** Opens one or more notes in the editor. */
  private handleOpenNotes = async (noteIds: string[]): Promise<ActionResult> => {
    return openNotes(this.app, noteIds);
  };

  /** Creates a new standalone note. */
  private handleCreateNote = async (title: string, content?: string): Promise<ActionResult> => {
    const result = await createNote(this.app, title, content);
    if (result.success) {
      this.recomputeGraphAsync();
    }
    return result;
  };

  /** Creates a bridge note linking two concepts. */
  private handleCreateBridgeNote = async (noteAId: string, noteBId: string): Promise<ActionResult> => {
    const result = await createBridgeNote(this.app, noteAId, noteBId);
    if (result.success) {
      await this.learningEngine.recordAction({
        type: 'create_note',
        sourceNoteId: noteAId,
        targetNoteId: noteBId,
        timestamp: Date.now()
      });
      this.recomputeGraphAsync();
    }
    return result;
  };

  /**
   * Lightweight graph recompute after an action modifies the vault.
   * Re-runs the structural pipeline and re-renders the dashboard,
   * but does NOT re-run the full semantic analysis.
   */
  private async recomputeGraphAsync(): Promise<void> {
    try {
      const { data, graph, rawClusters, orphanNodes } = await this.computeStructuralData();
      this.currentGraph = graph;
      this.currentRawClusters = rawClusters;
      this.currentOrphanNodes = orphanNodes;

      // Preserve existing semantic suggestions and gaps — only update structure
      this.currentDashboardData = {
        ...this.currentDashboardData,
        stats: data.stats,
        orphans: data.orphans,
        clusters: data.clusters,
      };
      this.renderDashboard(this.currentDashboardData);
    } catch (err) {
      console.warn('[ogi] Graph recompute after action failed:', err);
    }
  }

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
      knowledgeGaps: [],
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
            onSuggestLinks={async (id) => {
              const node = this.currentGraph?.nodes.find(n => n.id === id);
              if (node) {
                await this.handleLLMQuery(`Analyze the orphaned note "${node.title}" and suggest exactly 3 relevant existing notes from my vault to link it to. Explain why they should be linked.`);
              }
            }}
            onAcceptSuggestion={async (id) => {
              console.log('[ogi:accept]', id);
            }}
            onDismissSuggestion={async (id) => {
              console.log('[ogi:dismiss]', id);
              const suggestion = this.currentDashboardData.suggestions?.find(s => s.id === id);
              if (suggestion) {
                await this.learningEngine.recordAction({
                  type: 'ignore',
                  sourceNoteId: suggestion.sourceNoteId,
                  targetNoteId: suggestion.targetNoteId,
                  timestamp: Date.now()
                });
                
                // Remove suggestion from UI
                this.currentDashboardData = {
                  ...this.currentDashboardData,
                  suggestions: this.currentDashboardData.suggestions.filter(s => s.id !== id)
                };
                this.renderDashboard(this.currentDashboardData);
              }
            }}
            // LLM integration
            onLLMQuery={this.handleLLMQuery}
            llmState={this.llmState}
            llmSettings={this.llmSettings}
            onLLMSettingsChange={this.handleLLMSettingsChange}
            onTestLLMConnection={this.handleTestLLMConnection}
            // Action layer
            onLinkNotes={this.handleLinkNotes}
            onOpenNotes={this.handleOpenNotes}
            onCreateNote={this.handleCreateNote}
            onCreateBridgeNote={this.handleCreateBridgeNote}
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
    knowledgeGaps: [],
  };
}

import { StrictMode } from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import { GraphDashboard, ErrorBoundary } from '../ui';
import type { DashboardData, Suggestion, LLMState } from '../ui';
import { parseVault, buildGraph, getOrphans, getTotalLinks, getClusters } from '../core';
import type { Graph, NoteNode } from '../core/types';
import { SemanticCache } from '../semantic/cache';
import { computeEmbedding } from '../semantic/embeddings';
import { findSimilarNotes } from '../semantic/similarity';
import { detectKnowledgeGaps } from '../gap/gapDetector';
import { LearningEngine } from '../learning/learningEngine';
import { LLMOrchestrator, LLMSettingsService } from '../llm';
import type { LLMSettings, ConnectionTestResult } from '../llm';
import { sanitizeForPrompt } from '../llm/prompts';
import type GraphIntelligencePlugin from '../main';
import { linkNotes, openNotes, createNote, createBridgeNote, reconnectNotesToGraphContext } from '../actions';
import type { ActionResult } from '../actions';
import { generateFixPlan } from '../fix/fixEngine';
import type { FixBatchItemResult, FixBatchResult, FixItem } from '../fix/fixTypes';
import { IngestionCache, ingestAll, entityToNoteNode } from '../ingestion';
import type { IngestionResult } from '../ingestion';
import { createExplicitEdge, mergeEdges, type ConfidenceEdge } from '../graph';
import { exportGraph, type ExportFormat } from '../export';
import { getMCPServer, type MCPConfig, type MCPRequest, type MCPResponse } from '../mcp';
import { ContextService, DEFAULT_COMPRESSION_CONFIG, type CompressionLevel } from '../context';

export const VIEW_TYPE_GRAPH_INTELLIGENCE = 'graph-intelligence-view';

export class GraphIntelligenceView extends ItemView {
  private root: Root | null = null;
  private semanticCache: SemanticCache;
  private learningEngine: LearningEngine;
  private currentDashboardData: DashboardData;

  private currentGraph: Graph | null = null;
  private currentRawClusters: string[][] = [];
  private currentOrphanNodes: NoteNode[] = [];
  private semanticRunId = 0;

  private plugin: GraphIntelligencePlugin;
  private llmOrchestrator: LLMOrchestrator;
  private llmSettingsService: LLMSettingsService;
  private llmState: LLMState;
  private llmSettings: LLMSettings;
  private ingestionCache: IngestionCache;
  private confidenceEdges: ConfidenceEdge[] = [];
  private mcpConfig: MCPConfig = { enabled: false, maxResponseTokens: 4000, enabledTools: [], rateLimitPerMinute: 60, requireConfirmation: true };
  private contextService: ContextService;

  constructor(leaf: WorkspaceLeaf, plugin: GraphIntelligencePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.semanticCache = new SemanticCache(this.app);
    this.learningEngine = new LearningEngine(this.app);
    this.currentDashboardData = GraphIntelligenceView.EMPTY_DATA;

    this.llmOrchestrator = new LLMOrchestrator();
    this.llmSettingsService = new LLMSettingsService({
      load: () => this.plugin.loadData(),
      save: (data) => this.plugin.saveData(data),
    });
    this.llmState = { isQuerying: false, currentInsight: null, error: null };
    this.llmSettings = { ...this.llmSettingsService.get() };

    this.ingestionCache = new IngestionCache(this.app);
    this.contextService = new ContextService(this.app);
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

    this.llmSettings = await this.llmSettingsService.load();

    await this.learningEngine.load();

    this.renderDashboard(this.currentDashboardData);

    try {
      await this.ingestionCache.load();
      await this.semanticCache.load();
      await this.learningEngine.load();

      const { data, graph, rawClusters, orphanNodes } = await this.computeStructuralData();
      this.currentDashboardData = data;
      this.currentGraph = graph;
      this.currentRawClusters = rawClusters;
      this.currentOrphanNodes = orphanNodes;
      this.updateConfidenceEdges(graph);
      this.renderDashboard(this.currentDashboardData);

      void this.processIngestionAsync();
      void this.processSemanticDataAsync(graph);
      this.updateMCPContext();
    } catch (err) {
      console.error('[ogi] Failed to compute dashboard data:', err);
    }
  }

  async onClose(): Promise<void> {
    this.llmOrchestrator.cancelActiveRequest();

    this.root?.unmount();
    this.root = null;
  }

  private async computeStructuralData(): Promise<{
    data: DashboardData;
    graph: Graph;
    rawClusters: string[][];
    orphanNodes: NoteNode[];
  }> {
    const nodes = await parseVault(this.app);
    const graph = buildGraph(nodes);

    const orphanNodes = getOrphans(graph);
    const totalLinks = getTotalLinks(graph);
    const rawClusters = getClusters(graph);

    const data = GraphIntelligenceView.mapToDashboardData(graph, orphanNodes, totalLinks, rawClusters);
    return { data, graph, rawClusters, orphanNodes };
  }

  private updateConfidenceEdges(graph: Graph): void {
    this.confidenceEdges = mergeEdges(
      graph.edges.map(edge => createExplicitEdge(edge.source, edge.target))
    );
  }

  private async processSemanticDataAsync(graph: Graph): Promise<void> {
    const runId = ++this.semanticRunId;
    await this.semanticCache.load();

    const validIds = new Set(graph.nodes.map(n => n.id));
    let cacheChanged = this.semanticCache.cleanup(validIds);

    const orphanSet = new Set(this.currentDashboardData.orphans.map(o => o.id));
    const nodesToProcess = [...graph.nodes].sort((a, b) => {
      const aOrphan = orphanSet.has(a.id) ? 1 : 0;
      const bOrphan = orphanSet.has(b.id) ? 1 : 0;
      return bOrphan - aOrphan;
    });

    const total = nodesToProcess.length;
    let processedCount = 0;

    if (runId !== this.semanticRunId) return;
    this.updateSemanticProgress(true, processedCount, total);

    const BATCH_SIZE = 5;
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = nodesToProcess.slice(i, i + BATCH_SIZE);

      for (const node of batch) {
        if (runId !== this.semanticRunId) return;
        const cached = this.semanticCache.get(node.id, node.mtime);
        if (!cached) {
          try {
            const emb = await computeEmbedding(node.contentSnippet);
            this.semanticCache.set(node.id, emb, node.mtime);
            cacheChanged = true;
          } catch (e) {
            console.warn('[ogi] Embedding failed for node', node.id, e);
          }
        }
        processedCount++;
      }

      if (runId !== this.semanticRunId) return;
      this.updateSemanticProgress(true, processedCount, total);

      await new Promise(resolve => setTimeout(resolve, 20));
    }

    if (cacheChanged) {
      await this.semanticCache.save();
    }

    if (runId !== this.semanticRunId) return;
    this.updateSemanticProgress(false, total, total);

    this.generateSemanticSuggestions(graph);

    this.runGapDetection();
    this.updateMCPContext();
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
      if (suggestions.length >= 10) break;

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
            description: `Consider linking "${node.title}" <-> "${targetNode.title}" (high semantic similarity).`,
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

  private handleLLMQuery = async (query: string): Promise<void> => {

    if (this.llmState.isQuerying) {
      this.llmOrchestrator.cancelActiveRequest();
    }

    this.llmState = { isQuerying: true, currentInsight: null, error: null };
    this.renderDashboard(this.currentDashboardData);

    try {
      const insight = await this.llmOrchestrator.query(
        query,
        this.currentDashboardData,
        this.llmSettings
      );

      this.llmState = { isQuerying: false, currentInsight: insight, error: null };
    } catch (err) {

      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
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

  private handleLLMSettingsChange = async (settings: LLMSettings): Promise<void> => {
    this.llmSettings = settings;
    await this.llmSettingsService.save(settings);
    this.renderDashboard(this.currentDashboardData);
  };

  private handleTestLLMConnection = async (): Promise<ConnectionTestResult> => {
    return this.llmOrchestrator.testConnection(this.llmSettings);
  };

  private handleLinkNotes = async (sourceId: string, targetId: string): Promise<ActionResult> => {
    const result = await linkNotes(this.app, sourceId, targetId);
    if (result.success) {
      await this.learningEngine.recordAction({
        type: 'accept',
        sourceNoteId: sourceId,
        targetNoteId: targetId,
        timestamp: Date.now()
      });

      await this.recomputeGraphAsync();
    }
    return result;
  };

  private handleOpenNotes = async (noteIds: string[]): Promise<ActionResult> => {
    return openNotes(this.app, noteIds);
  };

  private handleCreateNote = async (title: string, content?: string): Promise<ActionResult> => {
    const result = await createNote(this.app, title, content);
    if (result.success) {
      await this.recomputeGraphAsync();
    }
    return result;
  };

  private handleCreateBridgeNote = async (noteAId: string, noteBId: string): Promise<ActionResult> => {
    const result = await createBridgeNote(this.app, noteAId, noteBId);
    if (result.success) {
      await this.learningEngine.recordAction({
        type: 'create_note',
        sourceNoteId: noteAId,
        targetNoteId: noteBId,
        timestamp: Date.now()
      });
      await this.recomputeGraphAsync();
    }
    return result;
  };

  private handleApplyFixPlan = async (requestedFixes: FixItem[]): Promise<FixBatchResult> => {
    const results: FixBatchItemResult[] = [];

    try {
      await this.refreshAnalysis(true);
      const latestFixes = generateFixPlan(this.currentDashboardData);
      const fixesToApply = this.mergeFixPlans(requestedFixes, latestFixes);
      const contextFixes: FixItem[] = [];
      const contextNoteIds = new Set<string>();

      for (const fix of fixesToApply) {
        if (fix.action.actionType === 'link') {
          const sourceId = fix.action.payload.sourceId;
          const targetId = fix.action.payload.targetId;

          if (!sourceId || !targetId) {
            results.push({ fixId: fix.id, success: false, message: 'Missing source or target note for link repair.' });
            continue;
          }

          const result = await linkNotes(this.app, sourceId, targetId);
          results.push({ fixId: fix.id, success: result.success, message: result.message });

          if (result.success) {
            await this.learningEngine.recordAction({
              type: 'accept',
              sourceNoteId: sourceId,
              targetNoteId: targetId,
              timestamp: Date.now()
            });
          }
          continue;
        }

        if (fix.action.actionType === 'create_note') {
          const sourceId = fix.action.payload.sourceId;
          const targetId = fix.action.payload.targetId;

          if (!sourceId || !targetId) {
            results.push({ fixId: fix.id, success: false, message: 'Missing source or target note for bridge-note repair.' });
            continue;
          }

          const result = await createBridgeNote(this.app, sourceId, targetId, { open: false });
          results.push({ fixId: fix.id, success: result.success, message: result.message });

          if (result.success) {
            await this.learningEngine.recordAction({
              type: 'create_note',
              sourceNoteId: sourceId,
              targetNoteId: targetId,
              timestamp: Date.now()
            });
          }
          continue;
        }

        const noteIds = fix.action.payload.noteIds ?? [];
        if (noteIds.length === 0) {
          results.push({ fixId: fix.id, success: false, message: 'No note was available for context reconnection.' });
          continue;
        }

        contextFixes.push(fix);
        noteIds.forEach((noteId) => contextNoteIds.add(noteId));
      }

      if (contextNoteIds.size > 0) {
        const result = await reconnectNotesToGraphContext(this.app, [...contextNoteIds]);
        for (const fix of contextFixes) {
          results.push({ fixId: fix.id, success: result.success, message: result.message });
        }

        if (result.success) {
          await this.learningEngine.recordAction({
            type: 'accept',
            noteIds: [...contextNoteIds],
            timestamp: Date.now()
          });
        }
      }

      await this.refreshAnalysis(true);

      const successful = results.filter((result) => result.success).length;
      return {
        success: successful > 0,
        message: `Applied ${successful} of ${results.length} vault repairs.`,
        results,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[ogi] Apply All failed:', err);
      return {
        success: false,
        message: `Apply All failed: ${message}`,
        results: requestedFixes.map((fix) => ({ fixId: fix.id, success: false, message })),
      };
    }
  };

  private handleAcceptSuggestion = async (id: string): Promise<void> => {
    const suggestion = this.currentDashboardData.suggestions.find(s => s.id === id);
    if (!suggestion) return;

    if (suggestion.sourceNoteId && suggestion.targetNoteId) {
      const result = await this.handleLinkNotes(suggestion.sourceNoteId, suggestion.targetNoteId);
      if (!result.success) return;
    } else {
      await this.learningEngine.recordAction({
        type: 'accept',
        sourceNoteId: suggestion.sourceNoteId,
        targetNoteId: suggestion.targetNoteId,
        timestamp: Date.now()
      });
    }

    this.currentDashboardData = {
      ...this.currentDashboardData,
      suggestions: this.currentDashboardData.suggestions.filter(s => s.id !== id)
    };
    this.renderDashboard(this.currentDashboardData);
  };

  private mergeFixPlans(primary: FixItem[], secondary: FixItem[]): FixItem[] {
    const merged: FixItem[] = [];
    const seen = new Set<string>();

    for (const fix of [...primary, ...secondary]) {
      const key = this.getFixDedupeKey(fix);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(fix);
    }

    return merged;
  }

  private getFixDedupeKey(fix: FixItem): string {
    const payload = fix.action.payload;
    const noteIds = payload.noteIds?.slice().sort().join('|') ?? '';
    return [
      fix.action.actionType,
      payload.sourceId ?? '',
      payload.targetId ?? '',
      noteIds,
    ].join(':');
  }

  private async refreshAnalysis(includeSemantic: boolean): Promise<void> {
    const { data, graph, rawClusters, orphanNodes } = await this.computeStructuralData();
    this.currentDashboardData = {
      ...data,
      semanticProgress: this.currentDashboardData.semanticProgress,
    };
    this.currentGraph = graph;
    this.currentRawClusters = rawClusters;
    this.currentOrphanNodes = orphanNodes;
    this.updateConfidenceEdges(graph);
    this.renderDashboard(this.currentDashboardData);

    if (includeSemantic) {
      await this.processSemanticDataAsync(graph);
      return;
    }

    this.generateSemanticSuggestions(graph);
    this.runGapDetection();
    this.updateMCPContext();
  }

  private async recomputeGraphAsync(): Promise<void> {
    try {
      const { data, graph, rawClusters, orphanNodes } = await this.computeStructuralData();
      this.currentGraph = graph;
      this.currentRawClusters = rawClusters;
      this.currentOrphanNodes = orphanNodes;
      this.updateConfidenceEdges(graph);

      this.currentDashboardData = {
        ...this.currentDashboardData,
        stats: data.stats,
        orphans: data.orphans,
        clusters: data.clusters,
        suggestions: [],
        knowledgeGaps: [],
      };
      this.renderDashboard(this.currentDashboardData);
      this.generateSemanticSuggestions(graph);
      this.runGapDetection();
      this.updateMCPContext();
    } catch (err) {
      console.warn('[ogi] Graph recompute after action failed:', err);
    }
  }


  private async processIngestionAsync(): Promise<void> {
    try {
      const result = await ingestAll(
        this.app,
        this.ingestionCache,
        { maxFileSizeMB: 50, batchSize: 3, batchDelayMs: 200, lazyProcessing: true },
        undefined
      );

      if (result.total > 0) {
        await this.ingestionCache.save();
        if (result.pdfs.length > 0 || result.images.length > 0 || result.youtube.length > 0) {
          await this.integrateIngestedContent(result);
        }
      }
    } catch (err) {
      console.warn('[ogi] Ingestion failed:', err);
    }
  }

  private async integrateIngestedContent(result: IngestionResult): Promise<void> {
    if (!this.currentGraph) return;

    const newNodes = [
      ...result.pdfs,
      ...result.images,
      ...result.youtube,
    ].map(entityToNoteNode);

    this.currentGraph.nodes.push(...newNodes);

    for (const node of newNodes) {
      const cached = this.semanticCache.get(node.id, node.mtime);
      if (!cached) {
        try {
          const emb = await computeEmbedding(node.contentSnippet);
          this.semanticCache.set(node.id, emb, node.mtime);
        } catch (e) {
          console.warn('[ogi] Embedding failed for ingested node', node.id, e);
        }
      }
    }

    await this.semanticCache.save();
    await this.recomputeGraphAsync();
  }


  private updateMCPContext(): void {
    if (!this.currentGraph || !this.mcpConfig.enabled) return;

    const server = getMCPServer(this.mcpConfig);
    server.setContext({
      app: this.app,
      nodes: this.currentGraph.nodes,
      edges: this.confidenceEdges,
      clusters: this.currentRawClusters,
      orphans: this.currentOrphanNodes,
      gaps: this.currentDashboardData.knowledgeGaps,
      embeddings: this.semanticCache.getAllValid(),
    });
  }

  public async processMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    const server = getMCPServer(this.mcpConfig);
    return server.processRequest(request);
  }

  public updateMCPConfiguration(config: MCPConfig): void {
    this.mcpConfig = config;
    const server = getMCPServer(this.mcpConfig);
    server.updateConfig(config);
    if (config.enabled) {
      this.updateMCPContext();
    }
  }


  public async exportGraphData(format: ExportFormat): Promise<{ success: boolean; filename?: string; error?: string }> {
    if (!this.currentGraph) {
      return { success: false, error: 'No graph data available' };
    }

    const result = await exportGraph(
      this.app,
      this.currentGraph.nodes,
      this.confidenceEdges,
      this.currentRawClusters,
      this.currentOrphanNodes,
      this.currentDashboardData.knowledgeGaps,
      { format, includeOrphans: true, includeGaps: true }
    );

    return {
      success: result.success,
      filename: result.filename,
      error: result.error,
    };
  }


  public async generateContextPack(level: CompressionLevel): Promise<{ success: boolean; content?: string; tokens?: number; error?: string }> {
    if (!this.currentGraph) {
      return { success: false, error: 'No graph data available' };
    }

    this.contextService.updateConfig({
      ...DEFAULT_COMPRESSION_CONFIG,
      level,
    });

    const result = this.contextService.generateConstrainedContext(
      this.currentGraph.nodes,
      this.confidenceEdges,
      this.currentRawClusters,
      this.currentOrphanNodes,
      this.currentDashboardData.knowledgeGaps,
      undefined
    );

    if (!result.success || !result.pack) {
      return { success: false, error: result.error || 'Failed to generate context' };
    }

    return {
      success: true,
      content: result.pack.content,
      tokens: result.pack.metadata.totalTokens,
    };
  }

  public async copyContextToClipboard(level: CompressionLevel = 'medium'): Promise<boolean> {
    const result = await this.generateContextPack(level);
    if (!result.success || !result.content) return false;

    try {
      await navigator.clipboard.writeText(result.content);
      return true;
    } catch (err) {
      console.error('[ogi] Failed to copy context to clipboard:', err);
      return false;
    }
  }


  private static mapToDashboardData(
    graph: Graph,
    orphanNodes: NoteNode[],
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
            onSearch={() => undefined}
            onSuggestLinks={async (id) => {
              const node = this.currentGraph?.nodes.find(n => n.id === id);
              if (node) {
                const safeTitle = sanitizeForPrompt(node.title);
                await this.handleLLMQuery(`Analyze the orphaned note "${safeTitle}" and suggest exactly 3 relevant existing notes from my vault to link it to. Explain why they should be linked.`);
              }
            }}
            onAcceptSuggestion={this.handleAcceptSuggestion}
            onDismissSuggestion={async (id) => {
              const suggestion = this.currentDashboardData.suggestions?.find(s => s.id === id);
              if (suggestion) {
                await this.learningEngine.recordAction({
                  type: 'ignore',
                  sourceNoteId: suggestion.sourceNoteId,
                  targetNoteId: suggestion.targetNoteId,
                  timestamp: Date.now()
                });

                this.currentDashboardData = {
                  ...this.currentDashboardData,
                  suggestions: this.currentDashboardData.suggestions.filter(s => s.id !== id)
                };
                this.renderDashboard(this.currentDashboardData);
              }
            }}

            onLLMQuery={this.handleLLMQuery}
            llmState={this.llmState}
            llmSettings={this.llmSettings}
            onLLMSettingsChange={this.handleLLMSettingsChange}
            onTestLLMConnection={this.handleTestLLMConnection}

            onLinkNotes={this.handleLinkNotes}
            onOpenNotes={this.handleOpenNotes}
            onCreateNote={this.handleCreateNote}
            onCreateBridgeNote={this.handleCreateBridgeNote}
            onApplyFixPlan={this.handleApplyFixPlan}
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

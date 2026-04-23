import { StrictMode } from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import { GraphDashboard, ErrorBoundary } from '../ui';
import type { DashboardData } from '../ui';
import { parseVault, buildGraph, getOrphans, getTotalLinks, getClusters } from '../core';
import type { Graph } from '../core';

export const VIEW_TYPE_GRAPH_INTELLIGENCE = 'graph-intelligence-view';

/**
 * Custom Obsidian view that mounts the React-based Graph Intelligence dashboard.
 * Handles full React lifecycle: mount on open, unmount on close.
 *
 * On open, it reads the vault, builds a graph, computes insights,
 * and passes real data to the React UI.
 */
export class GraphIntelligenceView extends ItemView {
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
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

    // Render a loading state first so the UI isn't blank while parsing.
    this.renderDashboard(GraphIntelligenceView.EMPTY_DATA);

    // Build graph data asynchronously without blocking the UI thread.
    try {
      const data = await this.computeDashboardData();
      this.renderDashboard(data);
    } catch (err) {
      console.error('[ogi] Failed to compute dashboard data:', err);
      // On error, leave the empty/zero state visible rather than crashing.
    }
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }

  // ── Data pipeline ──────────────────────────────────────────────────

  /**
   * Runs the full parse → build → query pipeline and maps results
   * into the DashboardData shape expected by the React UI.
   */
  private async computeDashboardData(): Promise<DashboardData> {
    // Step 1: Parse vault files into NoteNodes
    const nodes = await parseVault(this.app);

    // Step 2: Build graph (nodes + edges)
    const graph = buildGraph(nodes);

    // Step 3: Run queries
    const orphanNodes = getOrphans(graph);
    const totalLinks = getTotalLinks(graph);
    const rawClusters = getClusters(graph);

    // Step 4: Map to UI data contract
    return GraphIntelligenceView.mapToDashboardData(graph, orphanNodes, totalLinks, rawClusters);
  }

  /**
   * Maps core engine output into the DashboardData shape consumed by React.
   *
   * Cluster naming: uses the title of the first node in each component as
   * the cluster label, providing a recognisable name without AI.
   */
  private static mapToDashboardData(
    graph: Graph,
    orphanNodes: ReturnType<typeof getOrphans>,
    totalLinks: number,
    rawClusters: string[][],
  ): DashboardData {
    // Build a quick id→title lookup for cluster note names.
    const idToTitle = new Map<string, string>();
    for (const node of graph.nodes) {
      idToTitle.set(node.id, node.title);
    }

    // Only report clusters with 2+ notes (single-node clusters are orphans).
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
      // Suggestions require heuristic/AI analysis — left empty for now
      // as the spec explicitly forbids LLMs and external APIs.
      suggestions: [],
    };
  }

  // ── Rendering ──────────────────────────────────────────────────────

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
          />
        </ErrorBoundary>
      </StrictMode>
    );
  }

  /** Zero-state data used while the vault is being parsed. */
  private static readonly EMPTY_DATA: DashboardData = {
    stats: { totalNotes: 0, totalLinks: 0, orphanNotes: 0, clusters: 0 },
    orphans: [],
    clusters: [],
    suggestions: [],
  };
}

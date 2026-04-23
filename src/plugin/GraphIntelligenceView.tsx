import { StrictMode } from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import { GraphDashboard, ErrorBoundary } from '../ui';
import type { DashboardData } from '../ui';

export const VIEW_TYPE_GRAPH_INTELLIGENCE = 'graph-intelligence-view';

/** Placeholder data — will be replaced by core engine output in the next phase. */
const PLACEHOLDER_DATA: DashboardData = {
  stats: { totalNotes: 0, totalLinks: 0, orphanNotes: 0, clusters: 0 },
  orphans: [],
  clusters: [],
  suggestions: [],
};

/**
 * Custom Obsidian view that mounts the React-based Graph Intelligence dashboard.
 * Handles full React lifecycle: mount on open, unmount on close.
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
    this.root.render(
      <StrictMode>
        <ErrorBoundary>
          <GraphDashboard
            {...PLACEHOLDER_DATA}
            onSearch={(q) => console.log('[ogi:search]', q)}
            onSuggestLinks={(id) => console.log('[ogi:suggest-links]', id)}
            onAcceptSuggestion={(id) => console.log('[ogi:accept]', id)}
            onDismissSuggestion={(id) => console.log('[ogi:dismiss]', id)}
          />
        </ErrorBoundary>
      </StrictMode>
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}

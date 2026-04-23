import { Plugin, WorkspaceLeaf } from 'obsidian';
import { GraphIntelligenceView, VIEW_TYPE_GRAPH_INTELLIGENCE } from './plugin';

export default class GraphIntelligencePlugin extends Plugin {
  async onload(): Promise<void> {
    // Register the custom React view
    this.registerView(
      VIEW_TYPE_GRAPH_INTELLIGENCE,
      (leaf: WorkspaceLeaf) => new GraphIntelligenceView(leaf)
    );

    // Add ribbon icon to open the dashboard
    this.addRibbonIcon('brain-circuit', 'Open Graph Intelligence', () => {
      this.activateView();
    });

    // Add command palette entry
    this.addCommand({
      id: 'open-graph-intelligence-dashboard',
      name: 'Open Graph Intelligence Dashboard',
      callback: () => this.activateView(),
    });
  }

  async onunload(): Promise<void> {
    // Obsidian automatically cleans up registered views
  }

  /** Opens the Graph Intelligence panel in the right sidebar, or reveals it if already open. */
  private async activateView(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_GRAPH_INTELLIGENCE);

    if (leaves.length > 0) {
      workspace.revealLeaf(leaves[0]);
      return;
    }

    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: VIEW_TYPE_GRAPH_INTELLIGENCE,
        active: true,
      });
      workspace.revealLeaf(leaf);
    }
  }
}

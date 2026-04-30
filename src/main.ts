import { Plugin, WorkspaceLeaf } from 'obsidian';
import { GraphIntelligenceView, VIEW_TYPE_GRAPH_INTELLIGENCE } from './plugin';

export default class GraphIntelligencePlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(
      VIEW_TYPE_GRAPH_INTELLIGENCE,
      (leaf: WorkspaceLeaf) => new GraphIntelligenceView(leaf, this)
    );

    this.addRibbonIcon('brain-circuit', 'Open Graph Intelligence', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-graph-intelligence-dashboard',
      name: 'Open Graph Intelligence Dashboard',
      callback: () => this.activateView(),
    });
  }

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

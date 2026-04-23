import { GraphDashboard } from './ui';
import type { VaultStats, OrphanNote, Cluster, Suggestion } from './ui';

/**
 * Placeholder data for development preview.
 * In the Obsidian plugin, this data will come from the core graph engine.
 */
const PLACEHOLDER_STATS: VaultStats = {
  totalNotes: 0,
  totalLinks: 0,
  orphanNotes: 0,
  clusters: 0,
};

const PLACEHOLDER_ORPHANS: OrphanNote[] = [];
const PLACEHOLDER_CLUSTERS: Cluster[] = [];
const PLACEHOLDER_SUGGESTIONS: Suggestion[] = [];

export default function App() {
  return (
    <GraphDashboard
      stats={PLACEHOLDER_STATS}
      orphans={PLACEHOLDER_ORPHANS}
      clusters={PLACEHOLDER_CLUSTERS}
      suggestions={PLACEHOLDER_SUGGESTIONS}
      onSearch={(query) => console.log('[search]', query)}
      onSuggestLinks={(id) => console.log('[suggest-links]', id)}
      onAcceptSuggestion={(id) => console.log('[accept]', id)}
      onDismissSuggestion={(id) => console.log('[dismiss]', id)}
    />
  );
}

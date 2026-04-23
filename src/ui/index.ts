/**
 * Barrel export for all UI components.
 * Import from 'src/ui' to access any component or type.
 */

// ── Components ─────────────────────────────────────────────────────────────
export { GraphDashboard } from './GraphDashboard';
export { StatsOverview } from './StatsOverview';
export { SearchBar } from './SearchBar';
export { OrphanNotesList } from './OrphanNotesList';
export { ClusterList } from './ClusterList';
export { SuggestionsPanel } from './SuggestionsPanel';

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  VaultStats,
  OrphanNote,
  Cluster,
  Suggestion,
  SuggestionType,
  GraphDashboardProps,
  StatsOverviewProps,
  SearchBarProps,
  OrphanNotesListProps,
  ClusterListProps,
  SuggestionsPanelProps,
  StatItemProps,
} from './types';

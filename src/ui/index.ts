/**
 * Barrel export for all UI components and types.
 */

// ── Components ─────────────────────────────────────────────────────────
export { GraphDashboard } from './GraphDashboard';
export { StatsOverview } from './StatsOverview';
export { SearchBar } from './SearchBar';
export { OrphanNotesList } from './OrphanNotesList';
export { ClusterList } from './ClusterList';
export { SuggestionsPanel } from './SuggestionsPanel';
export { ErrorBoundary } from './ErrorBoundary';

// ── Types ──────────────────────────────────────────────────────────────
export type {
  DashboardData,
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
} from './types';

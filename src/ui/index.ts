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
export { LLMQueryInput } from './LLMQueryInput';
export { LLMInsightsPanel } from './LLMInsightsPanel';
export { LLMSettingsPanel } from './LLMSettingsPanel';
export { KnowledgeGapsPanel } from './KnowledgeGapsPanel';
export { FixMyVaultPanel } from './FixMyVaultPanel';
export { VaultHealthCard } from './VaultHealthCard';
export { RediscoveryPanel } from './RediscoveryPanel';

// ── Types ──────────────────────────────────────────────────────────────
export type {
  DashboardData,
  VaultStats,
  OrphanNote,
  Cluster,
  Suggestion,
  SuggestionType,
  LLMState,
  GraphDashboardProps,
  StatsOverviewProps,
  SearchBarProps,
  LLMQueryInputProps,
  LLMInsightsPanelProps,
  LLMSettingsPanelProps,
  OrphanNotesListProps,
  ClusterListProps,
  SuggestionsPanelProps,
  KnowledgeGapsPanelProps,
  FixMyVaultPanelProps,
  VaultHealthCardProps,
  RediscoveryMode,
  RediscoveryItem,
  RediscoveryState,
  RediscoveryPanelProps,
} from './types';

// ── Health Types (re-exported for convenience) ─────────────────────────
export type {
  HealthReport,
  HealthGrade,
  SubScores,
  HealthFix,
} from '../health/healthTypes';

// ── Action Types (re-exported for convenience) ─────────────────────────
export type { ActionResult } from '../actions/actionTypes';



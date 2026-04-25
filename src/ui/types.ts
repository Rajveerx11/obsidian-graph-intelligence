/**
 * Shared type definitions for Obsidian Graph Intelligence.
 *
 * DashboardData is the primary data contract between the core engine and the UI.
 * All component props derive from these base types.
 */

import type { LLMInsight, LLMSettings, ConnectionTestResult } from '../llm/types';
import type { KnowledgeGap } from '../gap/gapTypes';
import type { ActionResult } from '../actions/actionTypes';
import type { FixItem } from '../fix/fixTypes';

// ── Data Models ────────────────────────────────────────────────────────

export interface VaultStats {
  totalNotes: number;
  totalLinks: number;
  orphanNotes: number;
  clusters: number;
}

export interface OrphanNote {
  id: string;
  title: string;
}

export interface Cluster {
  id: string;
  title: string;
  notesCount: number;
  notes: string[];
}

export type SuggestionType = 'link' | 'bridge';

export interface Suggestion {
  id: string;
  description: string;
  type: SuggestionType;
  /** Vault-relative path of the source note (for action targeting). */
  sourceNoteId?: string;
  /** Vault-relative path of the target note (for action targeting). */
  targetNoteId?: string;
}

export interface SemanticProgress {
  isAnalyzing: boolean;
  processed: number;
  total: number;
}

// ── Data Contract ──────────────────────────────────────────────────────

/** Aggregated data the UI needs from the core engine. */
export interface DashboardData {
  stats: VaultStats;
  orphans: OrphanNote[];
  clusters: Cluster[];
  suggestions: Suggestion[];
  knowledgeGaps: KnowledgeGap[];
  semanticProgress?: SemanticProgress;
}

// ── LLM State ──────────────────────────────────────────────────────────

/** Tracks the state of the LLM query lifecycle in the UI. */
export interface LLMState {
  isQuerying: boolean;
  currentInsight: LLMInsight | null;
  error: string | null;
}

// ── Component Props ────────────────────────────────────────────────────

export interface GraphDashboardProps extends DashboardData {
  onSearch?: (query: string) => void;
  onSuggestLinks?: (noteId: string) => void | Promise<void>;
  onAcceptSuggestion?: (id: string) => void;
  onDismissSuggestion?: (id: string) => void;

  /** LLM integration — all optional. Dashboard works without these. */
  onLLMQuery?: (query: string) => void;
  llmState?: LLMState;
  llmSettings?: LLMSettings;
  onLLMSettingsChange?: (settings: LLMSettings) => void;
  onTestLLMConnection?: () => Promise<ConnectionTestResult>;

  /** Action layer — all optional. Dashboard works without these. */
  onLinkNotes?: (sourceId: string, targetId: string) => Promise<ActionResult>;
  onOpenNotes?: (noteIds: string[]) => Promise<ActionResult>;
  onCreateNote?: (title: string, content?: string) => Promise<ActionResult>;
  onCreateBridgeNote?: (noteAId: string, noteBId: string) => Promise<ActionResult>;
}

export interface StatsOverviewProps {
  totalNotes: number;
  totalLinks: number;
  orphanNotes: number;
  clusters: number;
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface LLMQueryInputProps {
  onSubmit: (query: string) => void;
  isQuerying: boolean;
  disabled?: boolean;
}

export interface LLMInsightsPanelProps {
  insight: LLMInsight | null;
  isQuerying: boolean;
  error: string | null;
}

export interface LLMSettingsPanelProps {
  settings: LLMSettings;
  onChange: (settings: LLMSettings) => void;
  onTestConnection?: () => Promise<ConnectionTestResult>;
}

export interface OrphanNotesListProps {
  notes: OrphanNote[];
  onSuggestLinks: (noteId: string) => void | Promise<void>;
}

export interface ClusterListProps {
  clusters: Cluster[];
}

export interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
  /** Action callbacks — optional. When present, action buttons are shown. */
  onLinkNotes?: (sourceId: string, targetId: string) => Promise<ActionResult>;
  onOpenNotes?: (noteIds: string[]) => Promise<ActionResult>;
}

export interface KnowledgeGapsPanelProps {
  gaps: KnowledgeGap[];
  /** Action callbacks — optional. When present, action buttons are shown. */
  onLinkNotes?: (sourceId: string, targetId: string) => Promise<ActionResult>;
  onCreateBridgeNote?: (noteAId: string, noteBId: string) => Promise<ActionResult>;
  onOpenNotes?: (noteIds: string[]) => Promise<ActionResult>;
}

export interface FixMyVaultPanelProps {
  data: DashboardData;
  onLinkNotes?: (sourceId: string, targetId: string) => Promise<ActionResult>;
  onCreateBridgeNote?: (noteAId: string, noteBId: string) => Promise<ActionResult>;
  onOpenNotes?: (noteIds: string[]) => Promise<ActionResult>;
}


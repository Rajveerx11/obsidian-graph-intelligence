import type { LLMInsight, LLMSettings, ConnectionTestResult } from '../llm/types';
import type { KnowledgeGap } from '../gap/gapTypes';
import type { ActionResult } from '../actions/actionTypes';
import type { FixBatchResult, FixItem } from '../fix/fixTypes';
import type { HealthReport } from '../health/healthTypes';

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
  sourceNoteId?: string;
  targetNoteId?: string;
}

export interface SemanticProgress {
  isAnalyzing: boolean;
  processed: number;
  total: number;
}

export interface DashboardData {
  stats: VaultStats;
  orphans: OrphanNote[];
  clusters: Cluster[];
  suggestions: Suggestion[];
  knowledgeGaps: KnowledgeGap[];
  semanticProgress?: SemanticProgress;
  health?: HealthReport;
  healthTrend?: {
    sparkline: number[];      // overall scores oldest-first, capped (<=50)
    previousScore?: number;   // score of the prior snapshot (for "+N since last")
    delta?: number;           // current.overall - previousScore (signed)
  };
}

export interface LLMState {
  isQuerying: boolean;
  currentInsight: LLMInsight | null;
  error: string | null;
}

export interface GraphDashboardProps extends DashboardData {
  onSearch?: (query: string) => void;
  onSuggestLinks?: (noteId: string) => void | Promise<void>;
  onAcceptSuggestion?: (id: string) => void | Promise<void>;
  onDismissSuggestion?: (id: string) => void;
  onLLMQuery?: (query: string) => void;
  llmState?: LLMState;
  llmSettings?: LLMSettings;
  onLLMSettingsChange?: (settings: LLMSettings) => void;
  onTestLLMConnection?: () => Promise<ConnectionTestResult>;
  onLinkNotes?: (sourceId: string, targetId: string) => Promise<ActionResult>;
  onOpenNotes?: (noteIds: string[]) => Promise<ActionResult>;
  onCreateNote?: (title: string, content?: string) => Promise<ActionResult>;
  onCreateBridgeNote?: (noteAId: string, noteBId: string) => Promise<ActionResult>;
  onApplyFixPlan?: (fixes: FixItem[]) => Promise<FixBatchResult>;
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
  onAccept: (id: string) => void | Promise<void>;
  onDismiss: (id: string) => void;
  onLinkNotes?: (sourceId: string, targetId: string) => Promise<ActionResult>;
  onOpenNotes?: (noteIds: string[]) => Promise<ActionResult>;
}

export interface KnowledgeGapsPanelProps {
  gaps: KnowledgeGap[];
  onLinkNotes?: (sourceId: string, targetId: string) => Promise<ActionResult>;
  onCreateBridgeNote?: (noteAId: string, noteBId: string) => Promise<ActionResult>;
  onOpenNotes?: (noteIds: string[]) => Promise<ActionResult>;
}

export interface FixMyVaultPanelProps {
  data: DashboardData;
  onLinkNotes?: (sourceId: string, targetId: string) => Promise<ActionResult>;
  onCreateBridgeNote?: (noteAId: string, noteBId: string) => Promise<ActionResult>;
  onOpenNotes?: (noteIds: string[]) => Promise<ActionResult>;
  onApplyFixPlan?: (fixes: FixItem[]) => Promise<FixBatchResult>;
}

export interface VaultHealthCardProps {
  report: HealthReport;
  trend?: DashboardData['healthTrend'];
}

import type React from 'react';

/**
 * Shared type definitions for Obsidian Graph Intelligence UI components.
 * All interfaces are defined here to keep components decoupled and reusable.
 */

// ── Stats ──────────────────────────────────────────────────────────────────

export interface VaultStats {
  totalNotes: number;
  totalLinks: number;
  orphanNotes: number;
  clusters: number;
}

// ── Orphan Notes ───────────────────────────────────────────────────────────

export interface OrphanNote {
  id: string;
  title: string;
}

// ── Clusters ───────────────────────────────────────────────────────────────

export interface Cluster {
  id: string;
  title: string;
  notesCount: number;
  notes: string[];
}

// ── Suggestions ────────────────────────────────────────────────────────────

export type SuggestionType = 'link' | 'bridge';

export interface Suggestion {
  id: string;
  description: string;
  type: SuggestionType;
}

// ── Dashboard (root component) ─────────────────────────────────────────────

export interface GraphDashboardProps {
  stats: VaultStats;
  orphans: OrphanNote[];
  clusters: Cluster[];
  suggestions: Suggestion[];
  onSearch?: (query: string) => void;
  onSuggestLinks?: (noteId: string) => void;
  onAcceptSuggestion?: (id: string) => void;
  onDismissSuggestion?: (id: string) => void;
}

// ── Sub-component props ────────────────────────────────────────────────────

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

export interface OrphanNotesListProps {
  notes: OrphanNote[];
  onSuggestLinks: (noteId: string) => void;
}

export interface ClusterListProps {
  clusters: Cluster[];
}

export interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export interface StatItemProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  colorClass: string;
}

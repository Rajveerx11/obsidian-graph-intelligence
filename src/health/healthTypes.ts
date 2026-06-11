/**
 * Vault Health — type definitions.
 *
 * Pure types only. No Obsidian / runtime coupling: these are consumed both by the
 * pure scoring engine (`healthEngine.ts`) and, via `ui/types.ts`, by the React layer.
 */

export type HealthGrade = 'excellent' | 'good' | 'fair' | 'poor';

/** Four dimensions of vault health, each an integer 0-100. */
export interface SubScores {
  connectivity: number;    // 0-100, integer
  cohesion: number;        // 0-100, integer
  freshness: number;       // 0-100, integer
  discoverability: number; // 0-100, integer
}

/** A single prioritized, estimated-impact repair surfaced in the health card. */
export interface HealthFix {
  fixId: string;                    // mirrors FixItem.id (deterministic)
  title: string;                    // from FixItem.title
  description: string;              // from FixItem.description
  estimatedImpact: number;          // 0-100 delta points, rounded
  targetSubScore: keyof SubScores;  // which dimension this fix most improves
}

/** The full report produced by `computeHealthReport`. */
export interface HealthReport {
  overall: number;         // 0-100, integer
  grade: HealthGrade;      // derived band of overall
  subScores: SubScores;
  topFixes: HealthFix[];   // length 0..3, deterministic order
  computedAt: number;      // ms epoch, set by orchestrator (Date.now())
  noteCount: number;       // totalNotes at time of computation (for empty-vault UI)
}

// ── History / persistence ──────────────────────────────────────────────

/** One timestamped point in the persisted trend history. */
export interface HealthSnapshot {
  ts: number;          // ms epoch
  score: number;       // overall 0-100
  subScores: SubScores;
}

/** Capped, oldest-first list of snapshots, persisted to disk. */
export interface HealthHistory {
  snapshots: HealthSnapshot[];
}

export const DEFAULT_HEALTH_HISTORY: HealthHistory = { snapshots: [] };

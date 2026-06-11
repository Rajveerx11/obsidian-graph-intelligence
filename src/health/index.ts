/**
 * Vault Health module — deterministic scoring + persisted trend history.
 *
 * Scoring (`healthEngine`, `healthTypes`, `healthConstants`) is pure and
 * Obsidian-free. Only `healthHistoryStore` touches `app.vault.adapter`.
 */

// Types
export type {
  HealthGrade,
  SubScores,
  HealthFix,
  HealthReport,
  HealthSnapshot,
  HealthHistory,
} from './healthTypes';
export { DEFAULT_HEALTH_HISTORY } from './healthTypes';

// Constants
export { HEALTH_WEIGHTS, HEALTH_TUNING } from './healthConstants';

// Scoring engine
export {
  computeHealthReport,
  computeConnectivity,
  computeCohesion,
  computeFreshness,
  computeDiscoverability,
  computeOverall,
  deriveTopFixes,
} from './healthEngine';

// Persistence (Obsidian-touching)
export { HealthHistoryStore } from './healthHistoryStore';

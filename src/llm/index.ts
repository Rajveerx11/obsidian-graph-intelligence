/**
 * LLM module — optional reasoning layer for the knowledge graph.
 *
 * Public API:
 *   LLMOrchestrator    — main query coordinator
 *   LLMSettingsService — isolated settings persistence
 *   DEFAULT_LLM_SETTINGS — fallback configuration
 */

export { LLMOrchestrator } from './orchestrator';
export { LLMSettingsService } from './settings-service';
export { DEFAULT_LLM_SETTINGS } from './types';
export type {
  LLMSettings,
  LLMInsight,
  LLMProviderType,
  GraphContext,
} from './types';

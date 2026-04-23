/**
 * LLM Subsystem — Type Definitions
 *
 * All types for the optional LLM reasoning layer.
 * The LLM operates exclusively on structured summaries (GraphContext),
 * never on raw vault content.
 */

// ── Provider Configuration ─────────────────────────────────────────────

export type LLMProviderType = 'ollama' | 'openai' | 'openrouter';

export interface LLMSettings {
  /** Which provider to use. */
  provider: LLMProviderType;

  /** Ollama configuration (local, no API key needed). */
  ollamaModel: string;
  ollamaBaseUrl: string;

  /** OpenAI configuration (requires API key). */
  openaiApiKey: string;
  openaiModel: string;

  /** OpenRouter configuration (requires API key). */
  openrouterApiKey: string;
  openrouterModel: string;
}

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  provider: 'ollama',
  ollamaModel: 'llama3.2',
  ollamaBaseUrl: 'http://localhost:11434',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  openrouterApiKey: '',
  openrouterModel: 'meta-llama/llama-3.1-8b-instruct:free',
};

// ── Provider Interface ─────────────────────────────────────────────────

export interface LLMProvider {
  /** Sends a prompt and returns the generated text. Supports AbortSignal. */
  generateText(prompt: string, signal?: AbortSignal): Promise<string>;

  /** Checks if the provider is reachable and properly configured. */
  isAvailable(): Promise<boolean>;
}

// ── Safe Context (what gets sent to LLM) ───────────────────────────────

/**
 * Hard limits for context fields to keep prompts small and deterministic.
 * These are enforced in the orchestrator's buildSafeContext().
 */
export const CONTEXT_LIMITS = {
  MAX_ORPHAN_TITLES: 20,
  MAX_CLUSTERS: 5,
  MAX_TITLES_PER_CLUSTER: 5,
  MAX_SIMILAR_PAIRS: 10,
} as const;

export interface ClusterSummary {
  noteCount: number;
  /** Sample titles from the cluster (max CONTEXT_LIMITS.MAX_TITLES_PER_CLUSTER). */
  sampleTitles: string[];
}

export interface SimilarPair {
  noteA: string; // title only
  noteB: string; // title only
}

/**
 * The ONLY data structure sent to the LLM.
 * Contains aggregate stats and sample titles — never file paths,
 * note content, embeddings, tags, or raw markdown.
 */
export interface GraphContext {
  totalNotes: number;
  totalLinks: number;
  orphanCount: number;
  clusterCount: number;
  orphanTitles: string[];
  clusterSummaries: ClusterSummary[];
  similarPairs: SimilarPair[];
}

// ── Intent Classification ──────────────────────────────────────────────

export type IntentType =
  | 'find_gaps'
  | 'analyze_clusters'
  | 'suggest_links'
  | 'find_orphans'
  | 'general_insight';

export interface ParsedIntent {
  type: IntentType;
  originalQuery: string;
}

// ── LLM Response ───────────────────────────────────────────────────────

export interface LLMInsight {
  id: string;
  query: string;
  response: string;
  timestamp: number;
  /** Whether note references in the response have been validated. */
  validated: boolean;
}

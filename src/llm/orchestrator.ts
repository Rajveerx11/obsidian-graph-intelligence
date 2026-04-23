/**
 * LLM Orchestrator — Central coordinator for LLM queries.
 *
 * Responsibilities:
 *  1. Creates the correct provider based on settings
 *  2. Builds safe GraphContext from DashboardData (never sends raw content)
 *  3. Manages request lifecycle with AbortController
 *  4. Validates LLM output against known vault titles
 *  5. Enforces context size limits
 *
 * All methods are async and never block the main thread.
 */

import type {
  LLMProvider,
  LLMSettings,
  LLMInsight,
  GraphContext,
  ClusterSummary,
  SimilarPair,
} from './types';
import { CONTEXT_LIMITS } from './types';
import type { DashboardData } from '../ui/types';
import { OllamaProvider } from './providers/ollama';
import { OpenAIProvider } from './providers/openai';
import { OpenRouterProvider } from './providers/openrouter';
import { parseIntent, buildQueryPrompt } from './prompts';

export class LLMOrchestrator {
  /** Currently active AbortController — used to cancel in-flight requests. */
  private activeController: AbortController | null = null;

  /** Monotonically increasing ID for insights. */
  private insightCounter = 0;

  // ── Provider Factory ───────────────────────────────────────────────

  private createProvider(settings: LLMSettings): LLMProvider {
    switch (settings.provider) {
      case 'ollama':
        return new OllamaProvider(settings.ollamaBaseUrl, settings.ollamaModel);
      case 'openai':
        return new OpenAIProvider(settings.openaiApiKey, settings.openaiModel);
      case 'openrouter':
        return new OpenRouterProvider(
          settings.openrouterApiKey,
          settings.openrouterModel
        );
      default:
        throw new Error(`Unknown LLM provider: ${settings.provider}`);
    }
  }

  // ── Main Query Entry Point ─────────────────────────────────────────

  /**
   * Processes a user query against the current graph state.
   *
   * - Cancels any in-flight request before starting
   * - Builds safe context from DashboardData
   * - Sends structured prompt to the configured provider
   * - Validates output against known vault titles
   *
   * @throws {Error} If the request is aborted, provider fails, or is unconfigured
   */
  async query(
    userQuery: string,
    dashboardData: DashboardData,
    settings: LLMSettings
  ): Promise<LLMInsight> {
    // Cancel any previous in-flight request
    this.cancelActiveRequest();

    // Create a new AbortController for this request
    const controller = new AbortController();
    this.activeController = controller;

    try {
      const provider = this.createProvider(settings);
      const context = this.buildSafeContext(dashboardData);
      const intent = parseIntent(userQuery);
      const prompt = buildQueryPrompt(intent, context);

      const response = await provider.generateText(prompt, controller.signal);

      // If this controller was replaced (new query started), discard result
      if (controller.signal.aborted) {
        throw new Error('Request was cancelled.');
      }

      // Validate and annotate the response
      const allKnownTitles = this.extractAllKnownTitles(dashboardData);
      const validated = this.validateResponse(response, allKnownTitles);

      const insight: LLMInsight = {
        id: `llm-insight-${this.insightCounter++}`,
        query: userQuery,
        response: validated,
        timestamp: Date.now(),
        validated: true,
      };

      return insight;
    } finally {
      // Clear controller only if it's still ours
      if (this.activeController === controller) {
        this.activeController = null;
      }
    }
  }

  // ── Request Cancellation ───────────────────────────────────────────

  /** Cancels the currently active LLM request, if any. */
  cancelActiveRequest(): void {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
  }

  // ── Test Connection ────────────────────────────────────────────────

  /** Tests whether the configured provider is reachable. */
  async testConnection(settings: LLMSettings): Promise<boolean> {
    try {
      const provider = this.createProvider(settings);
      return await provider.isAvailable();
    } catch {
      return false;
    }
  }

  // ── Safe Context Builder ───────────────────────────────────────────

  /**
   * Converts DashboardData into a size-limited GraphContext.
   * This is the ONLY data that reaches the LLM.
   * Enforces hard limits from CONTEXT_LIMITS.
   */
  private buildSafeContext(data: DashboardData): GraphContext {
    // Orphan titles (max 20)
    const orphanTitles = data.orphans
      .slice(0, CONTEXT_LIMITS.MAX_ORPHAN_TITLES)
      .map((o) => o.title);

    // Cluster summaries (max 5 clusters, max 5 titles each)
    const clusterSummaries: ClusterSummary[] = data.clusters
      .slice(0, CONTEXT_LIMITS.MAX_CLUSTERS)
      .map((c) => ({
        noteCount: c.notesCount,
        sampleTitles: c.notes.slice(0, CONTEXT_LIMITS.MAX_TITLES_PER_CLUSTER),
      }));

    // Similar pairs from suggestions (max 10)
    const similarPairs: SimilarPair[] = [];
    for (const sug of data.suggestions) {
      if (similarPairs.length >= CONTEXT_LIMITS.MAX_SIMILAR_PAIRS) break;
      // Parse suggestion description for note pair titles
      const pair = this.parseSuggestionPair(sug.description);
      if (pair) {
        similarPairs.push(pair);
      }
    }

    return {
      totalNotes: data.stats.totalNotes,
      totalLinks: data.stats.totalLinks,
      orphanCount: data.stats.orphanNotes,
      clusterCount: data.stats.clusters,
      orphanTitles,
      clusterSummaries,
      similarPairs,
    };
  }

  /**
   * Extracts a note pair from a suggestion description string.
   * Expected format: `Consider linking "Note A" ↔ "Note B" (...)`
   */
  private parseSuggestionPair(description: string): SimilarPair | null {
    const match = description.match(/"([^"]+)"\s*↔\s*"([^"]+)"/);
    if (match) {
      return { noteA: match[1], noteB: match[2] };
    }
    return null;
  }

  // ── Output Validation ──────────────────────────────────────────────

  /**
   * Collects all known note titles from the dashboard data
   * for validating LLM output references.
   */
  private extractAllKnownTitles(data: DashboardData): Set<string> {
    const titles = new Set<string>();

    for (const orphan of data.orphans) {
      titles.add(orphan.title.toLowerCase());
    }

    for (const cluster of data.clusters) {
      for (const note of cluster.notes) {
        titles.add(note.toLowerCase());
      }
    }

    return titles;
  }

  /**
   * Validates the LLM response by checking quoted note references
   * against known vault titles. Appends a warning if unknown titles
   * are detected.
   */
  private validateResponse(
    response: string,
    knownTitles: Set<string>
  ): string {
    // Extract all quoted strings from the response
    const quotedRefs = response.match(/"([^"]+)"/g);
    if (!quotedRefs || quotedRefs.length === 0) {
      return response;
    }

    const unknownRefs: string[] = [];
    for (const ref of quotedRefs) {
      const title = ref.replace(/"/g, '').toLowerCase();
      // Skip very short refs (likely not note titles) and common phrases
      if (title.length < 3) continue;
      if (!knownTitles.has(title) && !this.isCommonPhrase(title)) {
        unknownRefs.push(ref);
      }
    }

    if (unknownRefs.length > 0) {
      return (
        response +
        '\n\n⚠️ Note: Some referenced titles could not be verified in your vault: ' +
        unknownRefs.join(', ') +
        '.'
      );
    }

    return response;
  }

  /** Quick check for common English phrases the LLM might quote. */
  private isCommonPhrase(text: string): boolean {
    const common = [
      'connect', 'review', 'consider', 'link', 'bridge',
      'important', 'note', 'suggestion', 'cluster', 'orphan',
      'high priority', 'action', 'missing', 'gap',
    ];
    return common.includes(text);
  }
}

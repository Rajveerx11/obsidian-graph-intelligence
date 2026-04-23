/**
 * LLM Settings Service — Isolated persistence layer.
 *
 * Decouples settings logic from the UI and plugin instance.
 * The service is initialized once with save/load callbacks,
 * then any component can read/write settings without knowing
 * about Obsidian's Plugin API.
 */

import type { LLMSettings } from './types';
import { DEFAULT_LLM_SETTINGS } from './types';

/** Callback signatures for Obsidian's loadData/saveData. */
interface SettingsCallbacks {
  load: () => Promise<Record<string, unknown> | null>;
  save: (data: Record<string, unknown>) => Promise<void>;
}

const SETTINGS_KEY = 'llmSettings';

export class LLMSettingsService {
  private callbacks: SettingsCallbacks;
  private cached: LLMSettings;

  constructor(callbacks: SettingsCallbacks) {
    this.callbacks = callbacks;
    this.cached = { ...DEFAULT_LLM_SETTINGS };
  }

  /** Loads persisted settings, falling back to defaults for missing keys. */
  async load(): Promise<LLMSettings> {
    try {
      const allData = await this.callbacks.load();
      if (allData && typeof allData[SETTINGS_KEY] === 'object') {
        const stored = allData[SETTINGS_KEY] as Partial<LLMSettings>;
        this.cached = { ...DEFAULT_LLM_SETTINGS, ...stored };
      }
    } catch (err) {
      console.warn('[ogi:llm] Failed to load settings, using defaults:', err);
      this.cached = { ...DEFAULT_LLM_SETTINGS };
    }
    return { ...this.cached };
  }

  /** Returns the current in-memory settings (no disk read). */
  get(): LLMSettings {
    return { ...this.cached };
  }

  /** Persists updated settings. Merges with existing plugin data. */
  async save(settings: LLMSettings): Promise<void> {
    this.cached = { ...settings };
    try {
      const allData = (await this.callbacks.load()) ?? {};
      allData[SETTINGS_KEY] = this.cached;
      await this.callbacks.save(allData);
    } catch (err) {
      console.error('[ogi:llm] Failed to save settings:', err);
    }
  }

  /** Checks if the current provider has sufficient configuration. */
  isConfigured(): boolean {
    switch (this.cached.provider) {
      case 'ollama':
        return !!this.cached.ollamaBaseUrl && !!this.cached.ollamaModel;
      case 'openai':
        return !!this.cached.openaiApiKey && !!this.cached.openaiModel;
      case 'openrouter':
        return !!this.cached.openrouterApiKey && !!this.cached.openrouterModel;
      default:
        return false;
    }
  }
}

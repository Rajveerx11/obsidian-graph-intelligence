import type { App } from 'obsidian';

export interface ExtractionCacheEntry {
  content: string;
  metadata: Record<string, unknown>;
  extractedAt: number;
  sourceMtime: number;
}

export class IngestionCache {
  private cache: Map<string, ExtractionCacheEntry> = new Map();
  private cachePath = '.obsidian/plugins/obsidian-graph-intelligence/extraction-cache.json';
  private app: App;
  private dirty = false;

  constructor(app: App) {
    this.app = app;
  }

  async load(): Promise<void> {
    try {
      if (await this.app.vault.adapter.exists(this.cachePath)) {
        const raw = await this.app.vault.adapter.read(this.cachePath);
        const parsed = JSON.parse(raw) as Record<string, ExtractionCacheEntry>;
        this.cache = new Map(Object.entries(parsed));
      }
    } catch (err) {
      console.warn('[ogi] Failed to load extraction cache:', err);
      this.cache = new Map();
    }
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    try {
      const data = JSON.stringify(Object.fromEntries(this.cache));
      const pluginDir = '.obsidian/plugins/obsidian-graph-intelligence';
      if (!(await this.app.vault.adapter.exists(pluginDir))) {
        await this.app.vault.adapter.mkdir(pluginDir);
      }
      await this.app.vault.adapter.write(this.cachePath, data);
      this.dirty = false;
    } catch (err) {
      console.error('[ogi] Failed to save extraction cache:', err);
    }
  }

  get(sourceId: string, currentMtime: number): ExtractionCacheEntry | null {
    const entry = this.cache.get(sourceId);
    if (entry && entry.sourceMtime >= currentMtime) {
      return entry;
    }
    return null;
  }

  set(sourceId: string, content: string, metadata: Record<string, unknown>, sourceMtime: number): void {
    this.cache.set(sourceId, {
      content,
      metadata,
      extractedAt: Date.now(),
      sourceMtime,
    });
    this.dirty = true;
  }

  cleanup(validSourceIds: Set<string>): boolean {
    let changed = false;
    for (const key of this.cache.keys()) {
      if (!validSourceIds.has(key)) {
        this.cache.delete(key);
        changed = true;
      }
    }
    if (changed) this.dirty = true;
    return changed;
  }

  clear(): void {
    this.cache.clear();
    this.dirty = true;
  }
}

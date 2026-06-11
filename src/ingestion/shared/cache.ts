import type { App } from 'obsidian';
import { pluginFilePath, loadJson, writeFile } from '../../persistence';

export interface ExtractionCacheEntry {
  content: string;
  metadata: Record<string, unknown>;
  extractedAt: number;
  sourceMtime: number;
}

/**
 * Cache-hit fast path shared by every extractor: look up a key, and on a hit
 * return the extractor's `{ text, metadata }` shape. Centralizes the
 * `metadata as unknown as M` cast that each extractor previously repeated.
 */
export function readCachedExtraction<M>(
  cache: IngestionCache | undefined,
  key: string,
  version: number
): { text: string; metadata: M } | null {
  if (!cache) return null;
  const cached = cache.get(key, version);
  if (!cached) return null;
  return { text: cached.content, metadata: cached.metadata as unknown as M };
}

export class IngestionCache {
  private cache: Map<string, ExtractionCacheEntry> = new Map();
  private cachePath: string;
  private app: App;
  private dirty = false;

  constructor(app: App) {
    this.app = app;
    this.cachePath = pluginFilePath(app, 'extraction-cache.json');
  }

  async load(): Promise<void> {
    const parsed = await loadJson(this.app, this.cachePath, (raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      return raw as Record<string, ExtractionCacheEntry>;
    });
    this.cache = new Map(Object.entries(parsed ?? {}));
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    // Reset `dirty` only on a successful write so a failed save is retried next
    // time; use writeFile (which throws) rather than the error-swallowing saveJson.
    try {
      await writeFile(this.app, this.cachePath, JSON.stringify(Object.fromEntries(this.cache)));
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

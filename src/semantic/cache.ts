/**
 * Persistent Cache for Semantic Embeddings
 * 
 * Saves embeddings to a JSON file inside the plugin directory so they 
 * persist across sessions and sync across devices.
 */
import type { App } from 'obsidian';

export interface CachedEmbedding {
  embedding: number[];
  lastModified: number;
}

export type EmbeddingCache = Record<string, CachedEmbedding>;

export class SemanticCache {
  private cache: EmbeddingCache = {};
  // Path relative to vault root
  private cachePath = '.obsidian/plugins/obsidian-graph-intelligence/embeddings-cache.json';
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Loads the cache from disk.
   */
  async load(): Promise<void> {
    try {
      if (await this.app.vault.adapter.exists(this.cachePath)) {
        const data = await this.app.vault.adapter.read(this.cachePath);
        this.cache = JSON.parse(data);
      }
    } catch (err) {
      console.error('[ogi] Failed to load embeddings cache:', err);
      this.cache = {}; // Fallback to empty
    }
  }

  /**
   * Saves the current cache to disk.
   */
  async save(): Promise<void> {
    try {
      const data = JSON.stringify(this.cache);
      await this.app.vault.adapter.write(this.cachePath, data);
    } catch (err) {
      console.error('[ogi] Failed to save embeddings cache:', err);
    }
  }

  /**
   * Gets an embedding for a note if it exists and is up-to-date.
   */
  get(noteId: string, currentMtime: number): number[] | null {
    const entry = this.cache[noteId];
    if (entry && entry.lastModified >= currentMtime) {
      return entry.embedding;
    }
    return null; // Stale or missing
  }

  /**
   * Sets an embedding in the in-memory cache. 
   * Requires calling save() manually to persist.
   */
  set(noteId: string, embedding: number[], mtime: number): void {
    this.cache[noteId] = {
      embedding,
      lastModified: mtime
    };
  }

  /**
   * Removes stale entries for notes that no longer exist.
   */
  cleanup(validNoteIds: Set<string>): boolean {
    let changed = false;
    for (const key in this.cache) {
      if (!validNoteIds.has(key)) {
        delete this.cache[key];
        changed = true;
      }
    }
    return changed;
  }

  /** Get all valid cached embeddings for similarity computation */
  getAllValid(): Map<string, number[]> {
    const map = new Map<string, number[]>();
    for (const [id, entry] of Object.entries(this.cache)) {
      if (entry.embedding.length > 0) {
        map.set(id, entry.embedding);
      }
    }
    return map;
  }
}

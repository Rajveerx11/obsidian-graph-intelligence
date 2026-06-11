/**
 * Persistent Cache for Semantic Embeddings
 * 
 * Saves embeddings to a JSON file inside the plugin directory so they 
 * persist across sessions and sync across devices.
 */
import type { App } from 'obsidian';
import { pluginFilePath, legacyPluginFilePath, migrateLegacyFile, loadJson, saveJson } from '../persistence';

const CACHE_FILENAME = 'embeddings-cache.json';

export interface CachedEmbedding {
  embedding: number[];
  lastModified: number;
}

export type EmbeddingCache = Record<string, CachedEmbedding>;

/** Shape-validate a parsed cache file, keeping only well-formed entries. */
function validateCache(parsed: unknown): EmbeddingCache | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn('[ogi] Embeddings cache has unexpected shape, resetting.');
    return null;
  }
  const validated: EmbeddingCache = {};
  for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      Array.isArray((val as Record<string, unknown>).embedding) &&
      typeof (val as Record<string, unknown>).lastModified === 'number'
    ) {
      validated[key] = val as CachedEmbedding;
    }
  }
  return validated;
}

export class SemanticCache {
  private cache: EmbeddingCache = {};
  private cachePath: string;
  private app: App;

  constructor(app: App) {
    this.app = app;
    this.cachePath = pluginFilePath(app, CACHE_FILENAME);
  }

  /**
   * Loads the cache from disk, first recovering any cache left behind in the
   * legacy plugin folder by earlier builds so embeddings aren't rebuilt for free.
   */
  async load(): Promise<void> {
    await migrateLegacyFile(this.app, legacyPluginFilePath(this.app, CACHE_FILENAME), this.cachePath);
    const validated = await loadJson(this.app, this.cachePath, validateCache);
    this.cache = validated ?? {};
  }

  /**
   * Saves the current cache to disk.
   */
  async save(): Promise<void> {
    await saveJson(this.app, this.cachePath, this.cache);
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

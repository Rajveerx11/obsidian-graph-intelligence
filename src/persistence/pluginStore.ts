/**
 * Shared persistence mechanics for plugin-local state.
 *
 * Centralizes the "load/save JSON via the Obsidian adapter" plumbing that was
 * previously copy-pasted across the semantic cache, learning store, and health
 * history store. Each caller keeps its own domain-specific validation (clamping,
 * shape checks); this layer owns path construction, directory creation, read/
 * write, and error swallowing.
 *
 * The plugin folder name lives here as the single source of truth so it can
 * never drift from `manifest.json`'s `id` again.
 */
import type { App } from 'obsidian';

/** Must match `manifest.json` "id". The plugin's config folder is named after it. */
export const PLUGIN_ID = 'graph-intelligence';

/**
 * Folder some earlier builds wrote cache files into (the semantic and ingestion
 * caches hardcoded this). Kept only so `migrateLegacyFile` can recover that data.
 */
const LEGACY_PLUGIN_ID = 'obsidian-graph-intelligence';

/** Vault-relative path to a file inside this plugin's config folder. */
export function pluginFilePath(app: App, filename: string): string {
  const configDir = app.vault.configDir || '.obsidian';
  return `${configDir}/plugins/${PLUGIN_ID}/${filename}`;
}

/** Vault-relative path to a file inside the legacy (pre-rename) plugin folder. */
export function legacyPluginFilePath(app: App, filename: string): string {
  const configDir = app.vault.configDir || '.obsidian';
  return `${configDir}/plugins/${LEGACY_PLUGIN_ID}/${filename}`;
}

/**
 * One-time, best-effort migration: if `oldPath` exists and `newPath` does not,
 * copy the file to `newPath`. Used when a persisted file's location moves
 * between versions so users don't silently lose data (e.g. embeddings caches
 * that have to be rebuilt from scratch). Never throws into the caller.
 */
export async function migrateLegacyFile(app: App, oldPath: string, newPath: string): Promise<void> {
  const adapter = app.vault.adapter;
  try {
    if (await adapter.exists(newPath)) return;
    if (!(await adapter.exists(oldPath))) return;
    const data = await adapter.read(oldPath);
    await writeFile(app, newPath, data);
  } catch (err) {
    console.error(`[ogi:persistence] Failed to migrate ${oldPath} -> ${newPath}:`, err);
  }
}

function parentDir(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

/**
 * mkdir the parent directory (if any) then write `content`. Throws on failure
 * so callers that need the error (e.g. user-facing export results) can catch it.
 */
export async function writeFile(app: App, path: string, content: string): Promise<void> {
  const adapter = app.vault.adapter;
  const dir = parentDir(path);
  if (dir && !(await adapter.exists(dir))) {
    await adapter.mkdir(dir);
  }
  await adapter.write(path, content);
}

/**
 * Load + JSON.parse a file, then hand the parsed value to `validate`. Returns
 * null when the file is missing, unreadable, malformed JSON, or rejected by
 * `validate`. Never throws into the caller.
 */
export async function loadJson<T>(
  app: App,
  path: string,
  validate: (parsed: unknown) => T | null
): Promise<T | null> {
  const adapter = app.vault.adapter;
  try {
    if (!(await adapter.exists(path))) return null;
    const raw = await adapter.read(path);
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed);
  } catch (err) {
    console.error(`[ogi:persistence] Failed to load ${path}:`, err);
    return null;
  }
}

/**
 * Stringify + write JSON (creating the parent dir). Swallows errors (logs them)
 * so background saves never crash the caller. Use `writeFile` directly when you
 * need the error to propagate.
 */
export async function saveJson(
  app: App,
  path: string,
  data: unknown,
  pretty = false
): Promise<void> {
  try {
    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await writeFile(app, path, json);
  } catch (err) {
    console.error(`[ogi:persistence] Failed to save ${path}:`, err);
  }
}

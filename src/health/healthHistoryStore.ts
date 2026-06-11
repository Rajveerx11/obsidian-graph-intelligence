/**
 * Vault Health — persisted trend history.
 *
 * The ONLY file in `src/health` that touches Obsidian (`app.vault.adapter`).
 * Mirrors `src/learning/storage.ts` in style and defensive validation.
 */

import type { App } from 'obsidian';
import { DEFAULT_HEALTH_HISTORY } from './healthTypes';
import type { HealthHistory, HealthSnapshot, SubScores } from './healthTypes';

/** Max snapshots retained; older entries are dropped on append/load. */
const HISTORY_CAP = 50;

// NOTE: uses the correct plugin folder `graph-intelligence`. The semantic cache
// (src/semantic/cache.ts) writes to `obsidian-graph-intelligence` by mistake;
// that discrepancy is intentionally left untouched here.
const HISTORY_FILENAME = 'health-history.json';

function clampScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function validateSubScores(raw: unknown): SubScores | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const connectivity = clampScore(r.connectivity);
  const cohesion = clampScore(r.cohesion);
  const freshness = clampScore(r.freshness);
  const discoverability = clampScore(r.discoverability);
  if (
    connectivity === null ||
    cohesion === null ||
    freshness === null ||
    discoverability === null
  ) {
    return null;
  }
  return { connectivity, cohesion, freshness, discoverability };
}

function validateSnapshot(raw: unknown): HealthSnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.ts !== 'number' || !Number.isFinite(r.ts)) return null;
  const score = clampScore(r.score);
  if (score === null) return null;
  const subScores = validateSubScores(r.subScores);
  if (!subScores) return null;
  return { ts: r.ts, score, subScores };
}

export class HealthHistoryStore {
  private app: App;
  private history: HealthHistory = { snapshots: [] };
  // Both derived once from configDir so the file path and the directory we
  // mkdir in save() are guaranteed to stay in sync (single-sourced).
  private pluginDir: string;
  private filePath: string;
  private loaded = false;

  constructor(app: App) {
    this.app = app;
    const configDir = app.vault.configDir || '.obsidian';
    this.pluginDir = `${configDir}/plugins/graph-intelligence`;
    this.filePath = `${this.pluginDir}/${HISTORY_FILENAME}`;
  }

  /**
   * Load and shape-validate the history file; fall back to an empty history.
   * Idempotent: the first call reads disk, later calls are no-ops unless
   * `force` is set (avoids redundant I/O when called on every analysis). This
   * instance is the only writer in a session, so the in-memory copy stays
   * authoritative after the initial load.
   */
  async load(force = false): Promise<void> {
    if (this.loaded && !force) return;
    this.loaded = true;
    const adapter = this.app.vault.adapter;
    try {
      if (!(await adapter.exists(this.filePath))) {
        this.history = { snapshots: [] };
        return;
      }
      const raw = await adapter.read(this.filePath);
      const parsed: unknown = JSON.parse(raw);

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn('[ogi:health] History has unexpected shape, resetting.');
        this.history = { snapshots: [] };
        return;
      }

      const snapshotsRaw = (parsed as Record<string, unknown>).snapshots;
      if (!Array.isArray(snapshotsRaw)) {
        console.warn('[ogi:health] History.snapshots is not an array, resetting.');
        this.history = { snapshots: [] };
        return;
      }

      const snapshots: HealthSnapshot[] = [];
      for (const entry of snapshotsRaw) {
        const valid = validateSnapshot(entry);
        if (valid) snapshots.push(valid);
      }
      this.history = { snapshots: snapshots.slice(-HISTORY_CAP) };
    } catch (e) {
      console.error('[ogi:health] Failed to load health history.', e);
      this.history = { snapshots: [] };
    }
  }

  /** Persist the current history (pretty JSON). Never throws into the caller. */
  async save(): Promise<void> {
    const adapter = this.app.vault.adapter;
    try {
      if (!(await adapter.exists(this.pluginDir))) {
        await adapter.mkdir(this.pluginDir);
      }
      await adapter.write(this.filePath, JSON.stringify(this.history, null, 2));
    } catch (e) {
      console.error('[ogi:health] Failed to save health history.', e);
    }
  }

  /** Append a snapshot and enforce the cap. */
  append(snapshot: HealthSnapshot): void {
    this.history.snapshots.push(snapshot);
    if (this.history.snapshots.length > HISTORY_CAP) {
      this.history.snapshots = this.history.snapshots.slice(-HISTORY_CAP);
    }
  }

  /** Most recent snapshot, or null when history is empty. */
  getLatest(): HealthSnapshot | null {
    const { snapshots } = this.history;
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }

  /** Overall scores oldest-first, for the sparkline. */
  getSparkline(): number[] {
    return this.history.snapshots.map((s) => s.score);
  }

  /** Defensive deep copy of the loaded history. */
  getHistory(): HealthHistory {
    return {
      snapshots: this.history.snapshots.map((s) => ({
        ts: s.ts,
        score: s.score,
        subScores: { ...s.subScores },
      })),
    };
  }
}

export { DEFAULT_HEALTH_HISTORY };

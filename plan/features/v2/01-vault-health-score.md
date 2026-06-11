# P1 — Vault Health Score & Trends (Implementation Design)

**Scope: FULL (ship in one build) · Priority: 1 · Effort: Small · Risk: Low**

## 0. Summary

Add a deterministic, pure "Vault Health" scoring layer (`src/health/`) that turns the existing structural
analysis (`Graph`, orphans, clusters, total links) plus `generateFixPlan()` into a `HealthReport` (overall
0-100 + 4 sub-scores + Top-3 fixes). Persist a capped, timestamped history via a new adapter-backed store
(`src/health/healthHistoryStore.ts`) in the correct `graph-intelligence` plugin folder. Surface it as a new
top section in `GraphDashboard` via a props-only `src/ui/VaultHealthCard.tsx` (gauge + sub-score bars +
Top-3 + sparkline + "+N since last" delta). Wire computation into the synchronous structural pass in
`GraphIntelligenceView.tsx` so it appears immediately, and recompute/persist after Apply All.

All scoring is pure (no Obsidian APIs). Only `healthHistoryStore.ts` touches `app.vault.adapter`, mirroring
`src/learning/storage.ts`.

---

## 1. Data model

### 1.1 New types — `src/health/healthTypes.ts`

```ts
export type HealthGrade = 'excellent' | 'good' | 'fair' | 'poor';

export interface SubScores {
  connectivity: number;    // 0-100, integer
  cohesion: number;        // 0-100, integer
  freshness: number;       // 0-100, integer
  discoverability: number; // 0-100, integer
}

export interface HealthFix {
  fixId: string;           // mirrors FixItem.id (deterministic)
  title: string;           // from FixItem.title
  description: string;     // from FixItem.description
  estimatedImpact: number; // 0-100 delta points, rounded
  targetSubScore: keyof SubScores; // which dimension this fix most improves
}

export interface HealthReport {
  overall: number;         // 0-100, integer
  grade: HealthGrade;      // derived band of overall
  subScores: SubScores;
  topFixes: HealthFix[];   // length 0..3, deterministic order
  computedAt: number;      // ms epoch, set by orchestrator (Date.now())
  noteCount: number;       // totalNotes at time of computation (for empty-vault UI)
}
```

### 1.2 History / persistence types — `src/health/healthTypes.ts` (same file)

```ts
export interface HealthSnapshot {
  ts: number;              // ms epoch
  score: number;           // overall 0-100
  subScores: SubScores;
}

export interface HealthHistory {
  snapshots: HealthSnapshot[]; // capped, oldest-first
}

export const DEFAULT_HEALTH_HISTORY: HealthHistory = { snapshots: [] };
```

### 1.3 Trend view-model passed to UI — add to `src/ui/types.ts`

`HealthReport` and the trend data reach `<GraphDashboard>` through `DashboardData`. Import the pure types
from `src/health/healthTypes` into `ui/types.ts` (types only, zero runtime/Obsidian coupling) — analogous to
how `ui/types.ts` already imports `KnowledgeGap` from `../gap/gapTypes` and `FixItem` from `../fix/fixTypes`.
No mirror type needed.

Add to `DashboardData`:

```ts
health?: HealthReport;
healthTrend?: {
  sparkline: number[];      // overall scores oldest-first, capped (<=50)
  previousScore?: number;   // score of the prior snapshot (for "+N since last")
  delta?: number;           // current.overall - previousScore (signed)
};
```

Both optional so `EMPTY_DATA` and intermediate semantic re-renders remain valid (strict is off; consumers
null-check). Add a props interface:

```ts
export interface VaultHealthCardProps {
  report: HealthReport;
  trend?: DashboardData['healthTrend'];
}
```

Export `VaultHealthCardProps` (and optionally re-export health types) from `src/ui/index.ts`.

---

## 2. Scoring algorithm

All weights/thresholds live in a single constants object `src/health/healthConstants.ts` so they are tunable
and reviewable in one place. All sub-scores normalize to an integer 0-100. All math is deterministic — no
`Date.now()` inside the pure module; the "now" reference is injected as a parameter.

### 2.1 Constants — `src/health/healthConstants.ts`

```ts
export const HEALTH_WEIGHTS = {
  connectivity: 0.30,
  cohesion: 0.25,
  freshness: 0.20,
  discoverability: 0.25,
} as const; // must sum to 1.0

export const HEALTH_TUNING = {
  // Connectivity
  idealAvgLinks: 3,           // avg links-per-note where the link component saturates
  orphanComponentWeight: 0.6,
  linkComponentWeight: 0.4,
  // Freshness
  freshnessHalfLifeDays: 90,  // exponential decay; ~half credit at 90 days
  msPerDay: 24 * 60 * 60 * 1000,
  // Grade bands (overall)
  gradeBands: { excellent: 80, good: 60, fair: 40 }, // else 'poor'
  // Top fixes
  maxTopFixes: 3,
} as const;
```

### 2.2 Connectivity
Inputs: `totalNotes (N)`, `orphanCount (O)`, `totalLinks (L)` (= `getTotalLinks` = edge count).
- `orphanRatio = N > 0 ? O / N : 0`
- `connectedScore = (1 - orphanRatio) * 100`
- `avgLinks = N > 0 ? L / N : 0`
- `linkScore = min(1, avgLinks / idealAvgLinks) * 100`
- `connectivity = round(orphanComponentWeight * connectedScore + linkComponentWeight * linkScore)`

Rationale: orphans are the strongest negative signal (60%); link density rewards a well-woven vault but
saturates at `idealAvgLinks` so power users with huge link counts are not over-rewarded.

### 2.3 Cohesion
Inputs: `rawClusters: string[][]`, `totalNotes (N)`.
- `inClusters = sum(c.length for c in rawClusters if c.length >= 2)`
- `cohesion = N > 0 ? round((inClusters / N) * 100) : 0`

Singleton/orphan clusters (BFS emits orphans as singletons) are excluded — matching `mapToDashboardData`'s
"meaningful clusters = length>=2" rule, keeping definitions consistent.

### 2.4 Freshness
Inputs: `nodes: NoteNode[]` (each `mtime` in ms), injected `now: number` (ms).
- `ageDays = max(0, (now - mtime) / msPerDay)`
- `w = 0.5 ^ (ageDays / freshnessHalfLifeDays)` (1.0 today, ~0.5 at 90d, ~0.25 at 180d)
- `freshness = N > 0 ? round((sum(w) / N) * 100) : 0`

Smooth decay avoids a hard stale/recent cliff; 90-day half-life reads as "a vault touched within the last
quarter is healthy." `now` is a parameter (determinism). Guard: `mtime > now` (clock skew) -> `ageDays`
clamped to 0 -> `w = 1`.

### 2.5 Discoverability
Inputs: `nodes: NoteNode[]`.
- `tagged = count(node where node.tags.length >= 1)`
- `discoverability = N > 0 ? round((tagged / N) * 100) : 0`

**Caveat to document in code + this doc:** `parser.ts` `TAG_RE = /(?:^|\s)#([a-zA-Z][\w-/]*)/g` extracts
**inline `#tags` only**, not YAML frontmatter `tags:`. Vaults that tag exclusively via frontmatter score low
on Discoverability despite being well-tagged. The health module consumes whatever `node.tags` contains and
does not re-parse. Do not fix the parser here.

### 2.6 Overall
`overall = round(w.connectivity*connectivity + w.cohesion*cohesion + w.freshness*freshness +
w.discoverability*discoverability)` using `HEALTH_WEIGHTS`. Each sub-score is 0-100 and weights sum to 1.0,
so the result is 0-100. Grade: `>=80 excellent`, `>=60 good`, `>=40 fair`, else `poor`.

### 2.7 Top 3 fixes (deterministic)
Source: `generateFixPlan(dashboardData)` from `src/fix/fixEngine.ts` — already a deterministically sorted
`FixItem[]` (priority desc, then confidence desc). Map each `FixItem` to an estimated impact and re-sort:
- Map action/type to a `targetSubScore`:
  - `link` action or `type==='link'`/`'gap'` -> `connectivity` (headline dimension; also helps cohesion).
  - `type==='orphan'` -> `connectivity` (removing an orphan raises connected ratio).
  - `create_note` (bridge) -> `cohesion`.
- `base = { high: 6, medium: 3, low: 1 }[priority]`; `estimatedImpact = round(base * confidence)`
  (confidence already 0-1 from `FixItem`). Avoids fragile "recompute score with the fix applied" simulation
  while staying deterministic and monotonic with priority/confidence.
- Stable-sort by `(estimatedImpact desc, fixId asc)`; take `maxTopFixes` (3); map to `HealthFix`. `fixId`
  values are stable (`fix-<gapId>`, `fix-<sugId>`, `fix-orphan-pure-<idx>`), so the Top-3 list is reproducible.

### 2.8 Public API — `src/health/healthEngine.ts`

```ts
export function computeHealthReport(input: {
  graph: Graph;                 // nodes (tags, mtime) and edge count
  orphanNodes: NoteNode[];
  rawClusters: string[][];
  totalLinks: number;
  dashboardData: DashboardData; // for generateFixPlan (suggestions/gaps/orphans)
  now: number;                  // injected; orchestrator passes Date.now()
}): HealthReport
```

Internally calls `computeConnectivity`, `computeCohesion`, `computeFreshness`, `computeDiscoverability`,
`computeOverall`, `deriveTopFixes` (each individually reviewable / extractable). Imports `generateFixPlan`
from `../fix` and types from `../core`. **No Obsidian import.**

### 2.9 Edge cases
- **Empty vault (N=0):** all sub-scores 0, `overall=0`, `grade='poor'`, `topFixes=[]`, `noteCount=0`. UI uses
  `report.noteCount === 0` to show an empty state instead of a misleading "0/100 poor".
- **1 note:** no edges -> orphanRatio=1 -> low connectivity; cohesion 0; freshness from its mtime;
  discoverability by tags. No division by zero (all guarded by `N > 0`).
- **All orphans:** orphanRatio=1, cohesion=0, connectivity ~0. Correct.
- **Huge vault:** all sums O(N), single pass; only the small fix list is sorted. Fine in the sync pass.
- **NaN/Infinity:** wrap each sub-score in `clamp01to100` (coerce non-finite -> 0, clamp [0,100], round).

---

## 3. Module / file layout

**Create (pure, no Obsidian):**
- `src/health/healthTypes.ts` — types in 1.1/1.2.
- `src/health/healthConstants.ts` — `HEALTH_WEIGHTS`, `HEALTH_TUNING`.
- `src/health/healthEngine.ts` — `computeHealthReport` + private sub-score fns + `clamp01to100`.
- `src/health/index.ts` — barrel: re-export types, `computeHealthReport`, the constants, and
  `HealthHistoryStore` (store export from the barrel is fine; it is the only Obsidian-touching file).

**Create (Obsidian adapter — isolated):**
- `src/health/healthHistoryStore.ts` — `HealthHistoryStore` class mirroring `src/learning/storage.ts`. The
  ONLY file in `src/health` importing `obsidian`/`App`.

**Create (UI, props-only):**
- `src/ui/VaultHealthCard.tsx` — presentational (section 5).

**Modify:**
- `src/ui/types.ts` — extend `DashboardData`, add `VaultHealthCardProps`, import health types.
- `src/ui/index.ts` — export `VaultHealthCard`, `VaultHealthCardProps` (optionally re-export types).
- `src/ui/GraphDashboard.tsx` — render `<VaultHealthCard>` as the new first section (ChapterMark 1
  "Vitals"); renumber subsequent indices.
- `src/plugin/GraphIntelligenceView.tsx` — wire computation, persistence, store instance (section 4).

No new npm dependencies. Sparkline is hand-rolled SVG; `lucide-react` for the section icon.

---

## 4. Orchestrator wiring — `src/plugin/GraphIntelligenceView.tsx`

### 4.1 New fields / construction
- `import { computeHealthReport, HealthHistoryStore } from '../health';` +
  `import type { HealthReport, HealthSnapshot } from '../health';`
- Field `private healthHistoryStore: HealthHistoryStore;`
- Constructor: `this.healthHistoryStore = new HealthHistoryStore(this.app);`

### 4.2 Compute in the synchronous structural pass
`computeStructuralData()` already returns `{ data, graph, rawClusters, orphanNodes }`. After
`mapToDashboardData(...)`:

```ts
const health = computeHealthReport({
  graph, orphanNodes, rawClusters,
  totalLinks,
  dashboardData: data,   // suggestions/gaps empty at sync time — fine; topFixes derive from structure
  now: Date.now(),
});
const dataWithHealth = { ...data, health };
return { data: dataWithHealth, graph, rawClusters, orphanNodes };
```

At the sync pass, `data.suggestions`/`knowledgeGaps` are empty, so `generateFixPlan` yields orphan-based
fixes only — acceptable for first paint. Health is NOT recomputed on every semantic re-render (avoid churn);
only on real analyses (open + Apply All).

### 4.3 Trend attach + persistence helper

```ts
private async applyHealthTrendAndPersist(persist: boolean): Promise<void> {
  const report = this.currentDashboardData.health;
  if (!report) return;
  await this.healthHistoryStore.load();
  const prev = this.healthHistoryStore.getLatest(); // capture BEFORE appending
  if (persist && report.noteCount > 0) {
    this.healthHistoryStore.append({ ts: report.computedAt, score: report.overall, subScores: report.subScores });
    await this.healthHistoryStore.save();
  }
  const sparkline = this.healthHistoryStore.getSparkline();
  this.currentDashboardData = {
    ...this.currentDashboardData,
    healthTrend: {
      sparkline,
      previousScore: prev ? prev.score : undefined,
      delta: prev ? report.overall - prev.score : undefined,
    },
  };
}
```

Capturing `prev` before appending makes "+N since last" compare against the previous analysis, not itself.

### 4.4 Initial open (`onOpen`)
After `this.currentDashboardData = data;` (now carrying `health`), inside the existing `try`:
```ts
await this.applyHealthTrendAndPersist(true); // real analysis -> persist one snapshot
this.renderDashboard(this.currentDashboardData);
```

### 4.5 After Apply All (`handleApplyFixPlan` -> `refreshAnalysis`)
Add `persistHealth = false` param to `refreshAnalysis(includeSemantic, persistHealth = false)`. In it, after
setting `currentDashboardData` from structural data and before the semantic branch:
`await this.applyHealthTrendAndPersist(persistHealth);` then `renderDashboard`. In `handleApplyFixPlan`, call
`refreshAnalysis(true, false)` on the early refresh (line ~366) and `refreshAnalysis(true, true)` on the
final refresh (line ~444) so a single Apply All persists exactly one snapshot reflecting the improvement.

### 4.6 Avoid double-persist / snapshot spam
- `recomputeGraphAsync`, `generateSemanticSuggestions`, `runGapDetection`, `updateSemanticProgress` MUST NOT
  persist. They spread `...this.currentDashboardData`, so `health`/`healthTrend` survive untouched. Verify
  `recomputeGraphAsync`'s object build preserves them (it spreads the full prior `currentDashboardData`).
- Only `onOpen` (once) and the final `refreshAnalysis` in `handleApplyFixPlan` persist. At most one snapshot
  per real analysis.

### 4.7 EMPTY_DATA
Leave as-is; `health`/`healthTrend` optional. First render shows no card; the card appears on the second
render after `computeStructuralData`. `GraphDashboard` renders the card only when `health` is present.

---

## 5. UI — `src/ui/VaultHealthCard.tsx`

Props-only, vault-free, existing inline-style + CSS-var conventions (`var(--ogi-accent)`, `var(--ogi-rule)`,
`var(--ogi-marginalia)`, `var(--ogi-font-label)`, `var(--ogi-font-mono)`). `lucide-react` icon (e.g.
`Activity`/`Gauge`/`HeartPulse`).

1. **Gauge (overall):** circular SVG ring (`stroke-dasharray` from `overall/100`) with the big number in
   `var(--ogi-font-mono)` tabular-nums at center and the `grade` label below in `var(--ogi-font-label)`
   uppercase. Ring color by grade (accent for excellent/good, amber for fair, a danger var for poor). No
   chart lib.
2. **Sub-score bars:** four labeled horizontal bars (Connectivity, Cohesion, Freshness, Discoverability).
   Each: uppercase label, a track (`var(--ogi-rule)`) with a fill of width `${value}%`, numeric value in
   mono. Discoverability bar carries `title="Counts inline #tags only; YAML frontmatter tags are not
   included"`.
3. **Sparkline + delta:** if `trend?.sparkline` has >=2 points, render a hand-rolled SVG polyline (normalize
   y to series min/max, fixed w/h, `var(--ogi-accent)` stroke, no fill); show `+N since last` / `-N` / `no
   change` from `trend.delta` (accent for positive, amber/danger for negative, marginalia for zero). Fewer
   than 2 points -> "Collecting trend data..." in `var(--ogi-marginalia)`.
4. **Top 3 fixes:** compact list of `report.topFixes`; each row shows `title`, truncated `description`, and a
   `+{estimatedImpact}` chip. **Read-only** (actions stay in the existing Restoration/FixMyVault section) to
   avoid duplicating handler wiring.

**Empty state:** if `report.noteCount === 0`, render one muted line ("No notes yet — add notes to see your
vault health.") and skip gauge/bars.

**Props:** `VaultHealthCardProps { report; trend? }` (section 1.3).

**GraphDashboard integration:** destructure `health, healthTrend`; insert as the first content
`<section aria-labelledby="ogi-ch-vitals">` with `<ChapterMark index={1} label="Vitals" />`, rendered only
when `health` is truthy: `{health && <VaultHealthCard report={health} trend={healthTrend} />}`. Renumber the
downstream ChapterMark indices (Ledger 1->2, Restoration 2->3, Cartographer 3->4, Uncharted 4->5,
Suggestions 5->6, Orphans 6->7, Continents 7->8).

---

## 6. Persistence design — `src/health/healthHistoryStore.ts`

Mirrors `src/learning/storage.ts` in style and robustness; a small class (like `SemanticCache`) holding
loaded state.

**Path** — use the **correct** plugin folder `graph-intelligence` (NOT the semantic cache's mistaken
`obsidian-graph-intelligence`). Build from `app.vault.configDir` (fallback `'.obsidian'`) like
`saveLearningData`:
```
`${app.vault.configDir}/plugins/graph-intelligence/health-history.json`
```
Add a one-line comment flagging the `cache.ts` discrepancy (do not change it).

**JSON shape:**
```json
{ "snapshots": [ { "ts": 1700000000000, "score": 72, "subScores": { "connectivity": 80, "cohesion": 60, "freshness": 70, "discoverability": 75 } } ] }
```
`ts` in **milliseconds** (consistent with `mtime` and `Date.now()`).

**API:**
```ts
class HealthHistoryStore {
  constructor(app: App)
  async load(): Promise<void>            // validate shape, fall back to DEFAULT_HEALTH_HISTORY
  async save(): Promise<void>            // ensure plugin dir (mkdir), write pretty JSON
  append(snapshot: HealthSnapshot): void // push then cap to last HISTORY_CAP (50)
  getLatest(): HealthSnapshot | null
  getSparkline(): number[]               // snapshots.map(s => s.score), oldest-first
  getHistory(): HealthHistory            // defensive copy
}
const HISTORY_CAP = 50;
```

**Load validation (strict off — defensive):** missing file -> default; not a plain object or `snapshots` not
an array -> warn + default (mirror `loadLearningData`); filter to entries with finite `ts`/`score` and a
4-numeric-field `subScores`, coerce/clamp scores to [0,100] integers; drop malformed entries; enforce cap
after load.

**Save:** `JSON.stringify(history, null, 2)`; ensure `${configDir}/plugins/graph-intelligence` exists via
`adapter.exists` + `adapter.mkdir` before write; try/catch with `console.error('[ogi:health] ...')`; never
throw into the orchestrator.

**Sparkline read:** orchestrator calls `load()` then `getSparkline()` in `applyHealthTrendAndPersist`, packs
it into `healthTrend.sparkline`. Loaded fresh per analysis (cheap, <=50 small entries) so sync edits are
picked up.

---

## 7. Edge cases & null handling (strict OFF)

- `health`/`healthTrend` optional everywhere; `GraphDashboard` guards `{health && ...}`; card guards
  `noteCount === 0` and `trend?.sparkline?.length`.
- Sub-score functions guard `N > 0`; `clamp01to100` handles non-finite.
- `node.tags` possibly undefined -> `(node.tags || []).length`.
- `node.mtime` 0/undefined -> `ageDays = max(0, (now - (mtime||0))/msPerDay)`; missing reads as old
  (freshness ~0), safe.
- `generateFixPlan` empty -> `topFixes = []`; UI shows "No fixes suggested — nice work."
- Corrupt history -> default empty -> sparkline absent -> "Collecting trend data...".
- `prev` null on first run -> no delta.
- Future `mtime` -> freshness clamped to 1.0 (no >100 leakage).

---

## 8. Risks & mitigations

- **Score feels arbitrary** -> single `healthConstants.ts` with rationale; sub-scores shown individually;
  grade bands give meaning; tunable in one place.
- **Top-3 impact misleading** -> deterministic, explainable function of the fix engine's own
  priority/confidence; labeled "estimated".
- **History growth** -> hard cap 50, append-and-slice; file stays a few KB.
- **Snapshot spam** -> persist only on real analyses; skip empty vault.
- **Determinism regressions** -> no `Math.random`/`Date.now()` in pure module; `fixId` tiebreak.
- **Discoverability undercounts frontmatter tags** -> documented caveat + UI tooltip; parser unchanged.
- **ChapterMark renumber** -> renumber all indices in one edit; verify rendered order.
- **Wrong plugin folder** -> use `graph-intelligence`; comment the `cache.ts` discrepancy without touching it.

---

## 9. Acceptance criteria

- `npm run lint` (tsc --noEmit) passes; no new deps.
- `healthEngine.ts`/`healthTypes.ts`/`healthConstants.ts` contain **no** `obsidian`/`App` import; only
  `healthHistoryStore.ts` does.
- Opening the view shows the card (gauge + 4 bars + Top-3) in the synchronous pass, before embeddings.
- Identical vault state -> identical `HealthReport` (deterministic).
- Apply All that resolves orphans/links increases `overall`/`connectivity`/`cohesion`, appends a snapshot,
  grows the sparkline, and shows a positive delta.
- History at `<configDir>/plugins/graph-intelligence/health-history.json`, capped at 50, shape-validated,
  survives reload.
- Empty vault renders the empty state (not "0/100 poor") and persists no snapshot.
- `src/ui` (incl. `VaultHealthCard`) never touches the vault/Obsidian APIs.

---

## 10. Step-by-step task breakdown (single sitting)

Each chunk is independently lint-checkable.

1. **Types + constants (pure, isolated).** `healthTypes.ts`, `healthConstants.ts`. Lint.
2. **Scoring engine (pure, isolated).** `healthEngine.ts` (`computeHealthReport` + sub-score fns +
   `clamp01to100`), importing `generateFixPlan` from `../fix` and types from `../core`. Lint.
3. **Barrel.** `src/health/index.ts`. Lint.
4. **Persistence (Obsidian-isolated).** `healthHistoryStore.ts` mirroring `src/learning/storage.ts`; add to
   barrel. Lint.
5. **UI types.** Extend `DashboardData`, add `VaultHealthCardProps`, import health types in `ui/types.ts`. Lint.
6. **UI component (props-only).** `VaultHealthCard.tsx`; export from `ui/index.ts`. Lint.
7. **Dashboard integration.** Add "Vitals" section as ChapterMark 1, renumber the rest. Lint.
8. **Orchestrator compute.** Import from `../health`, add `healthHistoryStore` field + construction, compute
   `health` in `computeStructuralData()`. Lint.
9. **Orchestrator trend/persist.** Add `applyHealthTrendAndPersist`, call in `onOpen` (persist) and
   `refreshAnalysis(includeSemantic, persistHealth=false)`; `persistHealth=true` only on the final
   `refreshAnalysis` in `handleApplyFixPlan`. Verify semantic/recompute paths preserve and never persist. Lint.
10. **Manual Obsidian verification.** Card in sync pass; Apply All raises score + grows sparkline; reload
    persists history; test empty/one-note vaults.

Contributor-friendly: tasks 1-4 (the entire `src/health` module) land with zero changes to existing files
and no behavior change.

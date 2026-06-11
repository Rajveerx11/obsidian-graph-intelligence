# P2 — Note Rediscovery / Resurface (Implementation Design)

**Scope: PARTIAL (this build) · Priority: 2 · Effort: Medium · Risk: Low-Medium**

## 0. Summary

Resurface OLD + UNLINKED + semantically-relevant notes. Two anchor modes behind a toggle:

- **DIGEST** — anchors are the top-K most recently modified notes; the panel aggregates rediscovery
  candidates across them into one rotating "rediscover these" list. Works with no note open.
- **LIVE** — anchor is the single currently-open file; the list refreshes via a workspace `file-open`
  listener.

Both reuse `findSimilarNotes` (which already excludes self + already-linked notes, applies learning weights,
thresholds, sorts, slices) and re-rank candidates by `similarity * ageBoost` so older notes float up. Each
row gets one-click Link (reuse `handleLinkNotes`), Dismiss (reuse `learningEngine.recordAction('ignore')`),
and open-on-title-click (reuse `handleOpenNotes`).

**Out of scope this build (follow-ups):** "why surfaced" explanation chips, recency-curve fine-tuning,
daily-rotation persistence/polish.

This follows the existing suggestions pipeline pattern almost exactly
(`generateSemanticSuggestions` -> `DashboardData.suggestions` -> `SuggestionsPanel`), so it slots in with
minimal architectural risk.

---

## 1. Data model

New types go in `src/ui/types.ts` plus pure helpers in the semantic layer. Reuse `SimilarityResult`
(`src/semantic/similarity.ts`) and `NoteNode` (`src/core/types.ts`).

### 1.1 New UI types (`src/ui/types.ts`)

```ts
export type RediscoveryMode = 'digest' | 'live';

export interface RediscoveryItem {
  id: string;            // stable row id, e.g. `redisc-<anchorId>|<targetId>`
  targetId: string;      // NoteNode.id of the note being resurfaced (file path)
  targetTitle: string;   // resolved from graph node title
  anchorId: string;      // the note this candidate was surfaced against
  anchorTitle: string;   // DIGEST display ("near <anchorTitle>"); LIVE = active file
  similarity: number;    // raw cosine score from findSimilarNotes (0..1)
  ageMs: number;         // now - targetNode.mtime (for "edited 8 months ago")
  rerankScore: number;   // similarity * ageBoost — the sort key (kept for transparency)
}
```

### 1.2 New field(s) on `DashboardData`

```ts
export interface RediscoveryState {
  mode: RediscoveryMode;
  items: RediscoveryItem[];
  isReady: boolean;          // embeddings cache populated at least once
  activeNoteTitle?: string;  // LIVE: title of current file, or undefined if none/non-markdown
}

export interface DashboardData {
  // ...existing fields...
  rediscovery?: RediscoveryState;  // optional => EMPTY_DATA + partial spreads stay valid
}
```

### 1.3 New props

```ts
export interface RediscoveryPanelProps {
  state?: RediscoveryState;
  onSetMode: (mode: RediscoveryMode) => void;
  onLinkNotes?: (sourceId: string, targetId: string) => Promise<ActionResult>;
  onOpenNotes?: (noteIds: string[]) => Promise<ActionResult>;
  onDismiss: (item: RediscoveryItem) => void;
}
```

Add to `GraphDashboardProps`: `rediscovery?: RediscoveryState`,
`onSetRediscoveryMode?: (mode: RediscoveryMode) => void`,
`onDismissRediscovery?: (item: RediscoveryItem) => void`. `onLinkNotes`/`onOpenNotes` already exist and are
reused. Export new types from `src/ui/index.ts`.

---

## 2. Algorithm

### 2.1 Where it lives
New pure module `src/semantic/rediscovery.ts` (sibling to `similarity.ts`). The semantic folder has **no
barrel**, so the view imports it directly: `from '../semantic/rediscovery'` (matching existing
`from '../semantic/similarity'`). Obsidian-free and side-effect-free.

### 2.2 ageBoost formula
`RECENCY_WINDOW_MS = 365 days`. Rationale: notes edited within the last year are "fresh" and should NOT be
resurfaced; older notes get full boost; linear ramp between.

```
ageMs    = max(0, now - mtime)
ageBoost = MIN_BOOST + (MAX_BOOST - MIN_BOOST) * clamp(ageMs / RECENCY_WINDOW_MS, 0, 1)
```

with `MIN_BOOST = 1.0`, `MAX_BOOST = 1.6`. Properties:
- A brand-new note keeps its raw similarity (boost 1.0) — no penalty, no help.
- A note >= 1 year old gets up to +60%, enough to let a strong-old beat a slightly-stronger-fresh candidate,
  but bounded so a weak-but-ancient note can't outrank a genuinely strong match (keeps `rerankScore`
  interpretable, ordering stable).
- Linear (not exponential) for this build; curve fine-tuning is a DEFERRED item. Constants are named consts
  at the top of the file so the follow-up tunes them in one place.

`rerankScore = similarity * ageBoost`. `now` is a parameter (`now: number = Date.now()`) for determinism.

### 2.3 Composition with `findSimilarNotes`
Do NOT reimplement exclusion/weighting/threshold/sort — `findSimilarNotes` already does all of it.
Rediscovery calls it per anchor, then re-ranks by `rerankScore`. Use a LOWER threshold and HIGHER topN than
suggestions (which use `0.5, 2`) so re-ranking has a pool: `threshold = 0.45`, `topN = 8` per anchor.

Exports from `rediscovery.ts`:
```ts
export const RECENCY_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
export const REDISCOVERY_THRESHOLD = 0.45;
export const REDISCOVERY_PER_ANCHOR = 8;
export const DIGEST_ANCHOR_COUNT = 5;     // top-K most recently modified
export const REDISCOVERY_MAX_ITEMS = 8;   // cap on final list length

export function ageBoost(ageMs: number): number;
export function rerankCandidates(
  anchor: NoteNode,
  results: SimilarityResult[],
  nodeById: Map<string, NoteNode>,
  now: number,
): RediscoveryItem[];
export function selectDigestAnchors(nodes: NoteNode[], k?: number): NoteNode[];
```

`rerankCandidates` looks up each `targetId` in `nodeById`, skips missing (defensive — strict OFF), computes
`ageMs`/`ageBoost`/`rerankScore`, builds the `RediscoveryItem`.

### 2.4 DIGEST anchor selection + aggregation
`selectDigestAnchors(nodes, k = DIGEST_ANCHOR_COUNT)` = sort by `mtime` desc, tiebreak `id` asc, slice k.

Aggregation (a pure `buildDigestItems(...)` helper, or in the view loop):
1. For each of the K anchors: `findSimilarNotes(anchorId, map, graph, learning, 0.45, 8)` -> `rerankCandidates`.
2. Concatenate all items.
3. **Dedupe by `targetId`** — keep the instance with the highest `rerankScore` (so `anchorId/anchorTitle`
   reflect its best match). Drop any target whose id is one of the anchors.
4. Sort by `(rerankScore desc, targetId asc)`.
5. Slice to `REDISCOVERY_MAX_ITEMS`.

### 2.5 LIVE selection
Single anchor = active file's `NoteNode` (lookup by `TFile.path === NoteNode.id`).
`findSimilarNotes(activeId, ...)` -> `rerankCandidates` -> sort desc, tiebreak id asc -> slice
`REDISCOVERY_MAX_ITEMS`. No cross-anchor dedupe needed.

### 2.6 Determinism & ordering
All sorts have an explicit id tiebreak; `now` is injected. Same graph + embeddings + mode + (LIVE) active
file -> identical output. This makes the DEFERRED "daily rotation" a future additive change (seed by date)
without reworking the core.

---

## 3. Orchestrator wiring (`src/plugin/GraphIntelligenceView.tsx`)

### 3.1 New instance state
```ts
private rediscoveryMode: RediscoveryMode = 'digest';
private activeFileId: string | null = null;
private dismissedRediscovery = new Set<string>();  // session suppression by targetId
```

`dismissedRediscovery` mirrors the suggestions pattern (remove dismissed from the in-memory list); it is
session-scoped — the durable signal is the `'ignore'` learning action that `findSimilarNotes` factors in on
later recomputes. Prevents a dismissed row reappearing on the next recompute within the session.

### 3.2 `computeRediscovery()`
Mirror `generateSemanticSuggestions(graph)` / `runGapDetection()`. Guard first:

```ts
private computeRediscovery(): void {
  if (!this.currentGraph) return;
  const embeddingsMap = this.semanticCache.getAllValid();
  const isReady = embeddingsMap.size > 0;

  const nodeById = new Map(this.currentGraph.nodes.map(n => [n.id, n]));
  const learning = this.learningEngine.getLearningData();
  const now = Date.now();
  let items: RediscoveryItem[] = [];
  let activeNoteTitle: string | undefined;

  if (isReady) {
    if (this.rediscoveryMode === 'live') {
      const node = this.activeFileId ? nodeById.get(this.activeFileId) : undefined;
      activeNoteTitle = node?.title;
      if (node) {
        const results = findSimilarNotes(node.id, embeddingsMap, this.currentGraph, learning,
          REDISCOVERY_THRESHOLD, REDISCOVERY_PER_ANCHOR);
        items = rerankCandidates(node, results, nodeById, now); // then sort desc + tiebreak + slice
      }
    } else {
      const anchors = selectDigestAnchors(this.currentGraph.nodes);
      // loop anchors -> findSimilarNotes -> rerankCandidates -> aggregate/dedupe/sort/slice
    }
    items = items.filter(i => !this.dismissedRediscovery.has(i.targetId)); // suppress by targetId
  }

  this.currentDashboardData = {
    ...this.currentDashboardData,
    rediscovery: { mode: this.rediscoveryMode, items, isReady, activeNoteTitle },
  };
  this.renderDashboard(this.currentDashboardData);
}
```

Suppression keys on `targetId` ("stop showing me this note"), matching the per-target `'ignore'` semantics.

### 3.3 Where to invoke
Call wherever suggestions/gaps recompute, so it stays in sync:
- End of `processSemanticDataAsync` — after `generateSemanticSuggestions`/`runGapDetection` (~line 197-199);
  embeddings just became ready.
- In `recomputeGraphAsync` — after `runGapDetection()` (~line 551); a new link drops candidates.
- In `refreshAnalysis` — both branches, after gap detection.

### 3.4 `file-open` listener (LIVE)
In `onOpen()`, after the initial render, register via `this.registerEvent` (auto-cleans on view unload):
```ts
this.registerEvent(
  this.app.workspace.on('file-open', (file: TFile | null) => {
    this.activeFileId = file ? file.path : null;
    if (this.rediscoveryMode === 'live') this.computeRediscovery();
  })
);
```
Seed initial `activeFileId` from `this.app.workspace.getActiveFile()?.path ?? null` so LIVE works immediately
if a note is already open. Update `activeFileId` in both modes (so a later toggle to LIVE is correct), but
only recompute in LIVE to avoid wasted DIGEST work. `import { TFile } from 'obsidian'` (only `.path` used;
obsidian is external, no bundle cost).

### 3.5 `onClose()`
`registerEvent` auto-unregisters on unload, so `onClose` needs NO new teardown. Keep the existing
`cancelActiveRequest()` + `root.unmount()`.

### 3.6 Guards
`computeRediscovery` early-returns if `!currentGraph`. The `isReady` flag drives loading-vs-empty UI rather
than blocking — the panel renders a "warming up" state while embeddings compute (consistent with the header
`semanticProgress`). Never call `findSimilarNotes` when the map is empty.

### 3.7 StrictMode note
Listener registration is in the ItemView lifecycle (`onOpen`), NOT a React effect, so StrictMode's
double-invoke does not double-register. No React effects are added for this feature.

---

## 4. Handlers (in the view, passed as props)

All vault access stays in the view; the panel is vault-free.

- **Mode toggle:**
  ```ts
  private handleSetRediscoveryMode = (mode: RediscoveryMode): void => {
    if (mode === this.rediscoveryMode) return;
    this.rediscoveryMode = mode;
    this.computeRediscovery();
  };
  ```
- **Link:** reuse the existing `this.handleLinkNotes` (records `'accept'` + `recomputeGraphAsync`, which
  itself recomputes rediscovery and drops the now-linked target). Pass `onLinkNotes={this.handleLinkNotes}`,
  exactly as `SuggestionsPanel` receives it.
- **Dismiss:**
  ```ts
  private handleDismissRediscovery = (item: RediscoveryItem): void => {
    this.dismissedRediscovery.add(item.targetId);
    void this.learningEngine.recordAction({
      type: 'ignore', sourceNoteId: item.anchorId, targetNoteId: item.targetId, timestamp: Date.now(),
    });
    const r = this.currentDashboardData.rediscovery;
    if (r) {
      this.currentDashboardData = {
        ...this.currentDashboardData,
        rediscovery: { ...r, items: r.items.filter(i => i.targetId !== item.targetId) },
      };
      this.renderDashboard(this.currentDashboardData);
    }
  };
  ```
  Mirrors the existing `onDismissSuggestion` handler (record `'ignore'`, filter list, re-render).
- **Open:** reuse `this.handleOpenNotes`; panel calls `onOpenNotes([item.targetId])` on title click.

Wire into the `<GraphDashboard .../>` render block: `rediscovery={this.currentDashboardData.rediscovery}`,
`onSetRediscoveryMode={this.handleSetRediscoveryMode}`, `onDismissRediscovery={this.handleDismissRediscovery}`
(`onLinkNotes`/`onOpenNotes` already passed).

---

## 5. UI — `src/ui/RediscoveryPanel.tsx`

New presentational component, props-driven, no Obsidian/vault access. Model on `SuggestionsPanel.tsx`
(collapsible `ogi-card`, per-row async action status with `ActionStatus` state, `renderStatusIcon`, lucide
icons). Add to `src/ui/index.ts` and `GraphDashboard.tsx`.

**Structure:**
- Collapsible `ogi-card` header with a lucide icon (e.g. `History` or `Sparkles`), title "Rediscover", and a
  count badge (`ogi-badge`).
- **Mode toggle:** two small `ogi-btn` buttons "Digest" / "Live" with an active state;
  `onClick={() => onSetMode('digest'|'live')}`. In LIVE, show a one-line subhead "Near: {activeNoteTitle}"
  (or a hint if none).
- **List rows** (`state.items`), each:
  - Title (button -> `onOpenNotes([item.targetId])`), styled as a link (pointer, `var(--ogi-accent)`).
  - Age label, e.g. "edited 8 months ago", from `item.ageMs` via a local `formatAge(ms)` helper (no date lib).
  - Similarity label, e.g. "{Math.round(item.similarity*100)}% match" (display raw similarity, not
    rerankScore, to avoid confusing >100% values).
  - In DIGEST, a muted "near {anchorTitle}" marginalia line (seed for the DEFERRED "why surfaced" chip).
  - Actions: **Link** (when `onLinkNotes` + valid ids) and **Dismiss**, reusing the
    `ogi-btn--link`/`ogi-btn--dismiss` styles and the loading/success/error icon pattern from
    `SuggestionsPanel`.

**Empty / loading states (distinct):**
- `state` undefined or `!state.isReady` -> muted "Surveying semantics..." placeholder (matches header
  `semanticProgress` copy).
- `state.isReady && items.length === 0`:
  - LIVE + no `activeNoteTitle` -> "Open a note to see related forgotten notes."
  - LIVE + has title -> "Nothing forgotten to resurface near this note."
  - DIGEST -> "No old notes to rediscover yet."

**Props:** `RediscoveryPanelProps` (section 1.3). Mode-toggle + dismiss required; link/open optional (hide
those affordances if absent, like `SuggestionsPanel`).

**Placement in `GraphDashboard.tsx`:** add a new full-width `<section>` with a `<ChapterMark>` after the gaps
section (high visibility). Pass `state`, `onSetMode`, `onDismiss`, `onLinkNotes`, `onOpenNotes`. Reuse the
`ChapterMark` + CSS vars; reuse existing `ogi-*` classes (no new CSS required this build; new CSS can be a
follow-up). ASCII only.

---

## 6. Edge cases

- **No embeddings yet:** `getAllValid().size === 0` -> `isReady=false` -> loading placeholder; loop skipped;
  lights up when `processSemanticDataAsync` finishes and calls `computeRediscovery`.
- **No active file (LIVE):** `activeFileId === null` -> `activeNoteTitle` undefined, empty items -> "Open a
  note..." message.
- **Active file not a markdown node / not in graph** (PDF, canvas, unsaved, ingested entity):
  `nodeById.get(activeFileId)` undefined -> no anchor, LIVE empty message. No crash (explicit undefined check).
- **Vault with < 2 notes:** `findSimilarNotes` returns `[]` -> DIGEST "No old notes to rediscover yet."
- **All candidates already linked:** `findSimilarNotes` excludes linked -> `[]` -> empty message. Correct.
- **Dismissed items reappearing:** suppressed in-session via `dismissedRediscovery` (by `targetId`); durably
  down-weighted via the `'ignore'` learning action. Won't re-pop within the session.
- **StrictMode / listener double-registration:** listener in `onOpen` (ItemView), auto-removed via
  `registerEvent`. No double-registration.
- **Performance on large vaults:** `findSimilarNotes` scans the whole embeddings map per call (O(N*D)).
  DIGEST makes `DIGEST_ANCHOR_COUNT` (5) calls => O(5*N*D); LIVE makes 1. Runs only on discrete events
  (embeddings-ready, link/recompute, mode toggle, file-open in LIVE), never per render. Strictly cheaper than
  the existing suggestions pass (which loops over all nodes for up to 10 suggestion targets). If profiling
  later shows cost, the DEFERRED follow-up can memoize. No change to `findSimilarNotes`.

---

## 7. Risks & mitigations

- **`DashboardData` partial-spread drift** -> recompute rediscovery after every recompute path (section 3.3)
  so stale rediscovery never survives a graph change.
- **Stale `activeFileId` after rename/delete** -> handled by the `nodeById.get` undefined check (LIVE empty).
- **Suppression by `targetId` too broad in DIGEST** -> intended ("stop resurfacing this note"); matches
  `'ignore'` semantics. Documented.
- **Threshold tuning** -> `0.45` bounded by `ageBoost` cap + `REDISCOVERY_MAX_ITEMS`; tunable via consts;
  curve fine-tuning DEFERRED.
- **No test runner** -> rely on `npm run lint` + manual testing; pure helpers written to be obviously correct.

---

## 8. Acceptance criteria

- `npm run lint` (tsc --noEmit) passes; no new deps; ASCII only; obsidian/electron stay external.
- Works fully offline (local Xenova embeddings via existing `semanticCache`); no network calls added.
- Surfaces OLD + UNLINKED + relevant: older notes rank above equally-similar fresh notes (a 2-year-old note
  at similarity 0.6 outranks a 1-week-old note at 0.62 given the boost).
- Link creates the wikilink (reusing `handleLinkNotes`), records `'accept'`, and the target disappears after
  recompute.
- Dismiss records `'ignore'` and removes the row immediately; no in-session reappearance.
- Title click opens the note (reuse `handleOpenNotes`/`openNotes`).
- LIVE updates on `file-open`; shows "open a note" when none open. DIGEST shows with no note open.
- Loading state shows during embedding warmup; correct empty states otherwise.
- `src/ui/` touches no Obsidian APIs; all vault mutation stays in the view/actions.

---

## 9. Step-by-step task breakdown (single sitting)

Contributor-isolatable chunks marked [ISO].

1. **[ISO] Types** — add `RediscoveryMode`, `RediscoveryItem`, `RediscoveryState`, `RediscoveryPanelProps`,
   extend `DashboardData` + `GraphDashboardProps` in `ui/types.ts`; export from `ui/index.ts`. Lint.
2. **[ISO] Pure algorithm** — `src/semantic/rediscovery.ts`: consts, `ageBoost`, `rerankCandidates`,
   `selectDigestAnchors`, optional `buildDigestItems`. No Obsidian imports. Lint.
3. **[ISO] UI component** — `src/ui/RediscoveryPanel.tsx` (model on `SuggestionsPanel.tsx`): toggle, rows,
   Link/Dismiss/open, loading + empty states, `formatAge`. Export from barrel. Vault-free.
4. **Dashboard wiring** — add section + `ChapterMark` in `GraphDashboard.tsx`; thread `rediscovery`,
   `onSetRediscoveryMode`, `onDismissRediscovery`, `onLinkNotes`, `onOpenNotes`.
5. **Orchestrator state + compute** — add fields; import `rediscovery.ts` helpers + `TFile`; implement
   `computeRediscovery()` (LIVE + DIGEST branches, guards, dedupe/sort/slice, suppression filter).
6. **Invoke on all recompute paths** — `processSemanticDataAsync`, `recomputeGraphAsync`, both
   `refreshAnalysis` branches.
7. **Listener + seed** — in `onOpen`: seed `activeFileId` from `getActiveFile()`; register `file-open` via
   `this.registerEvent`. Confirm `onClose` needs no teardown.
8. **Handlers** — `handleSetRediscoveryMode`, `handleDismissRediscovery`; reuse `handleLinkNotes`/
   `handleOpenNotes`; wire the four props into the `<GraphDashboard>` block.
9. **Lint + manual test** — `npm run lint`; manual: empty vault, single note, large vault, toggle Digest/Live,
   open/switch notes, Link, Dismiss, title-open, loading state during warmup.

Suggested commit slices: (1+2) data+algorithm, (3+4) UI, (5-8) orchestrator wiring, then lint pass. Tasks
1-3 are isolated/contributor-friendly.

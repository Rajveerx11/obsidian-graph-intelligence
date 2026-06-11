# P4 — Interactive Health Graph View

**Priority: 4 · Effort: Large · Risk: Medium-High · Depends on: P1 metrics + existing confidence edges**

## The problem
The single most-cited Obsidian disappointment: the native graph view is *beautiful and almost
useless* past ~200 notes. It shows connections but never priority or status; you can't filter by
tag/date/frontmatter; you can't act on a node from inside the graph. It's a diagnostic toy, not a
navigation tool. This is the biggest open gap in the ecosystem — and the most demo-able, which makes
it the strongest magnet for both users and contributors.

## The idea
An **interactive, filterable, action-capable** graph inside our view that renders the *richer* data
we already compute and the native graph can't:
- **Color/size by health & role** — orphans, hubs, bridges, and cluster membership are visually
  obvious; node size from importance, halo from P1 sub-scores.
- **Edge types visible** — explicit / semantic / inferred / ai_generated rendered distinctly, with a
  confidence slider to hide low-confidence edges (we already store typed, scored edges).
- **Filters that the native graph lacks** — by tag, by date modified, by cluster, by confidence,
  by "orphans only" / "stale only".
- **Act from the graph** — click a node to see its context + suggested links and **accept a link
  right there**, closing the loop the native graph never closes.

## Why it fits our architecture
- The data is done: graph (`src/core`), typed confidence edges (`src/graph`), clusters/orphans/hubs,
  P1 health metrics. This feature is overwhelmingly a *rendering + interaction* layer over existing data.
- Stays props-driven: the view passes graph data + handlers to a new `<GraphCanvas />` in `src/ui`;
  clicking "link" calls back into the view, which calls `src/actions`. No vault access in the component.
- Filters operate on already-loaded data — no new analysis passes.

## Key technical decision: the renderer
Needs a force-directed layout that stays smooth on large vaults. **Decide before coding:**
- Option A — lightweight canvas force-graph lib (e.g. a small d3-force + canvas wrapper). Pro:
  capable, common. Con: a new runtime dependency; CLAUDE.md says be conservative and justify deps.
- Option B — hand-rolled canvas + a minimal force simulation. Pro: zero dep, full control, smallest
  bundle. Con: more code, we own the perf work.
- Option C — WebGL for very large vaults. Pro: scales to thousands of nodes. Con: heaviest to build.

**Recommendation:** prototype with B for the MVP (keeps the bundle lean and avoids the dep
justification), keep the renderer behind a thin interface so we can swap in A/C if perf demands.
Whatever we pick must be documented per the "justify any new dep" rule. Mark all heavy graph libs
external-friendly and never bundle Obsidian/Electron/CodeMirror.

## Scope
**MVP:** canvas force graph; color by role; confidence slider; filter by orphans / cluster / tag;
click-to-open note. **Performance budget: smooth interaction at ~1,000 nodes** (degrade gracefully /
auto-aggregate clusters above that).
**v0.2 stretch:** accept-link-from-graph; date filter; cluster collapse/expand; "focus mode" around
one node.
**Explicitly out:** in-graph note *editing* (users ask for it, but it's a v0.3+ scope; we close the
*linking* loop first).

## Risks & mitigations
- *Performance on big vaults.* **Top risk.** Mitigation: hard node-count budget; cluster aggregation
  above the budget; render on canvas not DOM; run layout off the main thread or in rAF-throttled
  ticks; never block the UI (CLAUDE.md hard rule).
- *Bundle size from a graph lib.* Mitigation: prefer the no-dep route for MVP; if a lib is added,
  document the justification and confirm it's tree-shakeable.
- *Scope creep toward "rebuild the native graph".* Mitigation: we win on *health + action + filters*,
  not on being a prettier hairball. Hold the line on the MVP scope.

## Acceptance criteria
- Renders a vault of ~1,000 nodes at interactive frame rates without freezing the UI thread.
- Orphans, hubs, and clusters are visually distinguishable at a glance.
- Confidence slider and at least the orphans/cluster/tag filters work on loaded data.
- Clicking a node opens it (and, stretch, lets you accept a suggested link).
- `npm run lint` passes; component is props-only; any new dep is justified in the doc + PR.

## Contributor surface (good first issues / scoped chunks)
- The force-simulation tick + canvas renderer (the core; one focused contributor).
- A single filter at a time (tag filter, date filter, confidence slider) — each is self-contained.
- Node styling / legend / color-by-role mapping.
- The "node detail" popover that reuses existing context + suggested-links data.

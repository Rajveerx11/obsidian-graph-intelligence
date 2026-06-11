# P1 — Vault Health Score & Trends

**Priority: 1 (build first) · Effort: Small · Risk: Low · Depends on: nothing**

## The problem
Maintaining a vault feels like an endless, thankless chore — users do the work but never see that
it paid off. There is no single number that says *"your vault got healthier this week."* Without
feedback, maintenance gets abandoned and the vault rots into a junk drawer.

## The idea
Turn the analysis we already run into **one headline Vault Health Score (0-100)**, broken into a
few sub-scores, **tracked over time**, with a short ranked list of "do these next" recommendations.
Maintenance becomes visible, quantified, and a little bit rewarding.

## What the user sees
- A health gauge at the top of the dashboard: e.g. **72 / 100 — "Healthy, with room to connect."**
- Sub-scores, each derived from data we already compute:
  - **Connectivity** — inverse of orphan ratio + average links per note.
  - **Cohesion** — cluster quality / how well clusters hold together.
  - **Discoverability** — tag coverage + title quality (feeds into P3).
  - **Freshness** — share of notes touched recently vs. stale ghost notes.
- A **sparkline / trend** showing the score across the last N analyses ("+6 since last week").
- "Top 3 things to fix" — pulled straight from the existing fix plan, sorted by score impact.

## Why it fits our architecture
- All inputs already exist: `getOrphans`, `getClusters`, `getTotalLinks` (`src/core`),
  knowledge gaps (`src/gap`), confidence edges (`src/graph`).
- New module **`src/health/`** (pure functions): takes the analysis result, returns a
  `HealthReport { score, subScores, recommendations }`. Easy to unit-reason-about, no Obsidian APIs.
- Trend persistence reuses the existing JSON-persistence pattern (same approach as semantic cache /
  learning engine) — append a timestamped snapshot via Obsidian `saveData`. Keep the history capped.
- `GraphIntelligenceView.tsx` computes the report at the end of the structural pass and passes it as
  props to a new presentational `<VaultHealthCard />` in `src/ui/`.

## Scope
**MVP:** single score + 4 sub-scores + "top 3 to fix", computed each analysis, shown in a card.
**v0.2 stretch:** persisted trend sparkline; per-folder health; a "health changed because…" diff
after Apply All.
**Explicitly out:** gamified streaks/badges (revisit later if engagement data warrants it).

## Risks & mitigations
- *Score feels arbitrary.* Mitigation: document the formula in the card tooltip and in
  `src/health/README`; keep weights in one constants file so they are tunable and reviewable.
- *Trend storage growth.* Mitigation: cap history (e.g. last 50 snapshots), store only aggregates,
  never note content.

## Acceptance criteria
- Opening the view shows a health score within the synchronous structural pass (no waiting on
  embeddings).
- Score is deterministic for a given graph and explained in the UI.
- After Apply All, re-analysis reflects an improved score.
- `npm run lint` passes; no Obsidian API calls inside `src/health/` or the React card.

## Contributor surface (good first issues)
- Add one new sub-metric (each is an isolated pure function + a weight): "tag coverage",
  "broken-link count", "MOC coverage".
- Build the `<VaultHealthCard />` gauge component (props-only, no vault access).
- Implement trend persistence + sparkline rendering.
- Write the scoring-formula documentation page.

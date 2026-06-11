# v2 Feature Designs

Comprehensive, pre-implementation design docs for the two features chosen for the **v0.2** release
(`0.1.0` -> `0.2.0`). Each doc is written *before* any code so the data model, algorithms, file layout,
wiring points, edge cases, and acceptance criteria are agreed up front. **Nothing here ships in the bundle**
— these are planning documents.

| Doc | Feature | Scope |
|-----|---------|-------|
| [01-vault-health-score.md](./01-vault-health-score.md) | **P1 — Vault Health Score & Trends** | Full (score + 4 sub-scores + Top-3 fixes + trend persistence + sparkline) |
| [02-note-rediscovery.md](./02-note-rediscovery.md) | **P2 — Note Rediscovery / Resurface** | Partial (both Digest + Live modes with Link/Dismiss/open; cosmetic extras deferred) |

These designs were validated against the real codebase: `GraphIntelligenceView.tsx`,
`core/{types,queries,parser}.ts`, `semantic/{similarity,cache}.ts`, `learning/{learningEngine,storage}.ts`,
`ui/{types,GraphDashboard}.ts(x)`, `actions/index.ts`, and `main.ts`.

## Guiding constraints (carried from CLAUDE.md)

- **Local-first by default** — works with zero API keys; no network calls added.
- **The view orchestrates; components stay props-only** — new state lives in `GraphIntelligenceView.tsx`;
  React components in `src/ui/` never touch the vault or Obsidian APIs.
- **Additive, never destructive** — new analysis layers on top of existing structural data.
- **Heavy work is async** — embeddings never block the UI thread.
- **No new dependencies** — sparklines/gauges are hand-rolled SVG; reuse existing `ogi-*` styles.

## Implementation note

Both docs end with an ordered, single-sitting task breakdown. The first chunk of each (the pure module:
`src/health/*` for P1, `src/semantic/rediscovery.ts` for P2) is self-contained and contributor-friendly —
landable and reviewable with no behavior change before any UI or orchestrator wiring.

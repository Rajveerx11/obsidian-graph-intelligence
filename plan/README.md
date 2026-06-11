# v0.2 Roadmap — Plan Folder

This folder holds the planning docs for the next version of **Graph Intelligence** (current: `0.1.0`).
Each doc is written *before* implementation so the design, scope, and contributor surface are
agreed up front. Nothing here ships in the bundle; it is project documentation only.

## How this was decided

1. Researched the real, recurring pain points Obsidian users report (see
   [`00-research-obsidian-pain-points.md`](./00-research-obsidian-pain-points.md)).
2. Mapped each pain point against what Graph Intelligence *already* does, so we build on the
   existing engine instead of duplicating it.
3. Picked five features that (a) solve a documented pain, (b) differentiate us from the two
   plugins we are most often compared to — **Smart Connections** (semantic related-notes) and
   **Dataview** (queryable vault) — and (c) are achievable inside the current architecture.
4. Prioritized them by `user value x differentiation / effort`, front-loading quick wins that
   create the foundation later features build on.

## The five features, in implementation order

| # | Feature | Pain it kills | Effort | Status | Why this slot |
|---|---------|---------------|--------|--------|---------------|
| **P1** | [Vault Health Score & Trends](./01-feature-vault-health-score.md) | "Maintenance is an exhausting chore"; no sense of progress | **S** | ✅ **Built** | Quick win, pure build on existing analysis, makes the plugin sticky + screenshot-worthy |
| **P2** | [Note Rediscovery / Resurface](./02-feature-note-rediscovery.md) | "Valuable insights disappear in a sea of unlinked notes" | **M** | Planned | Reuses embeddings + learning engine; competes with the most-loved AI feature and adds a "forgotten" twist |
| **P3** | [Auto-Tagging & Smart Metadata](./03-feature-auto-tagging.md) | Messy "junk-drawer" vaults; can't find anything | **M** | Planned | Fits the existing actions / Apply All pattern; makes Dataview users more powerful |
| **P4** | [Interactive Health Graph View](./04-feature-interactive-graph-view.md) | "Graph view is beautiful and almost useless" past ~200 notes | **L** | Planned | The flagship differentiator and the most demo-able feature; needs P1's metrics + confidence edges as inputs |
| **P5** | [Chat with your Graph](./05-feature-chat-with-graph.md) | Want to "ask the vault" without giving up privacy | **L** | Planned | Highest ceiling; reuses MCP + context-compression layers and benefits from P3 tags + P1 metrics as grounding |

S = small (days), M = medium (1-2 weeks), L = large (multi-week / multi-contributor).

## Guiding principles for v0.2 (carried from CLAUDE.md)

- **Local-first by default.** Everything must work with zero API keys. LLM/MCP features stay opt-in.
- **The view orchestrates; components stay dumb.** New state lives in `GraphIntelligenceView.tsx`;
  vault mutations live in `src/actions/`. React components never touch the vault.
- **Additive, never destructive.** New analysis layers on top of structural data. Apply actions are
  reversible-in-spirit and always preview before writing.
- **Heavy work is async.** Embeddings, LLM calls, and graph layout never block the UI thread.

## Contributor strategy (this is an open-source project)

Each feature doc ends with a **Contributor Surface** section listing self-contained, well-scoped
"good first issue" chunks. The goal: a new contributor can ship a metric, a tag heuristic, or a
graph filter without needing to understand the whole orchestrator. P1 and P3 are intentionally the
most contributor-friendly; P4 is the "wow" feature that pulls people in.

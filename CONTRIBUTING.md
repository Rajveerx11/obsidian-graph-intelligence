# Contributing

Thanks for contributing to Obsidian Graph Intelligence. Keep changes focused, easy to review, and safe for real Obsidian vaults.

## How to contribute (fork-based workflow)

The `main` branch is protected and accepts changes **only** through reviewed pull
requests. Contributors do not get push access, so all work happens on a fork:

1. **Fork** this repository on GitHub.
2. Clone your fork and add this repo as `upstream`:
   ```bash
   git clone https://github.com/<your-username>/obsidian-graph-intelligence.git
   cd obsidian-graph-intelligence
   git remote add upstream https://github.com/Rajveerx11/obsidian-graph-intelligence.git
   ```
3. Branch from an up-to-date `main`:
   ```bash
   git fetch upstream && git checkout -b feat/your-change upstream/main
   ```
4. Make your change, then run `npm run lint` and `npm run build`.
5. Push to your fork and open a pull request against `main`.

Direct pushes to `main` are blocked for everyone; force-pushes and branch
deletion on `main` are blocked; a linear history is enforced (PRs are
squash-merged).

## How pull requests are merged: the Greptile gate

Every PR is reviewed automatically by [Greptile](https://greptile.com). The
`main` ruleset requires the `greptile-gate` status check, which is driven by the
review score:

| Greptile score | What happens |
| -------------- | ------------ |
| **5/5** on your latest commit | The gate passes and the PR is **squash-merged automatically** - no maintainer action needed. |
| **Below 5/5** (e.g. 4/5) | The gate fails. A bot comment lists what to fix. Address the inline comments, push your fixes, then comment `@greptile review` to re-trigger. |
| Score is for an older commit | The gate stays **pending** until Greptile reviews your newest commit. |

To request a fresh review at any time, comment `@greptile review` on the PR. Keep
PRs small and focused - tightly scoped changes reach 5/5 much faster.

## Setup

```bash
npm install
npm run lint
npm run build
```

Use `npm run dev` when iterating locally. Reload Obsidian after build output changes.

## Quality Bar

- Run `npm run lint` before handing off work.
- Run `npm run build` before submitting plugin behavior changes.
- Keep vault mutations in `src/actions` or the Obsidian integration layer, not inside presentational React components.
- Keep React components props-driven and free of direct vault access.
- Avoid placeholder handlers, debug logging, dead imports, and generated explanatory comments.
- Use ASCII text in source and docs unless the file already requires non-ASCII content.

## Apply All and Repair Flow

Batch repair logic belongs in `GraphIntelligenceView.tsx`, because it owns the current graph, semantic cache, learning engine, and Obsidian APIs. The UI should only display state and call handlers.

Apply All changes should:

- Refresh analysis before applying the submitted plan.
- Apply link repairs through action helpers.
- Apply bridge-note repairs through action helpers.
- Reconnect unresolved review items through the graph context action.
- Record successful user-accepted repairs in the learning engine.
- Refresh structural graph data, semantic suggestions, and knowledge gaps after mutations.

## Module Guidelines

When working in newer modules, follow these conventions:

- **`src/ingestion/`** (PDF, image OCR, YouTube transcripts): Keep processing async, use `IngestionCache` for persistence, and never block the UI thread. Lazy-load heavy models (e.g., `tesseract.js`) only when files of that type are present.
- **`src/graph/`** (edge confidence): Edge types and confidence scores are additive. Existing structural edges remain untouched; confidence metadata is layered on top.
- **`src/export/`** (JSON, GraphML, Markdown): Always exclude raw embeddings from exports. Keep export functions pure so they can run outside Obsidian in tests.
- **`src/mcp/`** (MCP query layer): Security-first. The server is disabled by default, requires explicit opt-in, and never returns raw note content or full embeddings. Add new tools behind the `enabledTools` gate.
- **`src/context/`** (context compression): Respect token budgets. If content exceeds the limit, truncate cluster summaries and drop lower-importance nodes rather than failing.

## Pull Request Checklist

- `npm run lint` passes.
- `npm run build` passes.
- New or changed behavior was tested manually in Obsidian where practical.
- README or CONTRIBUTING updates are included when workflows, commands, or architecture change.
- Security-sensitive dependency changes are called out explicitly.
- The PR reaches a Greptile **5/5** score (it will be merged automatically once it does).

## Dependency Changes

Be conservative with runtime dependencies because the plugin runs inside Obsidian. If a dependency is added or upgraded, document why it is needed and verify that the production bundle still loads inside Obsidian.

Current runtime additions and their purposes:
- `pdfjs-dist` - PDF text extraction for ingestion.
- `tesseract.js` - Browser OCR for image text extraction.
- `youtube-transcript` - YouTube transcript fetching without API keys.

Do not run `npm audit fix --force` without checking the resulting dependency changes. Forced audit fixes can downgrade or replace packages in ways that break semantic analysis.

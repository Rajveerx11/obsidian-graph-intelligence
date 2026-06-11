# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Obsidian plugin (`id: graph-intelligence`) that analyzes a vault as a knowledge graph, surfaces weak spots (orphans, clusters, knowledge gaps), suggests links, and applies safe repair actions to notes. The UI is a React dashboard mounted inside an Obsidian `ItemView`. Everything runs locally; the LLM and MCP layers are optional and opt-in.

## Commands

```bash
npm run dev      # esbuild watch mode (rebuilds main.js, copies to vault on each change)
npm run build    # production bundle (minified, no sourcemap), exits when done
npm run lint     # tsc --noEmit — this is the ONLY type/lint check; run before handing off
npm run deploy    # build, then copy artifacts to OBSIDIAN_VAULT_PLUGINS_PATH
```

There is **no test runner and no test suite** — verification is `npm run lint` plus manual testing in Obsidian (build, reload Obsidian, open the view, Re-Analyze / Apply All). Do not claim tests pass; there are none.

Build output is `main.js` (bundled), `styles.css`, `manifest.json`. `esbuild.config.mjs` auto-copies these three files into a vault plugin folder **only when `OBSIDIAN_VAULT_PLUGINS_PATH` is set** (opt-in; this was previously a hardcoded path, which caused parallel git worktrees to clobber the same vault). `scripts/deploy.mjs` reads the same `OBSIDIAN_VAULT_PLUGINS_PATH` (see `.env.example`) for one-shot deploys. `obsidian`, `electron`, and CodeMirror packages are marked external — never bundle them.

`strict` is **off** in tsconfig, so `tsc` will not catch null/undefined issues. Be deliberate about null handling yourself.

## Architecture

`src/main.ts` is the plugin entry: registers the view, ribbon icon, and command, then defers everything to `GraphIntelligenceView`.

**`src/plugin/GraphIntelligenceView.tsx` is the orchestrator and the center of the system.** It is the only place that holds Obsidian APIs, the current graph, the semantic cache, the learning engine, the ingestion cache, and LLM/MCP/context services together. It owns all mutable state (`currentGraph`, `confidenceEdges`, etc.), runs the analysis pipeline, and passes plain data + handlers down to React. The React components in `src/ui/` are **presentational and props-driven** — they must never touch the vault or Obsidian APIs directly. This separation is a hard rule: vault mutations live in `src/actions/` (called from the view), not in components.

### Analysis pipeline (in `onOpen` / re-analyze)

1. **Synchronous structural pass** — `parseVault` → `buildGraph` → `getOrphans` / `getClusters` / `getTotalLinks` (`src/core/`). Renders immediately so the dashboard is responsive.
2. **Async semantic pass** (`processSemanticDataAsync`) — `computeEmbedding` (Transformers.js, `Xenova/all-MiniLM-L6-v2`, lazy-loaded from HF CDN, browser-cached) → `findSimilarNotes` → `detectKnowledgeGaps`. Guarded by a `semanticRunId` so stale runs are discarded.
3. **Async ingestion pass** (`processIngestionAsync`) — extracts text from non-markdown files and folds them into the graph as nodes.

Heavy work (embeddings, OCR, PDF, transcripts) is always async and must never block the UI thread. Models are lazy-loaded only when relevant files exist.

### Module map (`src/`)

- **`core/`** — vault parsing, graph building (from wikilinks), graph queries (orphans, clusters via BFS, link counts). Pure logic.
- **`actions/`** — all vault mutations: link notes, create notes, create bridge notes, reconnect orphans to graph-context notes. Returns `ActionResult`.
- **`semantic/`** — embedding pipeline, semantic cache (persisted JSON), similarity search.
- **`gap/`** — knowledge-gap detection between related-but-unlinked areas.
- **`fix/`** — `generateFixPlan` turns analysis into a prioritized, automatable repair plan; batch result types. **Apply All / batch-repair logic belongs in `GraphIntelligenceView.tsx`**, not in `fix/` or the UI, because it needs the live graph + caches + Obsidian APIs.
- **`graph/`** — confidence edges. Edge types: `explicit` (wikilink), `semantic`, `inferred`, `ai_generated`; each carries a 0.0–1.0 confidence. Confidence metadata is **additive** — layered on top of structural edges, which stay untouched. Duplicate edges are merged keeping highest confidence.
- **`learning/`** — persists user feedback (accepted/ignored suggestions) to JSON and adjusts scoring weights over time.
- **`ingestion/`** — `pdf/` (pdfjs-dist), `image/` (tesseract.js OCR), `youtube/` (youtube-transcript). All async, all use `IngestionCache` for persistence, lazy-load heavy models.
- **`llm/`** — optional assistant. `orchestrator.ts` manages providers (`anthropic`, `openai`, `openrouter`, `ollama`); `prompts.ts` includes `sanitizeForPrompt`; settings persisted via Obsidian `loadData`/`saveData`.
- **`mcp/`** — MCP-style structured query layer for external agents. **Security-first: disabled by default, explicit opt-in, per-tool `enabledTools` gate, rate limiting, token budget. Never returns raw note content or full embeddings** — only structured summaries. New tools go behind the gate.
- **`context/`** — token-budgeted vault compression (`short`/`medium`/`detailed`) for external LLM workflows. On overflow, truncate cluster summaries and drop low-importance nodes — never fail.
- **`export/`** — JSON / GraphML / Markdown exporters. **Always exclude raw embeddings.** Keep export functions pure (runnable outside Obsidian).
- **`ui/`** — React 19 components; collapsible-accordion dashboard sections. Wrapped in `ErrorBoundary`.

Most modules expose a barrel `index.ts` — import from the module root (`'../core'`, `'../actions'`), not deep paths, to match existing convention.

## Conventions

- Keep vault mutations in `src/actions` or the view layer; keep React components free of vault access and direct Obsidian API use.
- Use ASCII in source and docs unless the file already contains non-ASCII.
- Avoid placeholder handlers, debug logging left in, dead imports, and explanatory filler comments.
- Be conservative with runtime dependencies — the plugin runs inside Obsidian and the bundle ships to users. Document why any new dep is needed.
- Do **not** run `npm audit fix --force`: it downgrades `@xenova/transformers` and breaks semantic embeddings. The flagged transitive vuln (transformers/onnxruntime-web) is a known, deferred decision.

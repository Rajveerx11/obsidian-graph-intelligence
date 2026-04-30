# Obsidian Graph Intelligence

Graph Intelligence is an Obsidian plugin that analyzes your vault as a knowledge graph, finds weak spots, suggests useful links, and can apply safe repair actions directly to your notes.

## Features

- Structural graph analysis from Obsidian wikilinks.
- Orphan note detection for notes with no graph connections.
- Cluster discovery for connected topic groups.
- Local semantic similarity using Transformers.js embeddings.
- Knowledge gap detection for missing bridges between related areas.
- Fix My Vault panel with per-issue actions and Apply All batch repair.
- Context note reconnection for unresolved orphan review items.
- Optional LLM assistant with provider settings for Ollama, OpenAI, OpenRouter, and Anthropic.
- Learning feedback from accepted and ignored suggestions.

## Apply All Behavior

The Apply All button refreshes analysis before applying a repair plan, applies every automatable link and bridge-note action, reconnects unresolved notes through the graph context note, records successful actions in the learning engine, and refreshes graph, semantic suggestions, and knowledge gaps after mutations.

## Project Structure

```text
src/
  actions/      Vault mutations for links, notes, and context repair
  context/      Compact context-pack generation for external analysis
  core/         Vault parsing, graph building, and graph queries
  export/       JSON, GraphML, and Markdown export helpers
  fix/          Fix plan generation and batch result types
  gap/          Knowledge gap detection
  graph/        Confidence edge helpers
  ingestion/    PDF, image OCR, and YouTube transcript ingestion utilities
  learning/     User feedback storage and scoring adjustment
  llm/          Optional LLM orchestration, prompts, and providers
  mcp/          MCP-style query engine for graph data access
  plugin/       Obsidian ItemView and React lifecycle integration
  semantic/     Embeddings, semantic cache, and similarity search
  ui/           React dashboard components
```

## Development

```bash
npm install
npm run lint
npm run build
```

`npm run lint` runs TypeScript with `tsc --noEmit`. `npm run build` creates the production bundle and copies it to the configured Obsidian vault plugin folder.

## Manual Testing

1. Run `npm run build`.
2. Reload Obsidian.
3. Open Graph Intelligence from the ribbon or command palette.
4. Click Re-Analyze and confirm stats, clusters, suggestions, and gaps update.
5. Click Apply All on a vault with fixable issues and confirm note links/context updates are reflected after the refresh.

## Security Note

`npm audit --omit=dev` currently reports a critical transitive vulnerability through `@xenova/transformers` and `onnxruntime-web`. npm recommends `npm audit fix --force`, but that would install a breaking older transformer version. Treat that remediation as a separate dependency decision and test semantic embeddings before accepting it.

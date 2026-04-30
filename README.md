# Obsidian Graph Intelligence

Graph Intelligence is an Obsidian plugin that analyzes your vault as a knowledge graph, finds weak spots, suggests useful links, and can apply safe repair actions directly to your notes.

## Features

- **Structural Graph Analysis:** Deep analysis from Obsidian wikilinks to understand your vault's topology.
- **Orphan Note Detection:** Finds notes with no graph connections. The dashboard features a collapsible "Orphaned Notes" module for organized review.
- **Cluster Discovery:** Identifies connected topic groups and knowledge clusters.
- **Local Semantic Similarity:** Uses offline Transformers.js embeddings to find conceptually related notes.
- **Knowledge Gap Detection:** Detects missing bridges between related areas to inspire new connections.
- **Interactive UI Dashboard:** A modern, collapsible accordion pattern across all major UI sections (Orphaned Notes, Fix My Vault, AI Assistant) for a streamlined experience.
- **Suggest Links Integration:** Real-time contextual link suggestions with visual feedback, loading states, and state management.
- **Fix My Vault Panel:** An automated analysis and remediation dashboard offering per-issue actions, batch progress messaging, item state summaries, and an "Apply All" batch repair function.
- **Context Note Reconnection:** Smart reconnection for unresolved orphan review items through graph context notes.
- **Adaptive Learning System:** Persistently stores user feedback (accepted/ignored suggestions) to adjust weights and improve future suggestions over time.
- **Optional LLM Assistant:** Context-aware AI assistant supporting providers like Ollama, OpenAI, OpenRouter, and Anthropic.

## Apply All Behavior

The **Apply All** function automates the remediation of your vault's structural issues:
- Refreshes analysis to ensure the repair plan is up-to-date.
- Applies every automatable link and bridge-note action with batch progress messaging.
- Reconnects unresolved notes through their respective graph context notes.
- Records successful actions in the adaptive learning engine.
- Automatically refreshes the graph, semantic suggestions, and knowledge gaps after mutations.

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

# Contributing

Thanks for contributing to Obsidian Graph Intelligence. Keep changes focused, easy to review, and safe for real Obsidian vaults.

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

## Pull Request Checklist

- `npm run lint` passes.
- `npm run build` passes.
- New or changed behavior was tested manually in Obsidian where practical.
- README or CONTRIBUTING updates are included when workflows, commands, or architecture change.
- Security-sensitive dependency changes are called out explicitly.

## Dependency Changes

Be conservative with runtime dependencies because the plugin runs inside Obsidian. If a dependency is added or upgraded, document why it is needed and verify that the production bundle still loads inside Obsidian.

Do not run `npm audit fix --force` without checking the resulting dependency changes. Forced audit fixes can downgrade or replace packages in ways that break semantic analysis.

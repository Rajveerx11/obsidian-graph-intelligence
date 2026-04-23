# Obsidian Graph Intelligence

AI-powered graph analysis and link suggestions for your Obsidian vault.

## Project Structure

```
├── manifest.json            # Obsidian plugin manifest
├── styles.css               # Plugin styles (scoped under .ogi-root)
├── main.js                  # Built plugin bundle (generated)
├── esbuild.config.mjs       # Build configuration
├── src/
│   ├── main.ts              # Plugin entry (extends Plugin)
│   ├── plugin/
│   │   ├── index.ts
│   │   └── GraphIntelligenceView.tsx  # ItemView + React mount
│   ├── ui/                  # Reusable React components
│   │   ├── index.ts         # Barrel exports
│   │   ├── types.ts         # Shared interfaces (DashboardData contract)
│   │   ├── ErrorBoundary.tsx
│   │   ├── GraphDashboard.tsx   # Root component
│   │   ├── StatsOverview.tsx
│   │   ├── SearchBar.tsx
│   │   ├── ClusterList.tsx
│   │   ├── OrphanNotesList.tsx
│   │   └── SuggestionsPanel.tsx
│   └── core/                # Reserved for graph analysis logic
│       └── index.ts
```

## Development

```bash
npm install
npm run dev     # watch mode
npm run build   # production build
npm run lint    # type check
```

## Install in Obsidian

1. Build the plugin: `npm run build`
2. Copy `main.js`, `manifest.json`, and `styles.css` into:
   `<vault>/.obsidian/plugins/graph-intelligence/`
3. Enable the plugin in Obsidian Settings → Community Plugins
4. Use command: **"Open Graph Intelligence Dashboard"**

## Architecture

- **UI Layer** (`src/ui/`): Pure React components accepting data via props
- **Plugin Layer** (`src/plugin/`): Obsidian integration — view registration, React mounting
- **Core Layer** (`src/core/`): Reserved for graph analysis engine (next phase)

### Data Contract

The `DashboardData` interface defines what the UI expects:

```typescript
interface DashboardData {
  stats: VaultStats;
  orphans: OrphanNote[];
  clusters: Cluster[];
  suggestions: Suggestion[];
}
```

All UI components are props-driven with no internal state management or data fetching.

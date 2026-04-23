# Obsidian Graph Intelligence

A clean, dark-first React component system designed to be embedded into an Obsidian plugin panel.

## Project Structure

```
src/
├── App.tsx              # Dev preview entry (placeholder data)
├── main.tsx             # React DOM mount
├── index.css            # Tailwind + custom Obsidian theme tokens
├── ui/                  # All reusable UI components
│   ├── index.ts         # Barrel exports
│   ├── types.ts         # Shared TypeScript interfaces
│   ├── GraphDashboard.tsx   # Root component
│   ├── StatsOverview.tsx
│   ├── SearchBar.tsx
│   ├── OrphanNotesList.tsx
│   ├── ClusterList.tsx
│   └── SuggestionsPanel.tsx
├── core/                # Reserved — graph analysis logic
│   └── index.ts
└── plugin/              # Reserved — Obsidian plugin integration
    └── index.ts
```

## Quick Start

```bash
npm install
npm run dev
```

## Design Principles

- **Props-driven**: All components accept data via props — no internal fetching or global state.
- **Isolated & reusable**: Each component is self-contained with typed interfaces.
- **Single root**: `GraphDashboard` composes the entire UI and is the only component the plugin needs to mount.
- **Obsidian-native theming**: Custom CSS variables (`--color-obs-*`) match Obsidian's dark palette.

## Component API

Import everything from the barrel:

```tsx
import { GraphDashboard } from './ui';
import type { GraphDashboardProps, VaultStats } from './ui';
```

### `<GraphDashboard>` Props

| Prop                  | Type                         | Required |
|-----------------------|------------------------------|----------|
| `stats`               | `VaultStats`                 | ✅       |
| `orphans`             | `OrphanNote[]`               | ✅       |
| `clusters`            | `Cluster[]`                  | ✅       |
| `suggestions`         | `Suggestion[]`               | ✅       |
| `onSearch`            | `(query: string) => void`    | ❌       |
| `onSuggestLinks`      | `(noteId: string) => void`   | ❌       |
| `onAcceptSuggestion`  | `(id: string) => void`       | ❌       |
| `onDismissSuggestion` | `(id: string) => void`       | ❌       |

<div align="center">

# 🧠 Obsidian Graph Intelligence

**AI-powered graph analysis, semantic similarity, and intelligent link suggestions for your Obsidian vault.**

[![Version](https://img.shields.io/badge/version-0.1.0-blue?style=flat-square)](https://github.com/obsidian-graph-intelligence)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.0%2B-7c3aed?style=flat-square&logo=obsidian&logoColor=white)](https://obsidian.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE.md)

<br/>

*Turn your vault into an intelligent, self-improving knowledge graph.*

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📊 **Structural Analysis** | Parses every note in your vault and builds a directed graph from wikilinks |
| 🏝️ **Orphan Detection** | Finds isolated notes with no incoming or outgoing connections |
| 🔗 **Cluster Discovery** | Identifies connected components via BFS to reveal topic groupings |
| 🧬 **Semantic Similarity** | Local embeddings via Transformers.js — finds notes that *should* be linked |
| 🧠 **Knowledge Gaps** | Discovers missing conceptual bridges, orphan matches, and weakly-linked clusters |
| 🤖 **AI Reasoning** | Optional LLM layer for natural language questions about your vault |
| 🔒 **Privacy-First** | Semantic analysis runs entirely locally. LLM only sees structured summaries — never raw content |

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph Core["📦 Core Engine"]
        Parser["parser.ts<br/>Vault → NoteNode[]"]
        Graph["graph.ts<br/>NoteNode[] → Graph"]
        Queries["queries.ts<br/>Orphans · Links · Clusters"]
    end

    subgraph Semantic["🧬 Semantic Engine"]
        Embeddings["embeddings.ts<br/>Transformers.js"]
        Cache["cache.ts<br/>Persistent JSON"]
        Similarity["similarity.ts<br/>Cosine Similarity"]
    end

    subgraph Gap["🧠 Gap Detection"]
        Detector["gapDetector.ts<br/>Concepts & Bridges"]
    end

    subgraph LLM["🤖 LLM Layer (Optional)"]
        Orchestrator["orchestrator.ts<br/>Query Coordinator"]
        Prompts["prompts.ts<br/>Intent + Context"]
        Providers["providers/<br/>Ollama · OpenAI<br/>OpenRouter · Anthropic"]
    end

    subgraph UI["🎨 UI Dashboard"]
        Dashboard["GraphDashboard.tsx"]
        Stats["StatsOverview"]
        Orphans["OrphanNotesList"]
        Clusters["ClusterList"]
        Suggestions["SuggestionsPanel"]
        Gaps["KnowledgeGapsPanel"]
        AIInput["LLMQueryInput"]
        AIInsights["LLMInsightsPanel"]
    end

    Plugin["main.ts<br/>GraphIntelligenceView"]

    Parser --> Graph --> Queries
    Queries --> Plugin
    Embeddings --> Cache --> Similarity
    Similarity --> Plugin
    Queries -.-> Detector
    Similarity -.-> Detector
    Detector --> Plugin
    Plugin --> Dashboard
    Plugin --> Orchestrator
    Orchestrator --> Prompts --> Providers
    Dashboard --> Stats & Orphans & Clusters & Suggestions & Gaps & AIInput & AIInsights
```

---

## 📂 Project Structure

```
obsidian-graph-intelligence/
├── manifest.json                # Obsidian plugin manifest
├── styles.css                   # All styles (scoped under .ogi-root)
├── esbuild.config.mjs           # Build configuration
├── package.json
├── tsconfig.json
│
├── src/
│   ├── main.ts                  # Plugin entry — registers view + commands
│   │
│   ├── core/                    # Graph analysis engine
│   │   ├── types.ts             # NoteNode, Edge, Graph
│   │   ├── parser.ts            # Vault → NoteNode[] (wikilinks, tags, snippets)
│   │   ├── graph.ts             # NoteNode[] → directed Graph
│   │   ├── queries.ts           # Orphans, links, clusters (BFS)
│   │   └── index.ts             # Barrel exports
│   │
│   ├── semantic/                # Local embedding pipeline
│   │   ├── embeddings.ts        # Transformers.js (Xenova/all-MiniLM-L6-v2)
│   │   ├── cache.ts             # Persistent JSON cache
│   │   └── similarity.ts        # Cosine similarity + link suggestions
│   │
│   ├── gap/                     # Knowledge Gap Detection
│   │   ├── gapTypes.ts          # Gap definitions and thresholds
│   │   └── gapDetector.ts       # Structural + semantic gap logic
│   │
│   ├── llm/                     # Optional LLM reasoning layer
│   │   ├── types.ts             # LLMSettings, Provider interface, GraphContext
│   │   ├── orchestrator.ts      # Query lifecycle, AbortController, caching
│   │   ├── prompts.ts           # System prompt, intent parsing, context serialization
│   │   ├── settings-service.ts  # Isolated persistence (Obsidian saveData)
│   │   ├── providers/
│   │   │   ├── ollama.ts        # Local Ollama (default)
│   │   │   ├── openai.ts        # OpenAI Chat Completions
│   │   │   ├── openrouter.ts    # OpenRouter (OpenAI-compatible)
│   │   │   └── anthropic.ts     # Anthropic Messages API
│   │   └── index.ts
│   │
│   ├── plugin/                  # Obsidian integration
│   │   ├── GraphIntelligenceView.tsx  # ItemView + React mount + pipelines
│   │   └── index.ts
│   │
│   └── ui/                      # React components (props-driven)
│       ├── types.ts             # DashboardData contract + component props
│       ├── GraphDashboard.tsx   # Root layout
│       ├── StatsOverview.tsx    # Stats cards
│       ├── SearchBar.tsx        # Local filtering
│       ├── ClusterList.tsx      # Connected components
│       ├── OrphanNotesList.tsx  # Orphan notes
│       ├── SuggestionsPanel.tsx # Semantic suggestions
│       ├── KnowledgeGapsPanel.tsx # Gap visualizations
│       ├── LLMQueryInput.tsx    # AI query input (separate from search)
│       ├── LLMInsightsPanel.tsx # AI response display with collapsible dropdown
│       ├── LLMSettingsPanel.tsx # Provider configuration
│       ├── ErrorBoundary.tsx    # React error boundary
│       └── index.ts
│
└── main.js                      # Built bundle (generated)
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Obsidian](https://obsidian.md/) 1.0+
- (Optional) [Ollama](https://ollama.ai/) for local AI reasoning

### Installation

```bash
# Clone the repository
git clone https://github.com/obsidian-graph-intelligence.git
cd obsidian-graph-intelligence

# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Production build
npm run build

# Type check
npm run lint
```

### Install in Obsidian

1. Run `npm run build`
2. Copy these files into `<vault>/.obsidian/plugins/graph-intelligence/`:
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. Enable the plugin in **Settings → Community Plugins**
4. Click the 🧠 icon in the ribbon, or use the command palette: **"Open Graph Intelligence Dashboard"**

---

## 🤖 AI Reasoning (Optional)

The LLM layer is **completely optional**. The plugin works fully without it — structural analysis and semantic similarity run locally by default.

### How It Works

```mermaid
sequenceDiagram
    participant User
    participant UI as Dashboard UI
    participant Orch as Orchestrator
    participant Prompt as Prompt Engine
    participant LLM as LLM Provider

    User->>UI: "What am I missing in my vault?"
    UI->>Orch: query(userText, dashboardData, settings)
    Orch->>Orch: validateSettings()
    Orch->>Orch: buildSafeContext(dashboardData)
    Note over Orch: Only titles, counts,<br/>cluster summaries.<br/>Never raw content.
    Orch->>Prompt: parseIntent() + buildQueryPrompt()
    Orch->>LLM: generateText(prompt, AbortSignal)
    LLM-->>Orch: response text
    Orch->>Orch: validateResponse(response, knownTitles)
    Orch-->>UI: LLMInsight { query, response, validated }
    UI-->>User: Rendered insight with "AI-generated" badge
```

### Supported Providers

| Provider | Type | Auth | Default Model |
|----------|------|------|---------------|
| **Ollama** | Local | None | `llama3.2` |
| **OpenAI** | Cloud | API Key | `gpt-4o-mini` |
| **OpenRouter** | Cloud | API Key | `llama-3.1-8b-instruct:free` |
| **Anthropic** | Cloud | API Key | `claude-3-sonnet` |

All model names are **user-configurable** — nothing is hardcoded.

### Safety Guarantees

| Principle | Implementation |
|-----------|---------------|
| 🔒 **No raw content** | LLM only receives `GraphContext` — titles, counts, cluster summaries |
| 🎯 **Intent classification** | Keyword-based, deterministic — no LLM needed for routing |
| ✅ **Output validation** | Quoted note references checked against known vault titles |
| 🚫 **Hallucination guard** | System prompt explicitly forbids fabricating note titles |
| ⚡ **Non-blocking** | All LLM calls are async with `AbortController` cancellation |
| 📏 **Context limits** | Hard caps: 20 orphan titles, 5 clusters, 5 titles/cluster, 10 similar pairs |

---

## 🧬 Semantic Engine

The semantic pipeline runs **entirely locally** using [Transformers.js](https://huggingface.co/docs/transformers.js):

- **Model**: `Xenova/all-MiniLM-L6-v2` (loaded lazily on first use)
- **Cache**: Embeddings persisted in a JSON file inside the plugin directory
- **Background processing**: Batch processing in groups of 5 with UI thread yielding
- **Orphan priority**: Orphan notes are processed first for faster insight generation

---

## 📊 Data Flow

```mermaid
graph LR
    A["Obsidian Vault<br/>(Markdown Files)"] --> B["Parser<br/>(cachedRead)"]
    B --> C["Graph Builder<br/>(Nodes + Edges)"]
    C --> D["Query Engine<br/>(Orphans, Clusters, Links)"]
    D --> E["Dashboard Data"]
    
    A --> F["Embedding Pipeline<br/>(Transformers.js)"]
    F --> G["Similarity Engine<br/>(Cosine Distance)"]
    G --> E
    
    E --> H["React Dashboard"]
    E -.->|"Optional"| I["LLM Orchestrator"]
    I -.-> H
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **TypeScript 5.8** | Type-safe development |
| **React 19** | Component-based UI |
| **esbuild** | Fast bundling with watch mode |
| **Transformers.js** | Local ML embeddings |
| **Lucide React** | Icon system |
| **Obsidian API** | Plugin integration |

**Zero runtime dependencies for LLM** — all providers use native `fetch()`.

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on the development process, coding standards, and how to submit pull requests.

## 🔒 Security

For security concerns and responsible disclosure, please see our [Security Policy](./SECURITY.md).

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE.md) file for details.

---

<div align="center">

**Built with ❤️ for the Obsidian community**

[Report Bug](https://github.com/obsidian-graph-intelligence/issues) · [Request Feature](https://github.com/obsidian-graph-intelligence/issues) · [Discussions](https://github.com/obsidian-graph-intelligence/discussions)

</div>

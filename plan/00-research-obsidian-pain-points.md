# Research: What Obsidian Users Actually Struggle With

Synthesis of community discussion, plugin-popularity signals, and published critiques (June 2026).
The goal is to ground every v0.2 feature in a *documented* pain, not a guess.

## The recurring pain points

### 1. Vaults rot into a "second junk drawer"
The single most common complaint. As a vault grows, users can no longer find their own notes.
Vaults fill with **"ghost notes"** — untitled captures and one-sentence drafts that never get
finished and never get deleted. Search degrades because the signal is buried in throwaway files.

> *"Obsidian is not a set-it-and-forget-it tool... preventing it from grinding to a halt means
> manually archiving old notes and reorganizing structure."*

**Implication for us:** there is appetite for *automated, safe vault maintenance* — exactly the
"Fix My Vault / Apply All" space we already occupy. We should make maintenance feel rewarding
instead of like a chore.

### 2. The graph view is beautiful and almost useless
Universally praised as pretty, widely dismissed as impractical past ~200 notes — "a tangled web
that's more fun to look at than to navigate." The structural complaints are specific and consistent:

- It shows *connections* but never *priority, status, or what you need right now*.
- You **cannot filter** by date modified, tag, or frontmatter without extra plugins.
- You **cannot edit a note** or **create a connection** from inside the graph.
- It does not work as a *navigation layer* for a mature vault — only as an occasional diagnostic.

Community workarounds (Excalibrain, etc.) exist precisely because the native graph leaves a gap.

**Implication for us:** an *interactive, filterable, action-capable* graph is a wide-open,
high-visibility opportunity — and we already compute the richer data (clusters, orphans, hubs,
typed confidence edges) that the native graph lacks.

### 3. Good notes get forgotten
Power users, researchers, and writers capture ideas fast but "later struggle to find and connect
them when it matters most, with valuable insights disappearing in a sea of unlinked notes." The
most-loved AI tools (Mem, Smart Connections) win by **surfacing related notes based on current
context, without being asked.**

**Implication for us:** we already compute embeddings + similarity + knowledge gaps. A
*rediscovery* surface (recency-aware, "you wrote this 8 months ago and it's relevant now") is a
small reach from what exists.

### 4. Maintenance + plugin sprawl is exhausting
Users start with a few plugins and end up babysitting dozens — compatibility breaks, layout
fiddling, manual reorg. The customization that attracts people becomes the thing that burns them out.

**Implication for us:** consolidate. One plugin that *measures* vault health and *does the
maintenance* is more valuable than another single-purpose plugin to maintain.

### 5. People want AI in the vault — but local and private
Demand for auto-linking, semantic surfacing, auto-tagging, and "chat with my vault" is strong and
growing. But Obsidian ships no native AI by deliberate stance, and users are wary of sending notes
to third-party APIs. The decisive feature of the category leader is **"local embedding model, zero
setup, no API key, nothing leaves your machine."**

**Implication for us:** our local-first Transformers.js stack and opt-in LLM layer are exactly the
right posture. Lead with local; make cloud LLM strictly optional.

## What the popular plugins teach us

| Plugin | Downloads (early 2026) | Why people love it | What we learn |
|--------|------------------------|--------------------|----------------|
| **Smart Connections** | ~786k | Local embeddings, zero setup, no API key, surfaces related notes *while you write* | Local-first + zero-config is non-negotiable. We must match the "no setup" bar. |
| **Dataview** | top-installed | Turns the vault into a queryable living database; **reads, never mutates**; data stays plain markdown | Respecting plain-markdown and never silently mutating builds trust. Better metadata (tags) makes Dataview more powerful — a synergy, not a competition. |

**Our differentiated position:** Smart Connections answers *"what's related to this note?"* one note
at a time. We answer *"how healthy is my whole vault, and what should I fix?"* — and then we fix it.
That whole-vault, structural-health-plus-repair angle is ours to own.

## How each pain maps to a v0.2 feature

| Pain point | Feature | Doc |
|------------|---------|-----|
| Maintenance is a thankless chore; no sense of progress | Vault Health Score & Trends | [01](./01-feature-vault-health-score.md) |
| Good notes get forgotten | Note Rediscovery / Resurface | [02](./02-feature-note-rediscovery.md) |
| Junk-drawer vault; can't find anything | Auto-Tagging & Smart Metadata | [03](./03-feature-auto-tagging.md) |
| Graph view is useless past ~200 notes | Interactive Health Graph View | [04](./04-feature-interactive-graph-view.md) |
| Want to ask the vault, but keep it private | Chat with your Graph (graph-aware RAG) | [05](./05-feature-chat-with-graph.md) |

## Sources

- [Obsidian's Graph View Is Beautiful and Almost Completely Useless — Code Culture](https://codeculture.store/blogs/developer-culture/obsidian-graph-view-useful)
- [10 Problems with Obsidian You'll Realize When It's Too Late — Theo James, Medium](https://medium.com/@theo-james/10-problems-with-obsidian-youll-realize-when-it-s-too-late-17e903886847)
- [3 things I wish I knew before creating my first Obsidian Vault — XDA](https://www.xda-developers.com/wish-knew-first-obsidian-vault-setup/)
- [I set up my Obsidian vault to organize itself — XDA](https://www.xda-developers.com/set-up-obsidian-vault-to-organize-itself-havent-touched-folder-structure-in-weeks/)
- [Smart Connections — GitHub (brianpetro)](https://github.com/brianpetro/obsidian-smart-connections)
- [Adding AI to your Obsidian Notes with SmartConnections and CoPilot — The Effortless Academic](https://effortlessacademic.com/adding-ai-to-your-obsidian-notes-with-smartconnections-and-copilot/)
- [Best Obsidian AI Plugin Tools: Smart Note Linking and Auto-Tagging with Local LLMs (2025) — Sean Kim](https://blog.imseankim.com/obsidian-ai-plugin-smart-note-linking-auto-tagging-local-llm/)
- [Dataview — GitHub (blacksmithgu)](https://github.com/blacksmithgu/obsidian-dataview)
- [Obsidian Dataview: The Complete Guide (2026) — Obsibrain](https://www.obsibrain.com/blog/obsidian-dataview-complete-guide)
- [Obsidian + AI in 2025: Smart Connections vs. Copilot vs. Claude Code — Code Culture](https://codeculture.store/blogs/developer-culture/obsidian-ai-plugin-comparison-2025)

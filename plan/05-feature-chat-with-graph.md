# P5 — Chat with your Graph (graph-aware RAG)

**Priority: 5 (build last) · Effort: Large · Risk: Medium · Depends on: P1 metrics, P3 tags, existing MCP + context + LLM layers**

## The problem
"Chat with your vault" is one of the most-requested AI capabilities — but users are wary of shipping
their notes to a third-party API, and generic RAG chat is already crowded (Copilot, etc.). What
*nobody* does well is **graph-aware** answering: questions about your vault's *structure* —
"What are my biggest knowledge gaps?", "Which clusters are under-developed?", "What should I link
to this note?", "Summarize my thinking on X across the vault." That's the question class our graph
engine is uniquely positioned to answer.

## The idea
A chat panel that answers questions grounded in **graph structure + compressed context**, not just
raw note text. It routes a question to the right grounding:
- *Structural* questions ("biggest gaps", "weak clusters", "orphans about X") are answered from our
  analysis via the **MCP query layer** — these can even be answered *without* an LLM for simple cases.
- *Content* questions ("what did I conclude about X") use the **context-compression** pack
  (`short`/`medium`/`detailed`) as grounding for the LLM, staying within a token budget.
- Answers cite the notes they came from (clickable), so it's auditable, not a black box.

## Why it fits our architecture
- The hard parts already exist: **`src/mcp`** (structured, security-gated graph queries — never
  dumps raw content), **`src/context`** (token-budgeted vault compression), **`src/llm`**
  (multi-provider orchestrator incl. local Ollama, with `sanitizeForPrompt`).
- This feature is largely *composition + routing + a chat UI* over those three layers, plus citation
  rendering.
- Local-first honored: structural answers need no LLM; content answers default to the local Ollama
  provider when configured. Cloud providers stay strictly opt-in.

## Scope
**MVP:** chat panel answering structural questions through MCP (works with zero LLM), plus
LLM-grounded content answers using the medium context pack, with source citations.
**v0.2 stretch:** conversation memory across turns; "suggest links for this note, explained";
follow-up that triggers an Apply action ("link these for me" -> existing actions).
**Explicitly out:** sending raw note bodies to a cloud API by default; any non-opt-in cloud call;
returning unbounded context (must respect the existing token budget and never fail on overflow).

## Risks & mitigations
- *Privacy.* Mitigation: local Ollama as the recommended path; explicit opt-in + clear disclosure
  before any cloud call; reuse MCP's "structured summaries only, never raw content" guarantee for
  structural answers.
- *Hallucination.* Mitigation: always cite source notes; prefer deterministic MCP answers for
  structural questions; ground content answers strictly in the context pack.
- *Cost.* Mitigation: token budget enforced by the existing context-compression layer; show
  estimated context size before sending.

## Acceptance criteria
- Structural questions return correct, cited answers with **no LLM configured**.
- Content questions are grounded in the compressed context pack and cite their sources.
- No raw note content or embeddings ever leave the machine unless the user has opted into a cloud
  provider and confirmed.
- `npm run lint` passes; MCP security gates and token budgets are respected.

## Contributor surface (good first issues / scoped chunks)
- The intent router (classify a question as structural vs content) — isolated, testable-by-reasoning.
- Wire one new MCP-backed answer type (e.g. "weakest clusters") end to end.
- The chat UI with citation chips (props-only component).
- The "explain this suggested link" responder.

# P2 — Note Rediscovery / Resurface

**Priority: 2 · Effort: Medium · Risk: Low-Medium · Depends on: existing semantic + learning layers**

## The problem
Users capture ideas fast, then those ideas vanish. "Valuable insights disappear in a sea of
unlinked notes." The notes that hurt most to lose are the *old, forgotten, still-relevant* ones —
exactly the ones a keyword search never resurfaces because you've forgotten the keywords.

This is the sweet spot that made Smart Connections the category leader. We can match its
"related notes" core *and* add a twist it doesn't emphasize: **recency-aware rediscovery** — "you
wrote this 8 months ago and forgot about it, but it's relevant to what you're working on now."

## The idea
A lightweight **Resurface** panel with two modes:
1. **Contextual** — given the active note, show the most semantically related notes, *weighted to
   favor notes that are old and currently unlinked* (so it surfaces forgotten gems, not the three
   notes you already linked yesterday).
2. **Daily digest** — a "rediscover from your vault" list: a small rotating set of stale-but-
   high-value notes to revisit, regardless of the active note.

Each item offers one-click **Link** (reusing existing actions) and **Dismiss** (feeding the
learning engine so we stop showing things the user keeps rejecting).

## Why it fits our architecture
- Embeddings + similarity already exist (`src/semantic`, `computeEmbedding`, `findSimilarNotes`).
- The recency/forgotten weighting is a small scoring function layered on similarity:
  `score = similarity * recencyDecay(lastModified) * (unlinked ? boost : 1)`.
- Accept/Dismiss is precisely what `src/learning` was built for — wire Resurface events into the
  existing feedback store so weights improve over time.
- Linking reuses `src/actions`. No new mutation paths.
- New presentational `<ResurfacePanel />` in `src/ui`; the view computes candidates and passes them down.

## Scope
**MVP:** contextual mode for the active note, with recency+unlinked weighting, Link + Dismiss.
**v0.2 stretch:** daily digest mode; "why surfaced" explanation chip (shared similarity + age).
**Explicitly out:** real-time recompute on every keystroke (debounce / on-note-open only — keep it
off the hot path).

## Risks & mitigations
- *Perf with large vaults.* Mitigation: reuse the persisted semantic cache; only embed the active
  note on demand; cap candidate set; run async behind `semanticRunId` like the existing pipeline.
- *"It just shows obvious stuff."* Mitigation: the unlinked + recency-decay weighting is the whole
  point — tune it so already-linked / recently-touched notes are de-prioritized.

## Acceptance criteria
- Opening a note populates the panel without blocking the editor.
- Surfaced notes skew toward old + unlinked + relevant, not toward already-linked neighbors.
- Link and Dismiss both work and Dismiss visibly influences future suggestions.
- Works fully offline with the local embedding model; `npm run lint` passes.

## Contributor surface (good first issues)
- Implement and tune the `recencyDecay` curve (isolated pure function + tests-by-reasoning).
- Build the `<ResurfacePanel />` component and its loading/empty/error states.
- Add the "why surfaced" explanation chip.
- Wire the daily-digest rotation selector.

# P3 — Auto-Tagging & Smart Metadata

**Priority: 3 · Effort: Medium · Risk: Medium · Depends on: P1 (feeds Discoverability score)**

## The problem
Junk-drawer vaults are unsearchable because the notes have no consistent metadata. Manually tagging
hundreds of notes is exactly the maintenance chore people avoid. Meanwhile **Dataview** — one of the
most-installed plugins — only becomes powerful when notes *have* good tags and frontmatter. Better
metadata multiplies the value of tooling the user already runs.

## The idea
Suggest tags and frontmatter for under-described notes, then apply them **safely in batch** through
the same preview-and-Apply pattern we already use for link repair. Two engines:
1. **Local (default):** cluster membership + embedding neighborhoods + existing-tag vocabulary →
   suggest tags from the vault's *own* tag taxonomy (so we reinforce the user's scheme, not invent a
   competing one). Zero API key, fully offline.
2. **LLM (opt-in):** when the assistant is configured, generate richer tags / one-line summaries /
   suggested titles for ghost notes via the existing orchestrator.

## Why it fits our architecture
- Tagging is a **vault mutation**, so it lives in **`src/actions/`** (new `applyTags` action
  returning `ActionResult`) — never in components. This is the hard architectural rule and this
  feature respects it cleanly.
- Batch apply slots into the existing **Apply All / fix-plan** machinery in
  `GraphIntelligenceView.tsx`; tag suggestions become a new fix-plan item type in `src/fix`.
- Local suggestions reuse clusters (`src/core`) + embeddings (`src/semantic`).
- LLM path reuses `src/llm` orchestrator + `sanitizeForPrompt`; stays opt-in per CLAUDE.md.
- Accept/reject feeds `src/learning`.

## Scope
**MVP:** local tag suggestions drawn from the vault's existing tag vocabulary, per-note preview,
batch apply, undo-friendly (write to frontmatter only, never touch body).
**v0.2 stretch:** LLM-generated tags + ghost-note title/summary suggestions; "tag consolidation"
(detect near-duplicate tags like `#ml` / `#machine-learning` and propose a merge).
**Explicitly out:** auto-applying tags without a preview. Every write is reviewed first.

## Risks & mitigations
- *Frontmatter corruption.* **Highest-risk item in v0.2.** Mitigation: parse/serialize frontmatter
  with a single well-tested helper; only ever add to the `tags` field; preserve all other keys and
  formatting; dry-run diff shown before any write; never edit note body.
- *Tag spam / over-tagging.* Mitigation: cap suggestions per note; confidence threshold; prefer
  existing tags over new ones.
- *LLM cost/privacy.* Mitigation: strictly opt-in, local engine is the default and is always offered.

## Acceptance criteria
- Local mode works with no API key and suggests only sensible tags from the vault's own vocabulary.
- Applying tags modifies *only* frontmatter `tags`, leaving every other byte of the file intact
  (verified by manual diff on a test vault).
- Preview is mandatory before batch apply; rejections feed the learning engine.
- `npm run lint` passes; the action lives in `src/actions`, the suggestion logic stays Obsidian-free.

## Contributor surface (good first issues)
- Build the safe frontmatter add-tags helper (pure, the most valuable isolated unit here).
- Implement the local "suggest from existing vocabulary" heuristic.
- Implement near-duplicate tag detection (string + embedding similarity).
- Build the tag-suggestion preview UI row with accept/reject.

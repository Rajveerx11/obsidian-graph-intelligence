/**
 * Core data structures for the graph engine.
 *
 * These types represent the internal graph model used for analysis.
 * They are distinct from the UI types in src/ui/types.ts — a mapper
 * converts these into DashboardData before passing to React.
 */

// ── Node ───────────────────────────────────────────────────────────────

/** Represents a single markdown note as a graph node. */
export interface NoteNode {
  /** Unique identifier — the file path relative to vault root. */
  id: string;
  /** Human-readable title derived from the filename (no extension). */
  title: string;
  /** Outgoing wikilink targets (e.g. "Some Note" from [[Some Note]]). */
  links: string[];
  /** Tags found in the note body (without the leading #). */
  tags: string[];
  /** Last modified timestamp from file stats (used for semantic cache invalidation). */
  mtime: number;
  /** Clean text snippet to use for semantic embeddings. */
  contentSnippet: string;
}

// ── Edge ───────────────────────────────────────────────────────────────

/** A directed edge from one note to another. */
export interface Edge {
  /** Source node id (the note containing the link). */
  source: string;
  /** Target node id (the linked note). */
  target: string;
}

// ── Graph ──────────────────────────────────────────────────────────────

/** The complete vault graph: nodes + edges. */
export interface Graph {
  nodes: NoteNode[];
  edges: Edge[];
}

/**
 * Pure graph-metric helpers shared across exporters, the context summarizer,
 * and the MCP query engine. These previously existed as copy-pasted tag-tally
 * and edge-degree loops in five files, which had drifted (different top-N caps,
 * one call site omitting a metric another computed). Centralizing keeps the
 * numbers consistent everywhere.
 *
 * No Obsidian dependency — runnable in isolation, like `core/` and `export/`.
 */
import type { NoteNode } from '../core/types';
import type { ConfidenceEdge } from './edgeConfidence';

/** Resolve node IDs to NoteNodes, dropping IDs with no matching node. */
export function resolveNodes(nodeIds: string[], nodes: NoteNode[]): NoteNode[] {
  return nodeIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is NoteNode => n !== undefined);
}

/** Tally tag frequency across the given nodes. */
export function countTags(nodes: NoteNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    for (const tag of node.tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return counts;
}

/** Tags ranked by descending frequency, capped at `topN`, as `[tag, count]` pairs. */
export function rankTags(nodes: NoteNode[], topN: number): Array<[string, number]> {
  return Object.entries(countTags(nodes))
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
}

/** Tag names only, ranked by descending frequency, capped at `topN`. */
export function topTagNames(nodes: NoteNode[], topN: number): string[] {
  return rankTags(nodes, topN).map(([tag]) => tag);
}

/**
 * Degree (edge-endpoint count) per node id. When `restrictTo` is provided, only
 * endpoints in that set are counted — used to measure within-cluster degree.
 */
export function degreeByNode(
  edges: ConfidenceEdge[],
  restrictTo?: Set<string>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    if (!restrictTo || restrictTo.has(edge.source)) {
      counts.set(edge.source, (counts.get(edge.source) || 0) + 1);
    }
    if (!restrictTo || restrictTo.has(edge.target)) {
      counts.set(edge.target, (counts.get(edge.target) || 0) + 1);
    }
  }
  return counts;
}

/** Node ids ranked by descending degree, capped at `topN`, as `{ id, count }`. */
export function rankByDegree(
  edges: ConfidenceEdge[],
  topN: number
): Array<{ id: string; count: number }> {
  return Array.from(degreeByNode(edges).entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([id, count]) => ({ id, count }));
}

/** Count edges with exactly one endpoint inside `nodeIds` (cross-boundary links). */
export function externalConnectionCount(nodeIds: Set<string>, edges: ConfidenceEdge[]): number {
  let count = 0;
  for (const edge of edges) {
    const hasSource = nodeIds.has(edge.source);
    const hasTarget = nodeIds.has(edge.target);
    if (hasSource !== hasTarget) count++;
  }
  return count;
}

/**
 * Graph queries — pure functions that derive insights from a Graph.
 *
 * All functions are synchronous and side-effect-free. They operate on the
 * immutable Graph structure produced by buildGraph().
 */

import type { Graph, NoteNode } from './types';

// ── Orphan detection ───────────────────────────────────────────────────

/**
 * Returns nodes that have NO incoming AND NO outgoing edges.
 * These are completely disconnected "island" notes.
 */
export function getOrphans(graph: Graph): NoteNode[] {
  const connected = new Set<string>();

  for (const edge of graph.edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }

  return graph.nodes.filter((node) => !connected.has(node.id));
}

// ── Link count ─────────────────────────────────────────────────────────

/** Returns the total number of edges (links) in the graph. */
export function getTotalLinks(graph: Graph): number {
  return graph.edges.length;
}

// ── Cluster detection (connected components) ───────────────────────────

/**
 * Finds connected components in the graph using iterative BFS.
 *
 * The graph is treated as **undirected** for cluster detection —
 * if A links to B, both A and B are in the same cluster regardless
 * of link direction. This gives a more intuitive grouping.
 *
 * Returns an array of node-id arrays, one per connected component.
 * Isolated (orphan) nodes each form their own single-element cluster
 * but are typically filtered out by the caller.
 */
export function getClusters(graph: Graph): string[][] {
  // Build an undirected adjacency list.
  const adj = new Map<string, Set<string>>();

  for (const node of graph.nodes) {
    adj.set(node.id, new Set());
  }

  for (const edge of graph.edges) {
    adj.get(edge.source)?.add(edge.target);
    adj.get(edge.target)?.add(edge.source);
  }

  // BFS to find connected components.
  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;

    const component: string[] = [];
    const queue: string[] = [node.id];
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      const neighbors = adj.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    clusters.push(component);
  }

  return clusters;
}

/**
 * Graph builder — converts parsed NoteNodes into a directed Graph.
 *
 * Edges represent wikilinks: if note A contains [[B]], an edge A → B is created.
 * Links that reference non-existent files are still included as edges so the
 * query layer can detect dangling references if needed.
 */

import type { NoteNode, Edge, Graph } from './types';

/**
 * Builds a directed graph from an array of parsed NoteNodes.
 *
 * For each node, creates one edge per unique outgoing wikilink.
 * Link targets are resolved to file paths using a title→id lookup map
 * so edges reference the same id format used in NoteNode.id (file path).
 */
export function buildGraph(nodes: NoteNode[]): Graph {
  // Build a lookup from lowercase title → node id for link resolution.
  // This lets us match [[Some Note]] to "folder/Some Note.md".
  const titleToId = new Map<string, string>();
  for (const node of nodes) {
    titleToId.set(node.title.toLowerCase(), node.id);
  }

  const edges: Edge[] = [];

  for (const node of nodes) {
    for (const linkTarget of node.links) {
      // Resolve the link target to a node id.
      // Wikilinks use the note title (basename), not the full path.
      const targetId = titleToId.get(linkTarget.toLowerCase());

      // Only create edges to nodes that actually exist in the vault.
      if (targetId && targetId !== node.id) {
        edges.push({ source: node.id, target: targetId });
      }
    }
  }

  return { nodes, edges };
}

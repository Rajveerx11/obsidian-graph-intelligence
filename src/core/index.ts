/**
 * Core module — graph analysis logic for the Obsidian vault.
 *
 * Public API:
 *   parseVault()  — reads vault files into NoteNode[]
 *   buildGraph()  — converts nodes into a Graph (nodes + edges)
 *   getOrphans()  — finds disconnected notes
 *   getTotalLinks() — counts total edges
 *   getClusters() — finds connected components via BFS
 */

// Types
export type { NoteNode, Edge, Graph } from './types';

// Functions
export { parseVault } from './parser';
export { buildGraph } from './graph';
export { getOrphans, getTotalLinks, getClusters } from './queries';

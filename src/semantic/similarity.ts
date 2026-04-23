/**
 * Similarity Engine
 * 
 * Computes cosine similarity between embeddings and finds similar notes.
 */
import type { Graph } from '../core/types';

/**
 * Computes the cosine similarity between two vectors.
 * Assumes vectors are already normalized. If not, it standardizes them.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct; // Since vectors from Xenova are normalized (pooling='mean', normalize=true)
}

export interface SimilarityResult {
  targetId: string;
  score: number;
}

/**
 * Finds the top N similar notes for a given target note, excluding:
 * - The target note itself
 * - Notes that are already linked in the graph (either direction)
 * - Notes below the similarity threshold
 */
export function findSimilarNotes(
  sourceId: string,
  embeddingsMap: Map<string, number[]>,
  graph: Graph,
  threshold: number = 0.75,
  topN: number = 3
): SimilarityResult[] {
  const sourceVec = embeddingsMap.get(sourceId);
  if (!sourceVec) return [];

  // Find all existing links for this node to exclude them
  const existingLinks = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source === sourceId) existingLinks.add(edge.target);
    if (edge.target === sourceId) existingLinks.add(edge.source);
  }

  const results: SimilarityResult[] = [];

  for (const [targetId, targetVec] of embeddingsMap.entries()) {
    // Exclude self and already linked notes
    if (targetId === sourceId || existingLinks.has(targetId)) continue;

    const score = cosineSimilarity(sourceVec, targetVec);
    if (score >= threshold) {
      results.push({ targetId, score });
    }
  }

  // Sort descending by score and take top N
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}

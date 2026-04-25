/**
 * Knowledge Gap Detector
 *
 * Pure function that identifies structural and semantic weaknesses
 * in the knowledge graph. Operates entirely on pre-computed data —
 * no LLM calls, no embedding recomputation.
 *
 * Three detection strategies:
 *   1. Cluster gaps  — semantically similar clusters with weak connectivity
 *   2. Orphan gaps   — orphan notes semantically close to an existing cluster
 *   3. Concept gaps  — related cluster pairs with no bridging node
 */

import type { Graph, NoteNode } from '../core/types';
import { cosineSimilarity } from '../semantic/similarity';
import type { KnowledgeGap } from './gapTypes';

// ── Thresholds ─────────────────────────────────────────────────────────

const CLUSTER_SIMILARITY_THRESHOLD = 0.65;
const CLUSTER_MAX_CROSS_EDGES = 2;
const ORPHAN_SIMILARITY_THRESHOLD = 0.60;
const MAX_TOTAL_GAPS = 15;

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Computes the centroid (mean) embedding for a set of note IDs.
 * Returns null if none of the notes have embeddings.
 */
function computeCentroid(
  noteIds: string[],
  embeddingsMap: Map<string, number[]>,
): number[] | null {
  const vectors: number[][] = [];
  for (const id of noteIds) {
    const vec = embeddingsMap.get(id);
    if (vec && vec.length > 0) vectors.push(vec);
  }
  if (vectors.length === 0) return null;

  const dim = vectors[0].length;
  const centroid = new Array<number>(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += vec[i];
    }
  }

  // Normalize to unit length (so cosineSimilarity works correctly)
  let magnitude = 0;
  for (let i = 0; i < dim; i++) {
    centroid[i] /= vectors.length;
    magnitude += centroid[i] * centroid[i];
  }
  magnitude = Math.sqrt(magnitude);
  if (magnitude > 0) {
    for (let i = 0; i < dim; i++) {
      centroid[i] /= magnitude;
    }
  }

  return centroid;
}

/**
 * Counts the number of edges that cross between two clusters.
 */
function countCrossEdges(
  clusterA: Set<string>,
  clusterB: Set<string>,
  graph: Graph,
): number {
  let count = 0;
  for (const edge of graph.edges) {
    if (
      (clusterA.has(edge.source) && clusterB.has(edge.target)) ||
      (clusterB.has(edge.source) && clusterA.has(edge.target))
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Checks whether any node in the graph links to nodes in both clusters,
 * acting as a conceptual bridge between them.
 */
function hasBridgingNode(
  clusterA: Set<string>,
  clusterB: Set<string>,
  graph: Graph,
): boolean {
  // Build adjacency (undirected) for quick neighbor lookup
  const adj = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    adj.set(node.id, new Set());
  }
  for (const edge of graph.edges) {
    adj.get(edge.source)?.add(edge.target);
    adj.get(edge.target)?.add(edge.source);
  }

  for (const [nodeId, neighbors] of adj) {
    // A bridging node is NOT in either cluster but links to both
    if (clusterA.has(nodeId) || clusterB.has(nodeId)) continue;

    let touchesA = false;
    let touchesB = false;
    for (const n of neighbors) {
      if (clusterA.has(n)) touchesA = true;
      if (clusterB.has(n)) touchesB = true;
      if (touchesA && touchesB) return true;
    }
  }

  return false;
}

/**
 * Resolves a note ID to a human-readable title.
 * Falls back to the raw ID if the node isn't found.
 */
function resolveTitle(noteId: string, idToTitle: Map<string, string>): string {
  return idToTitle.get(noteId) ?? noteId;
}

// ── Confidence Scoring ─────────────────────────────────────────────────

/**
 * Computes a confidence score for a gap.
 *
 *   confidence = 0.5 × similarity
 *              + 0.3 × (1 − edgeRatio)      // fewer edges → higher confidence
 *              + 0.2 × supportFactor         // more involved notes → higher
 *
 * Clamped to [0, 1].
 */
function computeConfidence(
  similarity: number,
  crossEdges: number,
  maxExpectedEdges: number,
  involvedCount: number,
): number {
  const edgeRatio = maxExpectedEdges > 0
    ? Math.min(crossEdges / maxExpectedEdges, 1)
    : 0;

  // Support factor: more notes involved → higher weight, capped at 1
  const supportFactor = Math.min(involvedCount / 10, 1);

  const raw = 0.5 * similarity + 0.3 * (1 - edgeRatio) + 0.2 * supportFactor;
  return Math.max(0, Math.min(1, raw));
}

// ── Main Detector ──────────────────────────────────────────────────────

/**
 * Detects knowledge gaps in the vault graph.
 *
 * @param graph         - The full vault graph (nodes + edges)
 * @param clusters      - Connected components from getClusters() (node-ID arrays)
 * @param orphanNodes   - Orphan nodes (no edges at all)
 * @param embeddingsMap - Pre-computed embeddings keyed by note ID
 * @returns Up to MAX_TOTAL_GAPS gaps, sorted by confidence descending
 */
export function detectKnowledgeGaps(
  graph: Graph,
  clusters: string[][],
  orphanNodes: NoteNode[],
  embeddingsMap: Map<string, number[]>,
): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  let idCounter = 0;

  // Build a title lookup for human-readable descriptions
  const idToTitle = new Map<string, string>();
  for (const node of graph.nodes) {
    idToTitle.set(node.id, node.title);
  }

  // Only consider multi-node clusters for cluster-level analysis
  const meaningfulClusters = clusters.filter(c => c.length >= 2);

  // Pre-compute centroids for all meaningful clusters
  const centroids: (number[] | null)[] = meaningfulClusters.map(c =>
    computeCentroid(c, embeddingsMap),
  );

  // ── 1. Cluster Gap Detection ──────────────────────────────────────

  for (let i = 0; i < meaningfulClusters.length; i++) {
    if (gaps.length >= MAX_TOTAL_GAPS) break;

    const centroidA = centroids[i];
    if (!centroidA) continue;

    for (let j = i + 1; j < meaningfulClusters.length; j++) {
      if (gaps.length >= MAX_TOTAL_GAPS) break;

      const centroidB = centroids[j];
      if (!centroidB) continue;

      const similarity = cosineSimilarity(centroidA, centroidB);
      if (similarity < CLUSTER_SIMILARITY_THRESHOLD) continue;

      const setA = new Set(meaningfulClusters[i]);
      const setB = new Set(meaningfulClusters[j]);
      const crossEdges = countCrossEdges(setA, setB, graph);

      if (crossEdges >= CLUSTER_MAX_CROSS_EDGES) continue;

      // Pick representative titles (first node of each cluster)
      const titleA = resolveTitle(meaningfulClusters[i][0], idToTitle);
      const titleB = resolveTitle(meaningfulClusters[j][0], idToTitle);

      const involvedNotes = [
        ...meaningfulClusters[i].slice(0, 3),
        ...meaningfulClusters[j].slice(0, 3),
      ];

      const maxExpectedEdges = Math.min(
        meaningfulClusters[i].length,
        meaningfulClusters[j].length,
      );

      gaps.push({
        id: `gap-cluster-${idCounter++}`,
        type: 'cluster_gap',
        description: `Clusters around "${titleA}" and "${titleB}" are semantically related (${(similarity * 100).toFixed(0)}% similar) but have ${crossEdges === 0 ? 'no' : 'very few'} connections.`,
        involvedNotes,
        confidence: computeConfidence(similarity, crossEdges, maxExpectedEdges, involvedNotes.length),
        suggestedAction: {
          type: 'link',
          details: `Link notes between these clusters to strengthen the connection.`,
        },
      });
    }
  }

  // ── 2. Orphan Gap Detection ───────────────────────────────────────

  for (const orphan of orphanNodes) {
    if (gaps.length >= MAX_TOTAL_GAPS) break;

    const orphanVec = embeddingsMap.get(orphan.id);
    if (!orphanVec || orphanVec.length === 0) continue;

    let bestSimilarity = -1;
    let bestClusterIdx = -1;

    for (let i = 0; i < meaningfulClusters.length; i++) {
      const centroid = centroids[i];
      if (!centroid) continue;

      const sim = cosineSimilarity(orphanVec, centroid);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestClusterIdx = i;
      }
    }

    if (bestSimilarity < ORPHAN_SIMILARITY_THRESHOLD || bestClusterIdx < 0) continue;

    const clusterTitle = resolveTitle(meaningfulClusters[bestClusterIdx][0], idToTitle);

    gaps.push({
      id: `gap-orphan-${idCounter++}`,
      type: 'orphan_gap',
      description: `"${orphan.title}" is an orphan note that seems related to the cluster around "${clusterTitle}" (${(bestSimilarity * 100).toFixed(0)}% similar).`,
      involvedNotes: [orphan.id, ...meaningfulClusters[bestClusterIdx].slice(0, 2)],
      confidence: computeConfidence(bestSimilarity, 0, 1, 1),
      suggestedAction: {
        type: 'link',
        details: `Link "${orphan.title}" to notes in the "${clusterTitle}" cluster.`,
      },
    });
  }

  // ── 3. Concept Gap Detection ──────────────────────────────────────

  for (let i = 0; i < meaningfulClusters.length; i++) {
    if (gaps.length >= MAX_TOTAL_GAPS) break;

    const centroidA = centroids[i];
    if (!centroidA) continue;

    for (let j = i + 1; j < meaningfulClusters.length; j++) {
      if (gaps.length >= MAX_TOTAL_GAPS) break;

      const centroidB = centroids[j];
      if (!centroidB) continue;

      const similarity = cosineSimilarity(centroidA, centroidB);
      // Concept gaps use a slightly lower threshold than cluster gaps
      if (similarity < 0.55) continue;

      const setA = new Set(meaningfulClusters[i]);
      const setB = new Set(meaningfulClusters[j]);

      // Check if clusters share any nodes (they shouldn't, but guard)
      let hasShared = false;
      for (const id of setA) {
        if (setB.has(id)) { hasShared = true; break; }
      }
      if (hasShared) continue;

      // Only flag as concept gap if there's no bridging node already
      if (hasBridgingNode(setA, setB, graph)) continue;

      // Don't duplicate with cluster_gap — skip pairs already flagged
      const crossEdges = countCrossEdges(setA, setB, graph);
      const alreadyFlaggedAsClusterGap =
        similarity >= CLUSTER_SIMILARITY_THRESHOLD && crossEdges < CLUSTER_MAX_CROSS_EDGES;
      if (alreadyFlaggedAsClusterGap) continue;

      const titleA = resolveTitle(meaningfulClusters[i][0], idToTitle);
      const titleB = resolveTitle(meaningfulClusters[j][0], idToTitle);

      gaps.push({
        id: `gap-concept-${idCounter++}`,
        type: 'concept_gap',
        description: `No bridging note connects the topics around "${titleA}" and "${titleB}". A bridge note could unify these related areas.`,
        involvedNotes: [
          meaningfulClusters[i][0],
          meaningfulClusters[j][0],
        ],
        confidence: computeConfidence(similarity, crossEdges, 3, 2),
        suggestedAction: {
          type: 'create_note',
          details: `Create a note that connects ideas from "${titleA}" and "${titleB}".`,
        },
      });
    }
  }

  // ── Sort by confidence (descending) and trim ──────────────────────

  gaps.sort((a, b) => b.confidence - a.confidence);
  return gaps.slice(0, MAX_TOTAL_GAPS);
}

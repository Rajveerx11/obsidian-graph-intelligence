/**
 * Note Rediscovery / Resurface
 *
 * Pure, Obsidian-free helpers that resurface OLD + UNLINKED + semantically
 * relevant notes. Reuses findSimilarNotes (which already excludes self and
 * already-linked notes, applies learning weights, thresholds, sorts, slices)
 * and re-ranks the candidates by similarity * ageBoost so older notes float up.
 *
 * Two anchor modes:
 *  - DIGEST: anchors are the top-K most recently modified notes; candidates are
 *    aggregated across them into one rotating list.
 *  - LIVE: anchor is the single currently-open file.
 */
import type { Graph, NoteNode } from '../core/types';
import type { LearningData } from '../learning/learningTypes';
import type { RediscoveryItem } from '../ui/types';
import { findSimilarNotes, type SimilarityResult } from './similarity';

/** Notes edited within this window are "fresh" and get no resurfacing boost. */
export const RECENCY_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
/** Lower threshold than suggestions so re-ranking has a pool to work with. */
export const REDISCOVERY_THRESHOLD = 0.45;
/** Higher topN than suggestions so re-ranking has a pool to work with. */
export const REDISCOVERY_PER_ANCHOR = 8;
/** DIGEST: number of most-recently-modified notes used as anchors. */
export const DIGEST_ANCHOR_COUNT = 5;
/** Cap on the final rendered list length. */
export const REDISCOVERY_MAX_ITEMS = 8;

const MIN_BOOST = 1.0;
const MAX_BOOST = 1.6;

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Maps note age to a multiplicative boost in [MIN_BOOST, MAX_BOOST].
 * Brand-new notes keep raw similarity (1.0); notes >= 1 year old get the full
 * boost; linear ramp between. Linear (not exponential) for this build.
 */
export function ageBoost(ageMs: number): number {
  const t = clamp01(ageMs / RECENCY_WINDOW_MS);
  return MIN_BOOST + (MAX_BOOST - MIN_BOOST) * t;
}

/**
 * Turns findSimilarNotes results into re-ranked RediscoveryItems for one anchor.
 * Looks up each target in nodeById and skips any that are missing (defensive -
 * strict is off). Does not sort or slice; callers compose those.
 */
export function rerankCandidates(
  anchor: NoteNode,
  results: SimilarityResult[],
  nodeById: Map<string, NoteNode>,
  now: number,
): RediscoveryItem[] {
  const items: RediscoveryItem[] = [];

  for (const result of results) {
    const target = nodeById.get(result.targetId);
    if (!target) continue;

    const ageMs = Math.max(0, now - target.mtime);
    const rerankScore = result.score * ageBoost(ageMs);

    items.push({
      id: `redisc-${anchor.id}|${target.id}`,
      targetId: target.id,
      targetTitle: target.title,
      anchorId: anchor.id,
      anchorTitle: anchor.title,
      similarity: result.score,
      ageMs,
      rerankScore,
    });
  }

  return items;
}

/** DIGEST anchors: most recently modified notes (mtime desc, tiebreak id asc). */
export function selectDigestAnchors(nodes: NoteNode[], k: number = DIGEST_ANCHOR_COUNT): NoteNode[] {
  return [...nodes]
    .sort((a, b) => (b.mtime - a.mtime) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, k);
}

/** rerankScore desc, tiebreak targetId asc. */
function byRerankThenTarget(a: RediscoveryItem, b: RediscoveryItem): number {
  return (b.rerankScore - a.rerankScore) || (a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : 0);
}

/**
 * LIVE: single anchor -> findSimilarNotes -> rerank -> sort desc -> slice.
 */
export function buildLiveItems(
  anchor: NoteNode,
  nodeById: Map<string, NoteNode>,
  embeddingsMap: Map<string, number[]>,
  graph: Graph,
  learning: LearningData | undefined,
  now: number,
): RediscoveryItem[] {
  const results = findSimilarNotes(
    anchor.id, embeddingsMap, graph, learning, REDISCOVERY_THRESHOLD, REDISCOVERY_PER_ANCHOR,
  );
  return rerankCandidates(anchor, results, nodeById, now)
    .sort(byRerankThenTarget)
    .slice(0, REDISCOVERY_MAX_ITEMS);
}

/**
 * DIGEST: K anchors -> per-anchor findSimilarNotes -> rerank -> aggregate.
 * Dedupes by targetId keeping the highest-rerankScore instance (so anchorTitle
 * reflects its best match), drops targets that are themselves anchors, then
 * sorts desc and slices.
 */
export function buildDigestItems(
  nodes: NoteNode[],
  nodeById: Map<string, NoteNode>,
  embeddingsMap: Map<string, number[]>,
  graph: Graph,
  learning: LearningData | undefined,
  now: number,
): RediscoveryItem[] {
  const anchors = selectDigestAnchors(nodes);
  const anchorIds = new Set(anchors.map(a => a.id));

  const bestByTarget = new Map<string, RediscoveryItem>();
  for (const anchor of anchors) {
    const results = findSimilarNotes(
      anchor.id, embeddingsMap, graph, learning, REDISCOVERY_THRESHOLD, REDISCOVERY_PER_ANCHOR,
    );
    for (const item of rerankCandidates(anchor, results, nodeById, now)) {
      if (anchorIds.has(item.targetId)) continue;
      const existing = bestByTarget.get(item.targetId);
      if (!existing || item.rerankScore > existing.rerankScore) {
        bestByTarget.set(item.targetId, item);
      }
    }
  }

  return [...bestByTarget.values()]
    .sort(byRerankThenTarget)
    .slice(0, REDISCOVERY_MAX_ITEMS);
}

/**
 * Vault Health — scoring engine (pure).
 *
 * Turns the existing structural analysis (graph, orphans, clusters, total links)
 * plus the deterministic fix plan into a `HealthReport`. Every function here is a
 * pure function of its inputs: no Obsidian APIs, no `Date.now()`/`Math.random()`
 * (the "now" reference is injected), so identical vault state yields an identical
 * report.
 */

import type { Graph, NoteNode } from '../core';
import type { DashboardData } from '../ui/types';
import { generateFixPlan } from '../fix';
import type { FixItem } from '../fix/fixTypes';
import { HEALTH_WEIGHTS, HEALTH_TUNING } from './healthConstants';
import type { HealthFix, HealthGrade, HealthReport, SubScores } from './healthTypes';

/** Coerce non-finite -> 0, clamp to [0, 100], round to an integer. */
function clamp01to100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

/**
 * Connectivity — how well-woven the vault is.
 * Orphans are the dominant negative signal (60%); link density rewards a dense
 * vault but saturates at `idealAvgLinks` so huge link counts aren't over-rewarded.
 */
export function computeConnectivity(
  totalNotes: number,
  orphanCount: number,
  totalLinks: number,
): number {
  if (totalNotes <= 0) return 0;
  const orphanRatio = orphanCount / totalNotes;
  const connectedScore = (1 - orphanRatio) * 100;
  const avgLinks = totalLinks / totalNotes;
  const linkScore = Math.min(1, avgLinks / HEALTH_TUNING.idealAvgLinks) * 100;
  return clamp01to100(
    HEALTH_TUNING.orphanComponentWeight * connectedScore +
      HEALTH_TUNING.linkComponentWeight * linkScore,
  );
}

/**
 * Cohesion — share of notes that belong to a meaningful cluster (length >= 2),
 * matching `mapToDashboardData`'s "meaningful clusters" rule. BFS emits orphans
 * as singletons, which are excluded.
 */
export function computeCohesion(rawClusters: string[][], totalNotes: number): number {
  if (totalNotes <= 0) return 0;
  let inClusters = 0;
  for (const cluster of rawClusters) {
    if (cluster.length >= 2) inClusters += cluster.length;
  }
  return clamp01to100((inClusters / totalNotes) * 100);
}

/**
 * Freshness — exponential decay of note age. A note touched today contributes 1.0,
 * ~0.5 at the 90-day half-life, ~0.25 at 180 days. `now` is injected for determinism.
 * Future mtimes (clock skew) clamp age to 0 -> weight 1.0; missing mtime reads as old.
 */
export function computeFreshness(nodes: NoteNode[], now: number): number {
  const totalNotes = nodes.length;
  if (totalNotes <= 0) return 0;
  let sum = 0;
  for (const node of nodes) {
    const mtime = node.mtime || 0;
    const ageDays = Math.max(0, (now - mtime) / HEALTH_TUNING.msPerDay);
    sum += Math.pow(0.5, ageDays / HEALTH_TUNING.freshnessHalfLifeDays);
  }
  return clamp01to100((sum / totalNotes) * 100);
}

/**
 * Discoverability — share of notes carrying at least one tag.
 *
 * Caveat: `parser.ts` extracts inline `#tags` only (TAG_RE), NOT YAML frontmatter
 * `tags:`. Vaults that tag exclusively via frontmatter score low here despite being
 * well-tagged. This module consumes whatever `node.tags` contains and does not
 * re-parse; the parser is intentionally left unchanged.
 */
export function computeDiscoverability(nodes: NoteNode[]): number {
  const totalNotes = nodes.length;
  if (totalNotes <= 0) return 0;
  let tagged = 0;
  for (const node of nodes) {
    if ((node.tags || []).length >= 1) tagged++;
  }
  return clamp01to100((tagged / totalNotes) * 100);
}

/** Weighted blend of the four sub-scores (weights sum to 1.0 -> result is 0-100). */
export function computeOverall(subScores: SubScores): number {
  return clamp01to100(
    HEALTH_WEIGHTS.connectivity * subScores.connectivity +
      HEALTH_WEIGHTS.cohesion * subScores.cohesion +
      HEALTH_WEIGHTS.freshness * subScores.freshness +
      HEALTH_WEIGHTS.discoverability * subScores.discoverability,
  );
}

function deriveGrade(overall: number): HealthGrade {
  const { excellent, good, fair } = HEALTH_TUNING.gradeBands;
  if (overall >= excellent) return 'excellent';
  if (overall >= good) return 'good';
  if (overall >= fair) return 'fair';
  return 'poor';
}

/** Which sub-score a given fix most improves. */
function targetSubScoreFor(fix: FixItem): keyof SubScores {
  // Bridge notes weave separate clusters together -> cohesion.
  if (fix.action.actionType === 'create_note') return 'cohesion';
  // Everything else (links, gaps, orphan reviews) raises connectivity.
  return 'connectivity';
}

/**
 * Top fixes — deterministic, explainable function of the fix engine's own
 * priority/confidence. Avoids a fragile "recompute score with fix applied"
 * simulation while staying monotonic with priority and confidence.
 */
export function deriveTopFixes(dashboardData: DashboardData): HealthFix[] {
  const plan = generateFixPlan(dashboardData);
  const base: Record<FixItem['priority'], number> = { high: 6, medium: 3, low: 1 };

  const mapped: HealthFix[] = plan.map((fix) => ({
    fixId: fix.id,
    title: fix.title,
    description: fix.description,
    estimatedImpact: Math.round(base[fix.priority] * fix.confidence),
    targetSubScore: targetSubScoreFor(fix),
  }));

  // Stable sort: estimatedImpact desc, then fixId asc (deterministic tiebreak).
  mapped.sort((a, b) => {
    if (b.estimatedImpact !== a.estimatedImpact) return b.estimatedImpact - a.estimatedImpact;
    return a.fixId < b.fixId ? -1 : a.fixId > b.fixId ? 1 : 0;
  });

  return mapped.slice(0, HEALTH_TUNING.maxTopFixes);
}

/**
 * Compute the full health report. Pure: `now` is injected by the orchestrator.
 */
export function computeHealthReport(input: {
  graph: Graph;
  orphanNodes: NoteNode[];
  rawClusters: string[][];
  totalLinks: number;
  dashboardData: DashboardData;
  now: number;
}): HealthReport {
  const { graph, orphanNodes, rawClusters, totalLinks, dashboardData, now } = input;
  const totalNotes = graph.nodes.length;

  const subScores: SubScores = {
    connectivity: computeConnectivity(totalNotes, orphanNodes.length, totalLinks),
    cohesion: computeCohesion(rawClusters, totalNotes),
    freshness: computeFreshness(graph.nodes, now),
    discoverability: computeDiscoverability(graph.nodes),
  };

  const overall = computeOverall(subScores);

  return {
    overall,
    grade: deriveGrade(overall),
    subScores,
    topFixes: deriveTopFixes(dashboardData),
    computedAt: now,
    noteCount: totalNotes,
  };
}

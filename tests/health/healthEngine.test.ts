import { describe, expect, it } from 'vitest';
import type { NoteNode } from '../../src/core';
import {
  computeConnectivity,
  computeFreshness,
  computeOverall,
} from '../../src/health/healthEngine';
import { HEALTH_TUNING } from '../../src/health/healthConstants';

function note(id: string, mtime: number): NoteNode {
  return {
    id,
    title: id.replace(/\.md$/i, ''),
    links: [],
    tags: [],
    mtime,
    contentSnippet: '',
  };
}

describe('health scoring', () => {
  it('blends connected-note ratio and saturated link density', () => {
    expect(computeConnectivity(4, 1, 6)).toBe(65);
    expect(computeConnectivity(0, 0, 0)).toBe(0);
  });

  it('uses the configured half-life deterministically', () => {
    const now = Date.UTC(2026, 0, 1);
    const halfLifeMs = HEALTH_TUNING.freshnessHalfLifeDays * HEALTH_TUNING.msPerDay;
    const nodes = [note('Fresh.md', now), note('Older.md', now - halfLifeMs)];

    expect(computeFreshness(nodes, now)).toBe(75);
  });

  it('clamps invalid and out-of-range overall scores', () => {
    expect(computeOverall({
      connectivity: Number.POSITIVE_INFINITY,
      cohesion: 100,
      freshness: 100,
      discoverability: 100,
    })).toBe(0);
    expect(computeOverall({
      connectivity: 200,
      cohesion: 200,
      freshness: 200,
      discoverability: 200,
    })).toBe(100);
  });
});

/**
 * Vault Health — tunable weights and thresholds.
 *
 * All scoring knobs live here so they are reviewable and adjustable in one place.
 * Pure data; no imports.
 */

/** Weight of each sub-score in the overall. MUST sum to 1.0. */
export const HEALTH_WEIGHTS = {
  connectivity: 0.30,
  cohesion: 0.25,
  freshness: 0.20,
  discoverability: 0.25,
} as const;

export const HEALTH_TUNING = {
  // Connectivity
  idealAvgLinks: 3,            // avg links-per-note where the link component saturates
  orphanComponentWeight: 0.6, // orphans are the strongest negative signal
  linkComponentWeight: 0.4,
  // Freshness
  freshnessHalfLifeDays: 90,  // exponential decay; ~half credit at 90 days
  msPerDay: 24 * 60 * 60 * 1000,
  // Grade bands (overall)
  gradeBands: { excellent: 80, good: 60, fair: 40 }, // else 'poor'
  // Top fixes
  maxTopFixes: 3,
} as const;

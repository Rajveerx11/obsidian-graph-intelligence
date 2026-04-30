/**
 * Fix Engine — Aggregation and Prioritization
 *
 * Combines various insights (gaps, semantic suggestions, orphans) into a single,
 * prioritized, actionable list of top fixes.
 */

import type { FixItem, FixPriority, FixType, FixActionType } from './fixTypes';
import type { DashboardData } from '../ui/types';

/**
 * Generates a prioritized fix plan from dashboard data.
 */
export function generateFixPlan(data: DashboardData): FixItem[] {
  const fixes: FixItem[] = [];

  // 1. Process Knowledge Gaps
  for (const gap of data.knowledgeGaps || []) {
    let priority: FixPriority = 'low';
    if (gap.confidence >= 0.75) {
      priority = 'high';
    } else if (gap.confidence >= 0.5) {
      priority = 'medium';
    }

    let type: FixType = 'gap';
    if (gap.type === 'orphan_gap') {
      type = 'orphan';
      // Orphan gaps with cluster similarity should be medium priority according to requirements
      if (priority === 'low') priority = 'medium';
    }

    let actionType: FixActionType = gap.suggestedAction.type === 'link' ? 'link' : 'create_note';
    let label = gap.suggestedAction.type === 'link' ? 'Link Notes' : 'Create Note';
    let payload: any = {};

    if (gap.involvedNotes.length >= 2) {
      payload = { sourceId: gap.involvedNotes[0], targetId: gap.involvedNotes[1] };
    } else {
      actionType = 'open';
      label = 'Open Notes';
      payload = { noteIds: gap.involvedNotes };
    }

    let title = 'Knowledge Gap';
    if (gap.type === 'orphan_gap') title = 'Orphan Note Match';
    if (gap.type === 'cluster_gap') title = 'Weak Link Between Clusters';
    if (gap.type === 'concept_gap') title = 'Missing Bridge Note';

    fixes.push({
      id: `fix-${gap.id}`,
      title,
      description: gap.description,
      type,
      priority,
      confidence: gap.confidence,
      action: {
        label,
        actionType,
        payload,
      },
    });
  }

  // 2. Process Semantic Suggestions (Links)
  for (const sug of data.suggestions || []) {
    // Semantic suggestions are generally high-confidence (already filtered > 0.5 in generation)
    // We'll give them a fixed high confidence for ranking purposes.
    fixes.push({
      id: `fix-${sug.id}`,
      title: 'Semantic Link Suggestion',
      description: sug.description,
      type: 'link',
      priority: 'high',
      confidence: 0.85,
      action: {
        label: 'Link Notes',
        actionType: 'link',
        payload: { sourceId: sug.sourceNoteId, targetId: sug.targetNoteId },
      },
    });
  }

  // 3. Process Pure Orphans (Orphans with no gaps or suggestions)
  const coveredOrphans = new Set<string>();
  for (const f of fixes) {
    if (f.action.payload.sourceId) coveredOrphans.add(f.action.payload.sourceId);
    if (f.action.payload.targetId) coveredOrphans.add(f.action.payload.targetId);
    if (f.action.payload.noteIds) {
      f.action.payload.noteIds.forEach((id: string) => coveredOrphans.add(id));
    }
  }

  // Use a dedicated counter to guarantee unique IDs regardless of the path content
  let orphanIdx = 0;
  for (const orphan of data.orphans || []) {
    if (coveredOrphans.has(orphan.id)) continue;

    fixes.push({
      id: `fix-orphan-pure-${orphanIdx++}`,
      title: 'Review Orphan Note',
      description: `"${orphan.title}" has no links and no semantic matches. Review it manually.`,
      type: 'orphan',
      priority: 'low',
      confidence: 0.3,
      action: {
        label: 'Open Note',
        actionType: 'open',
        payload: { noteIds: [orphan.id] },
      },
    });
  }

  // 4. Sort: High > Medium > Low, then by confidence descending
  const priorityScore: Record<FixPriority, number> = { high: 3, medium: 2, low: 1 };
  fixes.sort((a, b) => {
    if (priorityScore[a.priority] !== priorityScore[b.priority]) {
      return priorityScore[b.priority] - priorityScore[a.priority];
    }
    return b.confidence - a.confidence;
  });

  return fixes;
}

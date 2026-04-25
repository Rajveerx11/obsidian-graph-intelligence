import { AlertTriangle, Link as LinkIcon, FilePlus, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { KnowledgeGap } from '../gap/gapTypes';

export interface KnowledgeGapsPanelProps {
  gaps: KnowledgeGap[];
}

/** Human-readable labels for gap types. */
const GAP_TYPE_LABELS: Record<KnowledgeGap['type'], string> = {
  cluster_gap: 'Weak Link',
  orphan_gap: 'Orphan Match',
  concept_gap: 'Missing Bridge',
};

/** CSS modifier class for each gap type's accent color. */
const GAP_TYPE_MODIFIER: Record<KnowledgeGap['type'], string> = {
  cluster_gap: 'cluster',
  orphan_gap: 'orphan',
  concept_gap: 'concept',
};

/**
 * Knowledge Gaps Panel
 *
 * Displays detected gaps in the knowledge graph as individually
 * styled mini-cards. Each card shows the gap type, description,
 * confidence bar, involved notes, and suggested action.
 *
 * Returns null when there are no gaps (consistent with SuggestionsPanel).
 */
export function KnowledgeGapsPanel({ gaps }: KnowledgeGapsPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!gaps || gaps.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="ogi-gaps-section">
      <div className="ogi-card">
        <div className="ogi-card-header">
          <h3 className="ogi-card-title ogi-card-title--warning">
            <AlertTriangle />
            Knowledge Gaps
          </h3>
          <span className="ogi-badge ogi-badge--warning">{gaps.length}</span>
        </div>

        <div className="ogi-card-body ogi-card-body--padded ogi-card-body--tall">
          {gaps.map((gap) => {
            const modifier = GAP_TYPE_MODIFIER[gap.type];
            const isExpanded = expandedIds.has(gap.id);
            const showToggle = gap.involvedNotes.length > 3;
            const visibleNotes = isExpanded
              ? gap.involvedNotes
              : gap.involvedNotes.slice(0, 3);

            return (
              <div
                key={gap.id}
                className={`ogi-gap-item ogi-gap-item--${modifier}`}
              >
                {/* Header row: type badge + confidence */}
                <div className="ogi-gap-header">
                  <span className={`ogi-gap-badge ogi-gap-badge--${modifier}`}>
                    {GAP_TYPE_LABELS[gap.type]}
                  </span>
                  <span className="ogi-gap-confidence-label">
                    {(gap.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Confidence bar */}
                <div className="ogi-gap-confidence-track">
                  <div
                    className={`ogi-gap-confidence-fill ogi-gap-confidence-fill--${modifier}`}
                    style={{ width: `${gap.confidence * 100}%` }}
                  />
                </div>

                {/* Description */}
                <p className="ogi-gap-description">{gap.description}</p>

                {/* Involved notes */}
                <div className="ogi-gap-notes">
                  {visibleNotes.map((noteId, idx) => (
                    <span key={idx} className="ogi-gap-note-chip">
                      {noteId.replace(/\.md$/, '').split('/').pop()}
                    </span>
                  ))}
                  {showToggle && (
                    <button
                      className="ogi-gap-notes-toggle"
                      onClick={() => toggleExpand(gap.id)}
                    >
                      {isExpanded ? <ChevronDown /> : <ChevronRight />}
                      {isExpanded
                        ? 'Show less'
                        : `+${gap.involvedNotes.length - 3} more`}
                    </button>
                  )}
                </div>

                {/* Suggested action */}
                <div className="ogi-gap-action">
                  {gap.suggestedAction.type === 'link' ? (
                    <LinkIcon />
                  ) : (
                    <FilePlus />
                  )}
                  <span>{gap.suggestedAction.details}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

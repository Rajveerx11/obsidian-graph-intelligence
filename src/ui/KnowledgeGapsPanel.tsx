import { AlertTriangle, Link as LinkIcon, FilePlus, ChevronDown, ChevronRight, ExternalLink, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { KnowledgeGap } from '../gap/gapTypes';
import type { KnowledgeGapsPanelProps } from './types';

/** Per-item action status for optimistic UI updates. */
type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface ItemStatus {
  status: ActionStatus;
  message?: string;
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
 * confidence bar, involved notes, and suggested action with
 * interactive action buttons.
 *
 * Returns null when there are no gaps (consistent with SuggestionsPanel).
 */
export function KnowledgeGapsPanel({ gaps, onLinkNotes, onCreateBridgeNote, onOpenNotes }: KnowledgeGapsPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [actionStates, setActionStates] = useState<Record<string, ItemStatus>>({});
  const [isCardExpanded, setIsCardExpanded] = useState(true);

  if (!gaps || gaps.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getStatus = (key: string): ItemStatus => actionStates[key] ?? { status: 'idle' };

  const setStatus = (key: string, status: ItemStatus) => {
    setActionStates(prev => ({ ...prev, [key]: status }));
    if (status.status === 'success' || status.status === 'error') {
      setTimeout(() => {
        setActionStates(prev => ({ ...prev, [key]: { status: 'idle' } }));
      }, 2500);
    }
  };

  const handleLink = async (gap: KnowledgeGap) => {
    if (!onLinkNotes || gap.involvedNotes.length < 2) return;

    const key = `link-${gap.id}`;
    setStatus(key, { status: 'loading' });

    const result = await onLinkNotes(gap.involvedNotes[0], gap.involvedNotes[1]);
    setStatus(key, {
      status: result.success ? 'success' : 'error',
      message: result.message,
    });
  };

  const handleCreateBridge = async (gap: KnowledgeGap) => {
    if (!onCreateBridgeNote || gap.involvedNotes.length < 2) return;

    const key = `bridge-${gap.id}`;
    setStatus(key, { status: 'loading' });

    const result = await onCreateBridgeNote(gap.involvedNotes[0], gap.involvedNotes[1]);
    setStatus(key, {
      status: result.success ? 'success' : 'error',
      message: result.message,
    });
  };

  const handleOpen = async (gap: KnowledgeGap) => {
    if (!onOpenNotes || gap.involvedNotes.length === 0) return;

    const key = `open-${gap.id}`;
    setStatus(key, { status: 'loading' });

    const result = await onOpenNotes(gap.involvedNotes.slice(0, 2));
    setStatus(key, {
      status: result.success ? 'success' : 'error',
      message: result.message,
    });
  };

  const renderStatusIcon = (key: string) => {
    const { status, message } = getStatus(key);
    if (status === 'loading') return <Loader2 className="ogi-spin" />;
    if (status === 'success') return <CheckCircle />;
    if (status === 'error') return <span title={message}><AlertCircle /></span>;
    return null;
  };

  return (
    <section className="ogi-gaps-section">
      <div className="ogi-card">
        <div 
          className="ogi-card-header"
          style={{ cursor: 'pointer', borderBottom: isCardExpanded ? '1px solid var(--ogi-border)' : 'none' }}
          onClick={() => setIsCardExpanded(!isCardExpanded)}
        >
          <h3 className="ogi-card-title ogi-card-title--warning">
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ogi-muted)', marginRight: '2px' }}>
              {isCardExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
            <AlertTriangle size={16} />
            Knowledge Gaps
          </h3>
          <span className="ogi-badge ogi-badge--warning">{gaps.length}</span>
        </div>

        {isCardExpanded && (
          <div className="ogi-card-body ogi-card-body--padded ogi-card-body--tall">
          {gaps.map((gap) => {
            const modifier = GAP_TYPE_MODIFIER[gap.type];
            const isExpanded = expandedIds.has(gap.id);
            const showToggle = gap.involvedNotes.length > 3;
            const visibleNotes = isExpanded
              ? gap.involvedNotes
              : gap.involvedNotes.slice(0, 3);

            const hasEnoughNotes = gap.involvedNotes.length >= 2;
            const linkKey = `link-${gap.id}`;
            const bridgeKey = `bridge-${gap.id}`;
            const openKey = `open-${gap.id}`;
            const linkStatus = getStatus(linkKey);
            const bridgeStatus = getStatus(bridgeKey);
            const openStatus = getStatus(openKey);

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

                {/* Suggested action text */}
                <div className="ogi-gap-action">
                  {gap.suggestedAction.type === 'link' ? (
                    <LinkIcon />
                  ) : (
                    <FilePlus />
                  )}
                  <span>{gap.suggestedAction.details}</span>
                </div>

                {/* ── Action Buttons ── */}
                {hasEnoughNotes && (onLinkNotes || onCreateBridgeNote || onOpenNotes) && (
                  <div className="ogi-gap-actions">
                    {/* Link action — for link-type gaps */}
                    {gap.suggestedAction.type === 'link' && onLinkNotes && (
                      <button
                        onClick={() => handleLink(gap)}
                        disabled={linkStatus.status === 'loading'}
                        className={`ogi-btn ogi-btn--link ${linkStatus.status !== 'idle' ? `ogi-btn--${linkStatus.status}` : ''}`}
                        title={linkStatus.message ?? 'Link these notes'}
                      >
                        {renderStatusIcon(linkKey) ?? <LinkIcon />}
                        Link Notes
                      </button>
                    )}

                    {/* Create bridge — for create_note-type gaps */}
                    {gap.suggestedAction.type === 'create_note' && onCreateBridgeNote && (
                      <button
                        onClick={() => handleCreateBridge(gap)}
                        disabled={bridgeStatus.status === 'loading'}
                        className={`ogi-btn ogi-btn--create ${bridgeStatus.status !== 'idle' ? `ogi-btn--${bridgeStatus.status}` : ''}`}
                        title={bridgeStatus.message ?? 'Create a bridge note'}
                      >
                        {renderStatusIcon(bridgeKey) ?? <FilePlus />}
                        Create Note
                      </button>
                    )}

                    {/* Open notes — always available */}
                    {onOpenNotes && (
                      <button
                        onClick={() => handleOpen(gap)}
                        disabled={openStatus.status === 'loading'}
                        className={`ogi-btn ogi-btn--open ${openStatus.status !== 'idle' ? `ogi-btn--${openStatus.status}` : ''}`}
                        title="Open involved notes"
                      >
                        {renderStatusIcon(openKey) ?? <ExternalLink />}
                        Open
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        )}
      </div>
    </section>
  );
}

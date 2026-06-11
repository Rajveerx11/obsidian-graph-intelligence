import { useState } from 'react';
import { History, Link as LinkIcon, X, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { RediscoveryPanelProps, RediscoveryItem } from './types';

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface ItemStatus {
  status: ActionStatus;
  message?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatAge(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  if (days < 1) return 'edited today';
  if (days < 30) return days === 1 ? 'edited 1 day ago' : `edited ${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'edited 1 month ago' : `edited ${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? 'edited 1 year ago' : `edited ${years} years ago`;
}

export function RediscoveryPanel({ state, onSetMode, onLinkNotes, onOpenNotes, onDismiss }: RediscoveryPanelProps) {
  const [actionStates, setActionStates] = useState<Record<string, ItemStatus>>({});
  const [isCardExpanded, setIsCardExpanded] = useState(true);

  const mode = state?.mode ?? 'digest';
  const items = state?.items ?? [];

  const getStatus = (key: string): ItemStatus => actionStates[key] ?? { status: 'idle' };

  const setStatus = (key: string, status: ItemStatus) => {
    setActionStates(prev => ({ ...prev, [key]: status }));

    if (status.status === 'success' || status.status === 'error') {
      setTimeout(() => {
        setActionStates(prev => ({ ...prev, [key]: { status: 'idle' } }));
      }, 2500);
    }
  };

  const handleLink = async (item: RediscoveryItem) => {
    if (!onLinkNotes || !item.anchorId || !item.targetId) return;

    const key = `link-${item.id}`;
    setStatus(key, { status: 'loading' });

    try {
      const result = await onLinkNotes(item.anchorId, item.targetId);
      setStatus(key, {
        status: result.success ? 'success' : 'error',
        message: result.message,
      });
    } catch (err) {
      setStatus(key, {
        status: 'error',
        message: err instanceof Error ? err.message : 'Link failed',
      });
    }
  };

  const handleOpen = async (item: RediscoveryItem) => {
    if (!onOpenNotes) return;

    const key = `open-${item.id}`;
    setStatus(key, { status: 'loading' });

    try {
      const result = await onOpenNotes([item.targetId]);
      setStatus(key, {
        status: result.success ? 'success' : 'error',
        message: result.message,
      });
    } catch (err) {
      setStatus(key, {
        status: 'error',
        message: err instanceof Error ? err.message : 'Open failed',
      });
    }
  };

  const renderStatusIcon = (key: string) => {
    const { status, message } = getStatus(key);
    if (status === 'loading') return <Loader2 className="ogi-spin" />;
    if (status === 'success') return <CheckCircle />;
    if (status === 'error') return <span title={message}><AlertCircle /></span>;
    return null;
  };

  const renderBody = () => {
    if (!state || !state.isReady) {
      return <p className="ogi-empty-state">Surveying semantics...</p>;
    }

    if (items.length === 0) {
      if (mode === 'live') {
        return (
          <p className="ogi-empty-state">
            {state.activeNoteTitle
              ? 'Nothing forgotten to resurface near this note.'
              : 'Open a note to see related forgotten notes.'}
          </p>
        );
      }
      return <p className="ogi-empty-state">No old notes to rediscover yet.</p>;
    }

    return items.map((item) => {
      const linkKey = `link-${item.id}`;
      const openKey = `open-${item.id}`;
      const linkStatus = getStatus(linkKey);
      const openStatus = getStatus(openKey);
      const canLink = !!onLinkNotes && !!item.anchorId && !!item.targetId;

      return (
        <div key={item.id} className="ogi-suggestion">
          <div className="ogi-suggestion-icon ogi-suggestion-icon--link">
            <History />
          </div>

          <div className="ogi-suggestion-body">
            {onOpenNotes ? (
              <button
                onClick={() => handleOpen(item)}
                disabled={openStatus.status === 'loading'}
                className="ogi-suggestion-text"
                title="Open this note"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--ogi-accent)',
                }}
              >
                {item.targetTitle}
                {renderStatusIcon(openKey)}
              </button>
            ) : (
              <p className="ogi-suggestion-text">{item.targetTitle}</p>
            )}

            <p className="ogi-suggestion-text" style={{ color: 'var(--ogi-muted)', fontSize: 12 }}>
              {formatAge(item.ageMs)} &middot; {Math.round(item.similarity * 100)}% match
            </p>

            {mode === 'digest' && (
              <p style={{ color: 'var(--ogi-marginalia)', fontSize: 11, margin: '2px 0 0' }}>
                near {item.anchorTitle}
              </p>
            )}

            <div className="ogi-suggestion-actions">
              {canLink && (
                <button
                  onClick={() => handleLink(item)}
                  disabled={linkStatus.status === 'loading'}
                  className={`ogi-btn ogi-btn--link ${linkStatus.status !== 'idle' ? `ogi-btn--${linkStatus.status}` : ''}`}
                  title={linkStatus.message ?? 'Create a wikilink between these notes'}
                >
                  {renderStatusIcon(linkKey) ?? <LinkIcon />}
                  Link
                </button>
              )}

              <button onClick={() => onDismiss(item)} className="ogi-btn ogi-btn--dismiss">
                <X />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="ogi-card">
      <div
        className="ogi-card-header"
        style={{ cursor: 'pointer', borderBottom: isCardExpanded ? '1px solid var(--ogi-border)' : 'none' }}
        onClick={() => setIsCardExpanded(!isCardExpanded)}
      >
        <h3 className="ogi-card-title ogi-card-title--secondary">
          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ogi-muted)', marginRight: '2px' }}>
            {isCardExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <History size={16} />
          Rediscover
        </h3>
        <span className="ogi-badge ogi-badge--secondary">{items.length}</span>
      </div>

      {isCardExpanded && (
        <div className="ogi-card-body ogi-card-body--padded ogi-card-body--short">
          <div className="ogi-suggestion-actions" style={{ marginBottom: 8 }}>
            <button
              onClick={() => onSetMode('digest')}
              className={`ogi-btn ${mode === 'digest' ? 'ogi-btn--link' : ''}`}
              title="Aggregate forgotten notes across your most recent work"
            >
              Digest
            </button>
            <button
              onClick={() => onSetMode('live')}
              className={`ogi-btn ${mode === 'live' ? 'ogi-btn--link' : ''}`}
              title="Forgotten notes related to the note you have open"
            >
              Live
            </button>
          </div>

          {mode === 'live' && state?.isReady && (
            <p style={{ color: 'var(--ogi-muted)', fontSize: 12, margin: '0 0 8px' }}>
              {state.activeNoteTitle ? `Near: ${state.activeNoteTitle}` : 'No note open.'}
            </p>
          )}

          {renderBody()}
        </div>
      )}
    </div>
  );
}

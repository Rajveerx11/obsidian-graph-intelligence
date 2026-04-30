import { useState } from 'react';
import { Check, X, Lightbulb, Link as LinkIcon, Sparkles, ExternalLink, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { SuggestionsPanelProps } from './types';

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface ItemStatus {
  status: ActionStatus;
  message?: string;
}

export function SuggestionsPanel({ suggestions, onAccept, onDismiss, onLinkNotes, onOpenNotes }: SuggestionsPanelProps) {
  const [actionStates, setActionStates] = useState<Record<string, ItemStatus>>({});
  const [isCardExpanded, setIsCardExpanded] = useState(true);

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const getStatus = (id: string): ItemStatus => actionStates[id] ?? { status: 'idle' };

  const setStatus = (id: string, status: ItemStatus) => {
    setActionStates(prev => ({ ...prev, [id]: status }));

    if (status.status === 'success' || status.status === 'error') {
      setTimeout(() => {
        setActionStates(prev => ({ ...prev, [id]: { status: 'idle' } }));
      }, 2500);
    }
  };

  const handleLink = async (suggestion: typeof suggestions[0]) => {
    if (!onLinkNotes || !suggestion.sourceNoteId || !suggestion.targetNoteId) return;

    const key = `link-${suggestion.id}`;
    setStatus(key, { status: 'loading' });

    const result = await onLinkNotes(suggestion.sourceNoteId, suggestion.targetNoteId);
    setStatus(key, {
      status: result.success ? 'success' : 'error',
      message: result.message,
    });
  };

  const handleAccept = async (suggestion: typeof suggestions[0]) => {
    const key = `accept-${suggestion.id}`;
    setStatus(key, { status: 'loading' });

    try {
      await onAccept(suggestion.id);
      setStatus(key, { status: 'success' });
    } catch (err) {
      setStatus(key, {
        status: 'error',
        message: err instanceof Error ? err.message : 'Accept failed',
      });
    }
  };

  const handleOpen = async (suggestion: typeof suggestions[0]) => {
    if (!onOpenNotes) return;

    const noteIds = [suggestion.sourceNoteId, suggestion.targetNoteId].filter(Boolean) as string[];
    if (noteIds.length === 0) return;

    const key = `open-${suggestion.id}`;
    setStatus(key, { status: 'loading' });

    const result = await onOpenNotes(noteIds);
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
          <Lightbulb size={16} />
          AI Insights
        </h3>
        <span className="ogi-badge ogi-badge--secondary">{suggestions.length}</span>
      </div>

      {isCardExpanded && (
        <div className="ogi-card-body ogi-card-body--padded ogi-card-body--short">
        {suggestions.map((suggestion) => {
          const hasNotes = !!suggestion.sourceNoteId && !!suggestion.targetNoteId;
          const acceptKey = `accept-${suggestion.id}`;
          const linkKey = `link-${suggestion.id}`;
          const openKey = `open-${suggestion.id}`;
          const acceptStatus = getStatus(acceptKey);
          const linkStatus = getStatus(linkKey);
          const openStatus = getStatus(openKey);

          return (
            <div key={suggestion.id} className="ogi-suggestion">
              <div className={`ogi-suggestion-icon ogi-suggestion-icon--${suggestion.type}`}>
                {suggestion.type === 'link' ? <LinkIcon /> : <Sparkles />}
              </div>

              <div className="ogi-suggestion-body">
                <p className="ogi-suggestion-text">{suggestion.description}</p>

                <div className="ogi-suggestion-actions">

                  <button
                    onClick={() => handleAccept(suggestion)}
                    disabled={acceptStatus.status === 'loading'}
                    className={`ogi-btn ogi-btn--accept ${acceptStatus.status !== 'idle' ? `ogi-btn--${acceptStatus.status}` : ''}`}
                    title={acceptStatus.message ?? 'Accept this suggestion'}
                  >
                    {renderStatusIcon(acceptKey) ?? <Check />}
                    Accept
                  </button>
                  <button onClick={() => onDismiss(suggestion.id)} className="ogi-btn ogi-btn--dismiss">
                    <X />
                    Dismiss
                  </button>

                  {hasNotes && onLinkNotes && (
                    <button
                      onClick={() => handleLink(suggestion)}
                      disabled={linkStatus.status === 'loading'}
                      className={`ogi-btn ogi-btn--link ${linkStatus.status !== 'idle' ? `ogi-btn--${linkStatus.status}` : ''}`}
                      title={linkStatus.message ?? 'Create a wikilink between these notes'}
                    >
                      {renderStatusIcon(linkKey) ?? <LinkIcon />}
                      Link
                    </button>
                  )}

                  {hasNotes && onOpenNotes && (
                    <button
                      onClick={() => handleOpen(suggestion)}
                      disabled={openStatus.status === 'loading'}
                      className={`ogi-btn ogi-btn--open ${openStatus.status !== 'idle' ? `ogi-btn--${openStatus.status}` : ''}`}
                      title="Open both notes"
                    >
                      {renderStatusIcon(openKey) ?? <ExternalLink />}
                      Open
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}

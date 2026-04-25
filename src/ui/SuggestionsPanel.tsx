import { useState } from 'react';
import { Check, X, Lightbulb, Link as LinkIcon, Sparkles, ExternalLink, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { SuggestionsPanelProps } from './types';

/** Per-item action status for optimistic UI updates. */
type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface ItemStatus {
  status: ActionStatus;
  message?: string;
}

export function SuggestionsPanel({ suggestions, onAccept, onDismiss, onLinkNotes, onOpenNotes }: SuggestionsPanelProps) {
  const [actionStates, setActionStates] = useState<Record<string, ItemStatus>>({});

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const getStatus = (id: string): ItemStatus => actionStates[id] ?? { status: 'idle' };

  const setStatus = (id: string, status: ItemStatus) => {
    setActionStates(prev => ({ ...prev, [id]: status }));
    // Auto-clear after 2.5 seconds
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
      <div className="ogi-card-header">
        <h3 className="ogi-card-title ogi-card-title--secondary">
          <Lightbulb />
          AI Insights
        </h3>
        <span className="ogi-badge ogi-badge--secondary">{suggestions.length}</span>
      </div>

      <div className="ogi-card-body ogi-card-body--padded ogi-card-body--short">
        {suggestions.map((suggestion) => {
          const hasNotes = !!suggestion.sourceNoteId && !!suggestion.targetNoteId;
          const linkKey = `link-${suggestion.id}`;
          const openKey = `open-${suggestion.id}`;
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
                  {/* Existing accept/dismiss */}
                  <button onClick={() => onAccept(suggestion.id)} className="ogi-btn ogi-btn--accept">
                    <Check />
                    Accept
                  </button>
                  <button onClick={() => onDismiss(suggestion.id)} className="ogi-btn ogi-btn--dismiss">
                    <X />
                    Dismiss
                  </button>

                  {/* Action buttons — only when note IDs are available */}
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
    </div>
  );
}

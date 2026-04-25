import { useState } from 'react';
import { AlertCircle, Plus, Loader2 } from 'lucide-react';
import type { OrphanNotesListProps } from './types';

export function OrphanNotesList({ notes, onSuggestLinks }: OrphanNotesListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSuggest = async (id: string) => {
    setLoadingId(id);
    try {
      await onSuggestLinks(id);
    } finally {
      setLoadingId(null);
    }
  };

  if (!notes || notes.length === 0) {
    return (
      <div className="ogi-empty-state">
        No orphaned notes found. Great job!
      </div>
    );
  }

  return (
    <div className="ogi-card ogi-card--short">
      <div className="ogi-card-header">
        <h3 className="ogi-card-title ogi-card-title--warning">
          <AlertCircle />
          Orphaned Notes
        </h3>
        <span className="ogi-badge ogi-badge--warning">{notes.length}</span>
      </div>
      <div className="ogi-card-body ogi-card-body--short">
        {notes.map((note) => {
          const isLoading = loadingId === note.id;
          return (
            <div key={note.id} className="ogi-orphan-item">
              <div className="ogi-orphan-info">
                <div className="ogi-orphan-dot" />
                <span className="ogi-orphan-title">{note.title}</span>
              </div>
              <button
                onClick={() => handleSuggest(note.id)}
                disabled={isLoading}
                className={`ogi-btn ogi-btn--primary ${isLoading ? 'ogi-btn--loading' : ''}`}
              >
                {isLoading ? (
                  <Loader2 size={14} />
                ) : (
                  <Plus size={14} />
                )}
                Suggest Links
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

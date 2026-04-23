import { AlertCircle, Plus } from 'lucide-react';
import type { OrphanNotesListProps } from './types';

export function OrphanNotesList({ notes, onSuggestLinks }: OrphanNotesListProps) {
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
        {notes.map((note) => (
          <div key={note.id} className="ogi-orphan-item">
            <div className="ogi-orphan-info">
              <div className="ogi-orphan-dot" />
              <span className="ogi-orphan-title">{note.title}</span>
            </div>
            <button
              onClick={() => onSuggestLinks(note.id)}
              className="ogi-btn ogi-btn--primary"
            >
              <Plus />
              Suggest Links
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

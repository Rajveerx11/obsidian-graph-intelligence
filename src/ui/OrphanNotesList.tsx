import { AlertCircle, Plus } from 'lucide-react';
import type { OrphanNotesListProps } from './types';

export function OrphanNotesList({ notes, onSuggestLinks }: OrphanNotesListProps) {
  if (!notes || notes.length === 0) {
    return (
      <div className="bg-obs-panel border border-obs-border rounded-2xl p-6 text-center text-obs-muted text-sm">
        No orphaned notes found. Great job!
      </div>
    );
  }

  return (
    <div className="bg-obs-panel border border-obs-border rounded-2xl overflow-hidden shadow-sm shadow-black/10 flex flex-col max-h-[300px]">
      <div className="px-4 py-3 border-b border-obs-border flex justify-between items-center bg-obs-panel/50">
        <h3 className="text-obs-text font-medium text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-obs-warning" />
          Orphaned Notes
        </h3>
        <span className="bg-obs-warning/10 text-obs-warning text-xs font-semibold px-2 py-0.5 rounded-full">
          {notes.length}
        </span>
      </div>
      <div className="overflow-y-auto p-2 space-y-1">
        {notes.map((note) => (
          <div
            key={note.id}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-obs-bg/50 transition-colors group"
          >
            <div className="flex items-center gap-3 truncate pr-4">
              <div className="w-1.5 h-1.5 rounded-full bg-obs-warning shrink-0" />
              <span className="text-obs-text text-sm truncate font-medium">{note.title}</span>
            </div>
            <button
              onClick={() => onSuggestLinks(note.id)}
              className="opacity-0 group-hover:opacity-100 shrink-0 flex items-center gap-1.5 text-xs font-medium text-obs-bg bg-obs-primary hover:bg-obs-primary/90 px-2.5 py-1.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-obs-primary/50"
            >
              <Plus className="w-3.5 h-3.5" />
              Suggest Links
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Check, X, Lightbulb, Link as LinkIcon, Sparkles } from 'lucide-react';

export interface Suggestion {
  id: string;
  description: string;
  type: 'link' | 'bridge';
}

export interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function SuggestionsPanel({ suggestions, onAccept, onDismiss }: SuggestionsPanelProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="bg-obs-panel border border-obs-border rounded-2xl overflow-hidden shadow-sm shadow-black/10 flex flex-col">
      <div className="px-4 py-3 border-b border-obs-border bg-obs-panel/50 flex items-center justify-between">
        <h3 className="text-obs-text font-medium text-sm flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-obs-secondary" />
          AI Insights
        </h3>
        <span className="bg-obs-secondary/10 text-obs-secondary text-xs font-semibold px-2 py-0.5 rounded-full">
          {suggestions.length}
        </span>
      </div>
      
      <div className="p-3 space-y-3 overflow-y-auto max-h-[300px]">
        {suggestions.map((suggestion) => (
          <div 
            key={suggestion.id} 
            className="flex items-start gap-3 p-3 rounded-xl bg-obs-bg border border-obs-border/50 hover:border-obs-border transition-colors group"
          >
            <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${suggestion.type === 'link' ? 'bg-obs-primary/10 text-obs-primary' : 'bg-obs-secondary/10 text-obs-secondary'}`}>
              {suggestion.type === 'link' ? <LinkIcon className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            </div>
            
            <div className="flex-1">
              <p className="text-obs-text text-sm leading-relaxed pr-2">
                {suggestion.description}
              </p>
              
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => onAccept(suggestion.id)}
                  className="flex items-center gap-1 text-xs font-medium bg-obs-secondary/10 text-obs-secondary hover:bg-obs-secondary hover:text-obs-bg px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none"
                >
                  <Check className="w-3.5 h-3.5" />
                  Accept
                </button>
                <button
                  onClick={() => onDismiss(suggestion.id)}
                  className="flex items-center gap-1 text-xs font-medium text-obs-muted hover:text-obs-danger hover:bg-obs-danger/10 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none"
                >
                  <X className="w-3.5 h-3.5" />
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

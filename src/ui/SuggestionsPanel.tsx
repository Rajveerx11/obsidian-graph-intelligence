import { Check, X, Lightbulb, Link as LinkIcon, Sparkles } from 'lucide-react';
import type { SuggestionsPanelProps } from './types';

export function SuggestionsPanel({ suggestions, onAccept, onDismiss }: SuggestionsPanelProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

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
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="ogi-suggestion">
            <div className={`ogi-suggestion-icon ogi-suggestion-icon--${suggestion.type}`}>
              {suggestion.type === 'link' ? <LinkIcon /> : <Sparkles />}
            </div>

            <div className="ogi-suggestion-body">
              <p className="ogi-suggestion-text">{suggestion.description}</p>
              <div className="ogi-suggestion-actions">
                <button onClick={() => onAccept(suggestion.id)} className="ogi-btn ogi-btn--accept">
                  <Check />
                  Accept
                </button>
                <button onClick={() => onDismiss(suggestion.id)} className="ogi-btn ogi-btn--dismiss">
                  <X />
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

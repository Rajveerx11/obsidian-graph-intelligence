/**
 * LLM Query Input — Dedicated "Ask AI" input, SEPARATE from the search bar.
 *
 * Features:
 *  - 500ms debounce before enabling submit
 *  - Input disabled while a query is in-flight
 *  - Enter key or button click to submit
 *  - Prevents empty submissions
 */

import { useState, useRef, useCallback } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import type { LLMQueryInputProps } from './types';

export function LLMQueryInput({ onSubmit, isQuerying, disabled = false }: LLMQueryInputProps) {
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const handleChange = useCallback((value: string) => {
    setQuery(value);

    // Debounce: mark as debouncing, clear after 500ms
    setIsDebouncing(true);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setIsDebouncing(false);
    }, 500);
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = query.trim();
      if (!trimmed || isQuerying || isDebouncing || disabled) return;
      onSubmit(trimmed);
    },
    [query, isQuerying, isDebouncing, disabled, onSubmit]
  );

  const canSubmit = query.trim().length > 0 && !isQuerying && !isDebouncing && !disabled;

  return (
    <div className="ogi-llm-input-wrapper">
      <form className="ogi-llm-input" onSubmit={handleSubmit}>
        <div className="ogi-llm-input-icon">
          <Sparkles />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Ask AI about your vault..."
          className="ogi-llm-input-field"
          disabled={isQuerying || disabled}
          aria-label="Ask AI about your vault"
        />
        <button
          type="submit"
          className={`ogi-btn ogi-btn--send ${canSubmit ? '' : 'ogi-btn--disabled'}`}
          disabled={!canSubmit}
          title={isQuerying ? 'Query in progress...' : 'Ask AI'}
          aria-label="Submit AI query"
        >
          {isQuerying ? <Loader2 className="ogi-spin" /> : <Send />}
        </button>
      </form>
    </div>
  );
}

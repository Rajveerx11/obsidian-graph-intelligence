/**
 * LLM Insights Panel — Displays AI-generated insights.
 *
 * Features:
 *  - Shows loading state with spinner during generation
 *  - Renders the LLM response with basic formatting
 *  - Shows "AI-generated insight" badge
 *  - Displays error state with fallback message
 *  - Gracefully handles missing/null data
 */

import React from 'react';
import { Sparkles, AlertCircle, Bot } from 'lucide-react';
import type { LLMInsightsPanelProps } from './types';

export function LLMInsightsPanel({ insight, isQuerying, error }: LLMInsightsPanelProps) {
  // Nothing to show yet
  if (!isQuerying && !insight && !error) {
    return null;
  }

  return (
    <div className="ogi-card ogi-llm-panel">
      <div className="ogi-card-header">
        <h3 className="ogi-card-title ogi-card-title--secondary">
          <Bot />
          AI Insights
        </h3>
        <span className="ogi-badge ogi-badge--ai">AI-generated</span>
      </div>

      <div className="ogi-card-body ogi-card-body--padded">
        {/* Loading State */}
        {isQuerying && (
          <div className="ogi-llm-loading">
            <div className="ogi-llm-loading-spinner" />
            <p className="ogi-llm-loading-text">Analyzing your knowledge graph...</p>
          </div>
        )}

        {/* Error State */}
        {!isQuerying && error && (
          <div className="ogi-llm-error">
            <AlertCircle />
            <div>
              <p className="ogi-llm-error-title">LLM unavailable</p>
              <p className="ogi-llm-error-detail">{error}</p>
              <p className="ogi-llm-error-fallback">Showing structural insights only.</p>
            </div>
          </div>
        )}

        {/* Success State */}
        {!isQuerying && !error && insight && (
          <div className="ogi-llm-result">
            <div className="ogi-llm-query-echo">
              <Sparkles />
              <span>"{insight.query}"</span>
            </div>
            <div className="ogi-llm-response">
              {formatResponse(insight.response)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Converts the LLM plain-text response into JSX with basic formatting.
 * Handles bullet points (- or •), numbered lists, and paragraphs.
 * No markdown parser needed — keeps bundle minimal.
 */
function formatResponse(text: string): React.ReactElement[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const elements: React.ReactElement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Warning annotation from validation
    if (line.startsWith('⚠️')) {
      elements.push(
        <p key={i} className="ogi-llm-warning">{line}</p>
      );
      continue;
    }

    // Bullet point
    if (/^[-•*]\s/.test(line)) {
      elements.push(
        <div key={i} className="ogi-llm-bullet">
          <span className="ogi-llm-bullet-dot">•</span>
          <span>{line.replace(/^[-•*]\s+/, '')}</span>
        </div>
      );
      continue;
    }

    // Numbered list item
    if (/^\d+[.)]\s/.test(line)) {
      const match = line.match(/^(\d+)[.)]\s+(.*)$/);
      if (match) {
        elements.push(
          <div key={i} className="ogi-llm-bullet">
            <span className="ogi-llm-bullet-num">{match[1]}.</span>
            <span>{match[2]}</span>
          </div>
        );
        continue;
      }
    }

    // Bold markers (simple **text** → <strong>)
    const formatted = line.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong>$1</strong>'
    );

    // Regular paragraph
    elements.push(
      <p
        key={i}
        className="ogi-llm-paragraph"
        dangerouslySetInnerHTML={
          formatted !== line ? { __html: formatted } : undefined
        }
      >
        {formatted === line ? line : undefined}
      </p>
    );
  }

  return elements;
}

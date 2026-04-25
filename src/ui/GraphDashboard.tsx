import { SearchBar } from './SearchBar';
import { StatsOverview } from './StatsOverview';
import { OrphanNotesList } from './OrphanNotesList';
import { ClusterList } from './ClusterList';
import { SuggestionsPanel } from './SuggestionsPanel';
import { LLMQueryInput } from './LLMQueryInput';
import { LLMInsightsPanel } from './LLMInsightsPanel';
import { LLMSettingsPanel } from './LLMSettingsPanel';
import { KnowledgeGapsPanel } from './KnowledgeGapsPanel';
import { FixMyVaultPanel } from './FixMyVaultPanel';
import { BrainCircuit } from 'lucide-react';
import { useState } from 'react';
import type { GraphDashboardProps } from './types';

/**
 * Root UI component for the Obsidian Graph Intelligence plugin.
 * Accepts all data and callbacks as props — no internal data fetching.
 *
 * LLM integration is fully optional: if LLM props are not provided,
 * the dashboard renders identically to the pre-LLM version.
 */
export function GraphDashboard({
  stats,
  orphans,
  clusters,
  suggestions,
  knowledgeGaps,
  semanticProgress,
  onSearch,
  onSuggestLinks = () => {},
  onAcceptSuggestion = () => {},
  onDismissSuggestion = () => {},
  // LLM props (all optional)
  onLLMQuery,
  llmState,
  llmSettings,
  onLLMSettingsChange,
  onTestLLMConnection,
  // Action layer props (all optional)
  onLinkNotes,
  onOpenNotes,
  onCreateNote,
  onCreateBridgeNote,
}: GraphDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const isLLMEnabled = !!onLLMQuery;

  return (
    <div className="ogi-root">
      <div className="ogi-container">
        {/* Header */}
        <header className="ogi-header">
          <div className="ogi-header-brand">
            <div className="ogi-header-icon">
              <BrainCircuit />
            </div>
            <div>
              <h1 className="ogi-title">Graph Intelligence</h1>
              <p className="ogi-subtitle">Actionable insights for your Obsidian vault</p>
              {semanticProgress && semanticProgress.isAnalyzing && (
                <p className="ogi-subtitle" style={{ color: 'var(--ogi-secondary)', fontSize: '11px', marginTop: '4px' }}>
                  <span className="ogi-orphan-dot" style={{ display: 'inline-block', marginRight: '4px', animation: 'pulse 2s infinite' }}></span>
                  Analyzing semantics... ({semanticProgress.processed}/{semanticProgress.total})
                </p>
              )}
            </div>
          </div>

          {/* Search bar — local filtering only */}
          <div className="ogi-search-wrapper">
            <SearchBar value={searchQuery} onChange={handleSearchChange} />
          </div>
        </header>

        {/* Stats */}
        <section>
          <StatsOverview
            totalNotes={stats.totalNotes}
            totalLinks={stats.totalLinks}
            orphanNotes={stats.orphanNotes}
            clusters={stats.clusters}
          />
        </section>

        {/* ── Fix My Vault Section ── */}
        <FixMyVaultPanel 
          data={{ stats, orphans, clusters, suggestions, knowledgeGaps, semanticProgress }}
          onLinkNotes={onLinkNotes}
          onCreateBridgeNote={onCreateBridgeNote}
          onOpenNotes={onOpenNotes}
        />

        {/* ── AI Assistant Section — always visible when LLM is enabled ── */}
        {isLLMEnabled && (
          <section className="ogi-llm-section">
            <div className="ogi-llm-section-header">
              <h2 className="ogi-llm-section-title">
                <BrainCircuit />
                AI Assistant
              </h2>
            </div>

            {/* LLM Settings — always visible (provider, key, model, test) */}
            {llmSettings && onLLMSettingsChange && (
              <LLMSettingsPanel
                settings={llmSettings}
                onChange={onLLMSettingsChange}
                onTestConnection={onTestLLMConnection}
              />
            )}

            {/* AI Query Input */}
            <LLMQueryInput
              onSubmit={onLLMQuery!}
              isQuerying={llmState?.isQuerying ?? false}
            />

            {/* LLM Insights Panel */}
            {llmState && (
              <LLMInsightsPanel
                insight={llmState.currentInsight}
                isQuerying={llmState.isQuerying}
                error={llmState.error}
              />
            )}
          </section>
        )}

        {/* ── Knowledge Gaps Section ── */}
        <KnowledgeGapsPanel
          gaps={knowledgeGaps}
          onLinkNotes={onLinkNotes}
          onCreateBridgeNote={onCreateBridgeNote}
          onOpenNotes={onOpenNotes}
        />

        {/* Content Grid */}
        <section className="ogi-grid">
          <div className="ogi-column">
            <SuggestionsPanel
              suggestions={suggestions}
              onAccept={onAcceptSuggestion}
              onDismiss={onDismissSuggestion}
              onLinkNotes={onLinkNotes}
              onOpenNotes={onOpenNotes}
            />
            <OrphanNotesList
              notes={orphans}
              onSuggestLinks={onSuggestLinks}
            />
          </div>
          <div className="ogi-column">
            <ClusterList clusters={clusters} />
          </div>
        </section>
      </div>
    </div>
  );
}

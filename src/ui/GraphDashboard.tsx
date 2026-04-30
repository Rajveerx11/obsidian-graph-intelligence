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
import { BrainCircuit, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { GraphDashboardProps } from './types';

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

  onLLMQuery,
  llmState,
  llmSettings,
  onLLMSettingsChange,
  onTestLLMConnection,

  onLinkNotes,
  onOpenNotes,
  onCreateNote,
  onCreateBridgeNote,
  onApplyFixPlan,
}: GraphDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAIAssistantExpanded, setIsAIAssistantExpanded] = useState(true);
  const aiSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (llmState?.isQuerying) {
      setIsAIAssistantExpanded(true);
      if (aiSectionRef.current) {
        aiSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [llmState?.isQuerying]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const isLLMEnabled = !!onLLMQuery;

  return (
    <div className="ogi-root">
      <div className="ogi-container">

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

          <div className="ogi-search-wrapper">
            <SearchBar value={searchQuery} onChange={handleSearchChange} />
          </div>
        </header>

        <section>
          <StatsOverview
            totalNotes={stats.totalNotes}
            totalLinks={stats.totalLinks}
            orphanNotes={stats.orphanNotes}
            clusters={stats.clusters}
          />
        </section>

        <FixMyVaultPanel
          data={{ stats, orphans, clusters, suggestions, knowledgeGaps, semanticProgress }}
          onLinkNotes={onLinkNotes}
          onCreateBridgeNote={onCreateBridgeNote}
          onOpenNotes={onOpenNotes}
          onApplyFixPlan={onApplyFixPlan}
        />

        {isLLMEnabled && (
          <section className="ogi-llm-section" ref={aiSectionRef}>
            <div
              className="ogi-llm-section-header"
              style={{ cursor: 'pointer', borderBottom: isAIAssistantExpanded ? '1px solid var(--ogi-border)' : 'none' }}
              onClick={() => setIsAIAssistantExpanded(!isAIAssistantExpanded)}
            >
              <h2 className="ogi-llm-section-title">
                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ogi-muted)', marginRight: '2px' }}>
                  {isAIAssistantExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <BrainCircuit size={16} />
                AI Assistant
              </h2>
            </div>

            {isAIAssistantExpanded && (
              <>

                {llmSettings && onLLMSettingsChange && (
                  <LLMSettingsPanel
                    settings={llmSettings}
                    onChange={onLLMSettingsChange}
                    onTestConnection={onTestLLMConnection}
                  />
                )}

                <LLMQueryInput
                  onSubmit={onLLMQuery!}
                  isQuerying={llmState?.isQuerying ?? false}
                />

                {llmState && (
                  <LLMInsightsPanel
                    insight={llmState.currentInsight}
                    isQuerying={llmState.isQuerying}
                    error={llmState.error}
                  />
                )}
              </>
            )}
          </section>
        )}

        <KnowledgeGapsPanel
          gaps={knowledgeGaps}
          onLinkNotes={onLinkNotes}
          onCreateBridgeNote={onCreateBridgeNote}
          onOpenNotes={onOpenNotes}
        />

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

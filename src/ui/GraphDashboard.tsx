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
import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import type { GraphDashboardProps } from './types';

function ChapterMark({ index, label }: { index: number; label: string }) {
  const num = String(index).padStart(2, '0');
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
        fontFamily: 'var(--ogi-font-label)',
        fontSize: 9,
        letterSpacing: '0.24em',
        textTransform: 'uppercase',
        color: 'var(--ogi-marginalia)',
        fontWeight: 700,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--ogi-font-mono)',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--ogi-accent)',
          letterSpacing: '0.04em',
        }}
      >
        §{num}
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background:
            'linear-gradient(90deg, var(--ogi-rule) 0%, transparent 100%)',
        }}
      />
      <span>{label}</span>
    </div>
  );
}

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
  const aiPanelId = 'ogi-ai-panel';

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

  const handleAIHeaderKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsAIAssistantExpanded(v => !v);
    }
  };

  const isLLMEnabled = !!onLLMQuery;

  return (
    <div className="ogi-root" role="application" aria-label="Graph Intelligence dashboard">
      <div className="ogi-container">

        <header className="ogi-header" role="banner">
          <div className="ogi-header-brand">
            <div className="ogi-header-icon" aria-hidden="true">
              <BrainCircuit />
            </div>
            <div>
              <h1 className="ogi-title">Graph Intelligence</h1>
              <p className="ogi-subtitle">A field guide to your vault</p>
              {semanticProgress && semanticProgress.isAnalyzing && (
                <p
                  className="ogi-subtitle"
                  role="status"
                  aria-live="polite"
                  style={{ color: 'var(--ogi-amber)', marginTop: 6 }}
                >
                  <span
                    className="ogi-orphan-dot"
                    aria-hidden="true"
                    style={{ display: 'inline-block', marginRight: 6 }}
                  ></span>
                  Surveying semantics · {semanticProgress.processed}/{semanticProgress.total}
                </p>
              )}
            </div>
          </div>

          <div className="ogi-search-wrapper">
            <SearchBar value={searchQuery} onChange={handleSearchChange} />
          </div>
        </header>

        <section aria-labelledby="ogi-ch-stats">
          <ChapterMark index={1} label="Ledger" />
          <h2 id="ogi-ch-stats" className="ogi-visually-hidden" style={{
            position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
            overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
          }}>Vault statistics</h2>
          <StatsOverview
            totalNotes={stats.totalNotes}
            totalLinks={stats.totalLinks}
            orphanNotes={stats.orphanNotes}
            clusters={stats.clusters}
          />
        </section>

        <section aria-labelledby="ogi-ch-fix">
          <ChapterMark index={2} label="Restoration" />
          <h2 id="ogi-ch-fix" className="ogi-visually-hidden" style={{
            position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
            overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
          }}>Fix my vault</h2>
          <FixMyVaultPanel
            data={{ stats, orphans, clusters, suggestions, knowledgeGaps, semanticProgress }}
            onLinkNotes={onLinkNotes}
            onCreateBridgeNote={onCreateBridgeNote}
            onOpenNotes={onOpenNotes}
            onApplyFixPlan={onApplyFixPlan}
          />
        </section>

        {isLLMEnabled && (
          <section
            className="ogi-llm-section"
            ref={aiSectionRef}
            aria-labelledby="ogi-ch-ai"
          >
            <ChapterMark index={3} label="Cartographer" />
            <div
              className="ogi-llm-section-header"
              role="button"
              tabIndex={0}
              aria-expanded={isAIAssistantExpanded}
              aria-controls={aiPanelId}
              onClick={() => setIsAIAssistantExpanded(v => !v)}
              onKeyDown={handleAIHeaderKey}
              style={{
                cursor: 'pointer',
                borderBottom: isAIAssistantExpanded
                  ? 'var(--ogi-hairline) solid var(--ogi-rule)'
                  : 'none',
              }}
            >
              <h2 id="ogi-ch-ai" className="ogi-llm-section-title">
                <span aria-hidden="true" style={{
                  display: 'flex', alignItems: 'center',
                  color: 'var(--ogi-marginalia)', marginRight: 2,
                }}>
                  {isAIAssistantExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <BrainCircuit size={16} />
                AI Cartographer
              </h2>
            </div>

            {isAIAssistantExpanded && (
              <div id={aiPanelId}>

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
              </div>
            )}
          </section>
        )}

        <section aria-labelledby="ogi-ch-gaps" className="ogi-gaps-section">
          <ChapterMark index={4} label="Uncharted" />
          <h2 id="ogi-ch-gaps" className="ogi-visually-hidden" style={{
            position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
            overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
          }}>Knowledge gaps</h2>
          <KnowledgeGapsPanel
            gaps={knowledgeGaps}
            onLinkNotes={onLinkNotes}
            onCreateBridgeNote={onCreateBridgeNote}
            onOpenNotes={onOpenNotes}
          />
        </section>

        <section className="ogi-grid" aria-labelledby="ogi-ch-atlas">
          <h2 id="ogi-ch-atlas" className="ogi-visually-hidden" style={{
            position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
            overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
          }}>Atlas — clusters, orphans, suggestions</h2>
          <div className="ogi-column">
            <ChapterMark index={5} label="Suggestions" />
            <SuggestionsPanel
              suggestions={suggestions}
              onAccept={onAcceptSuggestion}
              onDismiss={onDismissSuggestion}
              onLinkNotes={onLinkNotes}
              onOpenNotes={onOpenNotes}
            />
            <ChapterMark index={6} label="Orphans" />
            <OrphanNotesList
              notes={orphans}
              onSuggestLinks={onSuggestLinks}
            />
          </div>
          <div className="ogi-column">
            <ChapterMark index={7} label="Continents" />
            <ClusterList clusters={clusters} />
          </div>
        </section>
      </div>
    </div>
  );
}

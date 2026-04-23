import { SearchBar } from './SearchBar';
import { StatsOverview } from './StatsOverview';
import { OrphanNotesList } from './OrphanNotesList';
import { ClusterList } from './ClusterList';
import { SuggestionsPanel } from './SuggestionsPanel';
import { BrainCircuit } from 'lucide-react';
import { useState } from 'react';
import type { GraphDashboardProps } from './types';

/**
 * Root UI component for the Obsidian Graph Intelligence plugin.
 * Accepts all data and callbacks as props — no internal data fetching.
 */
export function GraphDashboard({
  stats,
  orphans,
  clusters,
  suggestions,
  onSearch,
  onSuggestLinks = () => {},
  onAcceptSuggestion = () => {},
  onDismissSuggestion = () => {},
}: GraphDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

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
            </div>
          </div>
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

        {/* Content Grid */}
        <section className="ogi-grid">
          <div className="ogi-column">
            <SuggestionsPanel
              suggestions={suggestions}
              onAccept={onAcceptSuggestion}
              onDismiss={onDismissSuggestion}
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

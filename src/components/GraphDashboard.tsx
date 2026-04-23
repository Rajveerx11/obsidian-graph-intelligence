import { SearchBar } from './SearchBar';
import { StatsOverview } from './StatsOverview';
import { OrphanNotesList, OrphanNote } from './OrphanNotesList';
import { ClusterList, Cluster } from './ClusterList';
import { SuggestionsPanel, Suggestion } from './SuggestionsPanel';
import { BrainCircuit } from 'lucide-react';
import { useState } from 'react';

// DUMMY PROPS / INTERFACES
export interface GraphDashboardProps {
  stats: {
    totalNotes: number;
    totalLinks: number;
    orphanNotes: number;
    clusters: number;
  };
  orphans: OrphanNote[];
  clusters: Cluster[];
  suggestions: Suggestion[];
  // Handlers
  onSuggestLinks?: (noteId: string) => void;
  onAcceptSuggestion?: (id: string) => void;
  onDismissSuggestion?: (id: string) => void;
}

export function GraphDashboard({
  stats,
  orphans,
  clusters,
  suggestions,
  onSuggestLinks = () => {},
  onAcceptSuggestion = () => {},
  onDismissSuggestion = () => {},
}: GraphDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="w-full h-full min-h-screen bg-obs-bg text-obs-text p-4 md:p-6 lg:p-8 flex justify-center overflow-y-auto font-sans">
      <div className="w-full max-w-4xl space-y-6 flex flex-col">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-obs-primary/10 rounded-2xl border border-obs-primary/20 shadow-inner">
              <BrainCircuit className="w-6 h-6 text-obs-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-obs-text">Graph Intelligence</h1>
              <p className="text-obs-muted text-sm">Actionable insights for your Obsidian vault</p>
            </div>
          </div>
          
          <div className="w-full md:w-72">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
        </header>

        {/* Overview Stats */}
        <section>
          <StatsOverview
            totalNotes={stats.totalNotes}
            totalLinks={stats.totalLinks}
            orphanNotes={stats.orphanNotes}
            clusters={stats.clusters}
          />
        </section>

        {/* Dashboard Grid Content */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column */}
          <div className="space-y-6 flex flex-col">
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

          {/* Right Column */}
          <div className="space-y-6 flex flex-col">
            <ClusterList clusters={clusters} />
          </div>
        </section>
      </div>
    </div>
  );
}

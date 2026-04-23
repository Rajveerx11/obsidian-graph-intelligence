import { GraphDashboard } from './components/GraphDashboard';

// DUMMY DATA FOR DEMONSTRATION
const DUMMY_STATS = {
  totalNotes: 482,
  totalLinks: 1245,
  orphanNotes: 14,
  clusters: 8,
};

const DUMMY_ORPHANS = [
  { id: '1', title: 'Thoughts on the nature of time' },
  { id: '2', title: 'Meeting notes 2023-11-04' },
  { id: '3', title: 'Grocery list' },
  { id: '4', title: 'Idea for new blog post' },
];

const DUMMY_CLUSTERS = [
  {
    id: 'c1',
    title: 'Machine Learning Concepts',
    notesCount: 42,
    notes: ['Neural Networks', 'Backpropagation', 'Gradient Descent', 'Transformers', 'Attention Mechanism'],
  },
  {
    id: 'c2',
    title: 'Daily Journals (2024)',
    notesCount: 89,
    notes: ['Journal 2024-01-01', 'Journal 2024-01-02', 'Journal 2024-01-03'],
  },
  {
    id: 'c3',
    title: 'Project: Refactoring',
    notesCount: 15,
    notes: ['Architecture overview', 'API Design', 'Database Schema Migration'],
  },
];

const DUMMY_SUGGESTIONS = [
  {
    id: 's1',
    type: 'link' as const,
    description: 'Link "Neural Networks" to "Backpropagation" (found strong textual similarity).',
  },
  {
    id: 's2',
    type: 'bridge' as const,
    description: 'Create a bridge note combining "Idea for new blog post" and "Architecture overview".',
  },
  {
    id: 's3',
    type: 'link' as const,
    description: 'Link "Thoughts on the nature of time" to "Journal 2024-01-01".',
  },
];

export default function App() {
  return (
    <GraphDashboard 
      stats={DUMMY_STATS}
      orphans={DUMMY_ORPHANS}
      clusters={DUMMY_CLUSTERS}
      suggestions={DUMMY_SUGGESTIONS}
      onSuggestLinks={(id) => console.log('Suggest links for', id)}
      onAcceptSuggestion={(id) => console.log('Accepted suggestion', id)}
      onDismissSuggestion={(id) => console.log('Dismissed suggestion', id)}
    />
  );
}


import { FileText, Link as LinkIcon, Network, AlertTriangle } from 'lucide-react';
import type { StatItemProps, StatsOverviewProps } from './types';

function StatCard({ label, value, icon: Icon, colorClass }: StatItemProps) {
  return (
    <div className="bg-obs-panel border border-obs-border rounded-2xl p-4 flex items-start gap-4 shadow-sm shadow-black/10 hover:shadow-md hover:shadow-black/20 transition-shadow">
      <div className={`p-2 rounded-xl bg-obs-bg/50 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-obs-muted text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
        <p className="text-obs-text text-xl font-semibold leading-none">{value}</p>
      </div>
    </div>
  );
}

export function StatsOverview({
  totalNotes,
  totalLinks,
  orphanNotes,
  clusters,
}: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        label="Total Notes"
        value={totalNotes}
        icon={FileText}
        colorClass="text-obs-primary"
      />
      <StatCard
        label="Total Links"
        value={totalLinks}
        icon={LinkIcon}
        colorClass="text-obs-secondary"
      />
      <StatCard
        label="Orphans"
        value={orphanNotes}
        icon={AlertTriangle}
        colorClass="text-obs-warning"
      />
      <StatCard
        label="Clusters"
        value={clusters}
        icon={Network}
        colorClass="text-obs-danger"
      />
    </div>
  );
}

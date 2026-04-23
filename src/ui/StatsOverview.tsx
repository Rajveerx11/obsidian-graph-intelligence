import { FileText, Link as LinkIcon, Network, AlertTriangle } from 'lucide-react';
import type { ComponentType } from 'react';
import type { StatsOverviewProps } from './types';

type StatVariant = 'primary' | 'secondary' | 'warning' | 'danger';

interface StatItemProps {
  label: string;
  value: string | number;
  icon: ComponentType;
  variant: StatVariant;
}

function StatCard({ label, value, icon: Icon, variant }: StatItemProps) {
  return (
    <div className="ogi-stat-card">
      <div className={`ogi-stat-icon ogi-stat-icon--${variant}`}>
        <Icon />
      </div>
      <div>
        <p className="ogi-stat-label">{label}</p>
        <p className="ogi-stat-value">{value}</p>
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
    <div className="ogi-stats-grid">
      <StatCard label="Total Notes" value={totalNotes} icon={FileText} variant="primary" />
      <StatCard label="Total Links" value={totalLinks} icon={LinkIcon} variant="secondary" />
      <StatCard label="Orphans" value={orphanNotes} icon={AlertTriangle} variant="warning" />
      <StatCard label="Clusters" value={clusters} icon={Network} variant="danger" />
    </div>
  );
}

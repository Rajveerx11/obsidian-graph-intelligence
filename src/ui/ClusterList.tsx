import { ChevronDown, ChevronRight, Folder, FileText } from 'lucide-react';
import { useState } from 'react';
import type { ClusterListProps } from './types';

export function ClusterList({ clusters }: ClusterListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleCluster = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="ogi-card">
      <div className="ogi-card-header">
        <h3 className="ogi-card-title ogi-card-title--primary">
          <Folder />
          Detected Clusters
        </h3>
        <span className="ogi-badge ogi-badge--primary">{clusters.length}</span>
      </div>

      <div className="ogi-card-body ogi-card-body--tall">
        {clusters.map((cluster) => {
          const isExpanded = expandedIds.has(cluster.id);
          return (
            <div key={cluster.id} className="ogi-cluster-item">
              <button
                onClick={() => toggleCluster(cluster.id)}
                className="ogi-cluster-toggle"
              >
                <div className="ogi-cluster-toggle-label">
                  {isExpanded ? <ChevronDown /> : <ChevronRight />}
                  {cluster.title}
                </div>
                <span className="ogi-count-badge">{cluster.notesCount} notes</span>
              </button>

              {isExpanded && (
                <div className="ogi-cluster-notes">
                  {cluster.notes.map((note, idx) => (
                    <div key={idx} className="ogi-note-item">
                      <FileText />
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

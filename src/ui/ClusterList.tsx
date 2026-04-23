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
    <div className="bg-obs-panel border border-obs-border rounded-2xl overflow-hidden shadow-sm shadow-black/10 flex flex-col">
      <div className="px-4 py-3 border-b border-obs-border bg-obs-panel/50 flex justify-between items-center">
        <h3 className="text-obs-text font-medium text-sm flex items-center gap-2">
          <Folder className="w-4 h-4 text-obs-primary" />
          Detected Clusters
        </h3>
        <span className="bg-obs-primary/10 text-obs-primary text-xs font-semibold px-2 py-0.5 rounded-full">
          {clusters.length}
        </span>
      </div>
      
      <div className="p-2 space-y-1 overflow-y-auto max-h-[350px]">
        {clusters.map((cluster) => {
          const isExpanded = expandedIds.has(cluster.id);
          
          return (
            <div key={cluster.id} className="rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCluster(cluster.id)}
                className="w-full flex items-center justify-between p-2.5 hover:bg-obs-bg/50 transition-colors text-left focus:outline-none rounded-xl"
              >
                <div className="flex items-center gap-2 text-sm text-obs-text font-medium">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-obs-muted" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-obs-muted" />
                  )}
                  {cluster.title}
                </div>
                <span className="text-xs text-obs-muted bg-obs-bg px-2 py-0.5 rounded-lg border border-obs-border">
                  {cluster.notesCount} notes
                </span>
              </button>
              
              {isExpanded && (
                <div className="pl-9 pr-3 pb-2 pt-1 border-l border-obs-border ml-5 mt-1 space-y-1.5">
                  {cluster.notes.map((note, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-obs-muted hover:text-obs-text transition-colors cursor-pointer">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="truncate">{note}</span>
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

import { useEffect, useState } from 'react';
import { ShieldCheck, Play, Link as LinkIcon, FilePlus, ExternalLink, Loader2, CheckCircle, AlertCircle, Zap, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { generateFixPlan } from '../fix/fixEngine';
import type { FixItem } from '../fix/fixTypes';
import type { FixMyVaultPanelProps } from './types';

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';
interface ItemStatus { status: ActionStatus; message?: string; }
type PriorityCount = Record<FixItem['priority'], number>;

export function FixMyVaultPanel({ data, onLinkNotes, onCreateBridgeNote, onOpenNotes, onApplyFixPlan }: FixMyVaultPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fixPlan, setFixPlan] = useState<FixItem[] | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ItemStatus>>({});
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!fixPlan || isApplyingAll) return;
    setFixPlan(generateFixPlan(data));
  }, [
    data.stats.totalNotes,
    data.stats.totalLinks,
    data.stats.orphanNotes,
    data.stats.clusters,
    data.suggestions.length,
    data.knowledgeGaps.length,
    isApplyingAll,
  ]);

  const handleAnalyze = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion toggle
    if (!isExpanded) setIsExpanded(true);
    setBatchMessage(null);
    
    setIsAnalyzing(true);
    // Non-blocking timeout for UX to show the "Analysis" taking place
    setTimeout(() => {
      setFixPlan(generateFixPlan(data));
      setIsAnalyzing(false);
    }, 1200);
  };

  const getStatus = (id: string): ItemStatus => actionStates[id] ?? { status: 'idle' };

  const setStatus = (id: string, status: ItemStatus) => {
    setActionStates(prev => ({ ...prev, [id]: status }));
    if (status.status === 'success' || status.status === 'error') {
      setTimeout(() => {
        setActionStates(prev => ({ ...prev, [id]: { status: 'idle' } }));
      }, 2500);
    }
  };

  const executeAction = async (fix: FixItem) => {
    if (getStatus(fix.id).status === 'loading') return;
    setStatus(fix.id, { status: 'loading' });

    let result = { success: false, message: 'Action not supported' };
    try {
      if (fix.action.actionType === 'link' && onLinkNotes && fix.action.payload.sourceId && fix.action.payload.targetId) {
        result = await onLinkNotes(fix.action.payload.sourceId, fix.action.payload.targetId);
      } else if (fix.action.actionType === 'create_note' && onCreateBridgeNote && fix.action.payload.sourceId && fix.action.payload.targetId) {
        result = await onCreateBridgeNote(fix.action.payload.sourceId, fix.action.payload.targetId);
      } else if (fix.action.actionType === 'open' && onOpenNotes && fix.action.payload.noteIds) {
        result = await onOpenNotes(fix.action.payload.noteIds);
      } else {
        result = { success: false, message: 'Action payload invalid or handler missing.' };
      }
    } catch (e: any) {
      result = { success: false, message: e.message || 'Action failed' };
    }

    setStatus(fix.id, {
      status: result.success ? 'success' : 'error',
      message: result.message
    });
    return result;
  };

  const handleApplyAll = async () => {
    if (!fixPlan) return;
    setIsApplyingAll(true);
    setBatchMessage('Applying repairs...');
    
    try {
      if (onApplyFixPlan) {
        for (const fix of fixPlan) {
          setStatus(fix.id, { status: 'loading' });
        }

        const batch = await onApplyFixPlan(fixPlan);
        setBatchMessage(batch.message);
        const byId = new Map(batch.results.map((result) => [result.fixId, result]));
        for (const fix of fixPlan) {
          const result = byId.get(fix.id) ?? {
            success: false,
            message: 'This issue was not changed by the batch repair.',
          };
          setStatus(fix.id, {
            status: result.success ? 'success' : 'error',
            message: result.message,
          });
        }
        return;
      }

      for (const fix of fixPlan) {
        const result = await executeAction(fix);
        if (!result) continue;
      }
      setBatchMessage('Applied available repairs.');
    } catch (err) {
      console.error('[ogi] Apply All failed:', err);
      setBatchMessage('Apply All failed. Check the developer console for details.');
    } finally {
      setIsApplyingAll(false);
    }
  };

  const renderStatusIcon = (id: string) => {
    const { status, message } = getStatus(id);
    if (status === 'loading') return <Loader2 className="ogi-spin" size={16} />;
    if (status === 'success') return <CheckCircle size={16} />;
    if (status === 'error') return <span title={message}><AlertCircle size={16} /></span>;
    return null;
  };

  const priorityCounts: PriorityCount = (fixPlan ?? []).reduce<PriorityCount>(
    (counts, fix) => {
      counts[fix.priority] += 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0 },
  );

  const completedCount = fixPlan?.filter((fix) => getStatus(fix.id).status === 'success').length ?? 0;
  const activeCount = fixPlan?.filter((fix) => getStatus(fix.id).status === 'loading').length ?? 0;

  return (
    <section className="ogi-fix-section" aria-busy={isAnalyzing || isApplyingAll}>
      <div className={`ogi-card ogi-fix-card ${isAnalyzing || isApplyingAll ? 'ogi-fix-card--busy' : ''}`}>
        <div 
          className="ogi-card-header ogi-fix-header" 
          onClick={() => setIsExpanded(!isExpanded)}
          role="button"
          aria-expanded={isExpanded}
        >
          <div className="ogi-fix-title-wrap">
            <span className="ogi-fix-chevron">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
            <Zap className="ogi-fix-title-icon" size={16} />
            <div>
              <h3 className="ogi-card-title ogi-fix-title">Fix My Vault</h3>
              {fixPlan && (
                <p className="ogi-fix-subtitle">
                  {fixPlan.length} issue{fixPlan.length === 1 ? '' : 's'}
                  {completedCount > 0 ? `, ${completedCount} applied` : ''}
                </p>
              )}
            </div>
          </div>
          
          <div className="ogi-fix-actions">
            {fixPlan && fixPlan.length > 0 && isExpanded && (
              <button 
                type="button"
                className="ogi-btn ogi-btn--apply" 
                onClick={(e) => { e.stopPropagation(); handleApplyAll(); }}
                disabled={isApplyingAll}
                title="Analyze and apply every automatable repair"
              >
                {isApplyingAll ? <Loader2 className="ogi-spin" size={16} /> : <Shield size={16} />}
                Apply All
              </button>
            )}
            <button 
              type="button"
              className="ogi-btn ogi-btn--analyze" 
              onClick={handleAnalyze} 
              disabled={isAnalyzing || isApplyingAll}
            >
              {isAnalyzing ? <Loader2 className="ogi-spin" size={16} /> : <Play size={16} />}
              {fixPlan ? 'Re-Analyze' : 'Analyze & Improve'}
            </button>
          </div>
        </div>

        {isExpanded && isAnalyzing && (
          <div className="ogi-card-body ogi-card-body--padded ogi-fix-state">
            <Loader2 className="ogi-spin ogi-fix-state-icon" size={24} />
            <p>Analyzing vault structure and semantics...</p>
          </div>
        )}

        {isExpanded && !isAnalyzing && fixPlan && fixPlan.length === 0 && (
          <div className="ogi-card-body ogi-card-body--padded ogi-fix-state ogi-fix-state--empty">
            <ShieldCheck size={32} />
            <p>Your vault is in great shape! No critical issues found.</p>
          </div>
        )}

        {isExpanded && !isAnalyzing && fixPlan && fixPlan.length > 0 && (
          <div className="ogi-card-body ogi-card-body--padded">
            <div className="ogi-fix-summary">
              <span className="ogi-fix-summary-item ogi-fix-summary-item--high">High {priorityCounts.high}</span>
              <span className="ogi-fix-summary-item ogi-fix-summary-item--medium">Medium {priorityCounts.medium}</span>
              <span className="ogi-fix-summary-item ogi-fix-summary-item--low">Low {priorityCounts.low}</span>
              {activeCount > 0 && <span className="ogi-fix-summary-item ogi-fix-summary-item--active">Running {activeCount}</span>}
            </div>

            {batchMessage && (
              <div className="ogi-fix-batch-message">
                {isApplyingAll && <Loader2 className="ogi-spin" size={13} />}
                <span>{batchMessage}</span>
              </div>
            )}

            <div className="ogi-fix-list">
              {fixPlan.map(fix => {
                const actionIcon = 
                  fix.action.actionType === 'link' ? <LinkIcon size={14} /> :
                  fix.action.actionType === 'create_note' ? <FilePlus size={14} /> :
                  <ExternalLink size={14} />;

                const status = getStatus(fix.id).status;
                const isBtnDisabled = status === 'loading' || status === 'success';
                const actionClass = fix.action.actionType === 'create_note' ? 'create' : fix.action.actionType;

                return (
                  <div key={fix.id} className={`ogi-fix-item ogi-fix-item--${fix.priority}`}>
                    <div className="ogi-fix-item-header">
                      <div className="ogi-fix-item-title-row">
                        <span className={`ogi-fix-priority ogi-fix-priority--${fix.priority}`}>
                          {fix.priority} Priority
                        </span>
                        <h4 className="ogi-fix-item-title">{fix.title}</h4>
                      </div>
                      <span className="ogi-gap-confidence-label">
                        {(fix.confidence * 100).toFixed(0)}% Match
                      </span>
                    </div>

                    <p className="ogi-gap-description">{fix.description}</p>
                    
                    <div className="ogi-gap-actions">
                      <button 
                        type="button"
                        className={`ogi-btn ogi-btn--${actionClass} ${status !== 'idle' ? `ogi-btn--${status}` : ''}`}
                        onClick={() => executeAction(fix)}
                        disabled={isBtnDisabled}
                        title={getStatus(fix.id).message ?? fix.action.label}
                      >
                        {renderStatusIcon(fix.id) ?? actionIcon}
                        {fix.action.label}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

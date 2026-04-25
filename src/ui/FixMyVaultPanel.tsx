import { useState } from 'react';
import { ShieldCheck, Play, Link as LinkIcon, FilePlus, ExternalLink, Loader2, CheckCircle, AlertCircle, Zap, Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { generateFixPlan } from '../fix/fixEngine';
import type { FixItem } from '../fix/fixTypes';
import type { FixMyVaultPanelProps } from './types';

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';
interface ItemStatus { status: ActionStatus; message?: string; }

export function FixMyVaultPanel({ data, onLinkNotes, onCreateBridgeNote, onOpenNotes }: FixMyVaultPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fixPlan, setFixPlan] = useState<FixItem[] | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ItemStatus>>({});
  const [isApplyingAll, setIsApplyingAll] = useState(false);

  const handleAnalyze = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion toggle
    if (!isExpanded) setIsExpanded(true);
    
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

  const handleApplyAllSafe = async () => {
    if (!fixPlan) return;
    setIsApplyingAll(true);
    // Safe actions: only 'link'
    const safeFixes = fixPlan.filter(f => f.action.actionType === 'link');
    
    for (const fix of safeFixes) {
      if (getStatus(fix.id).status !== 'success') {
        await executeAction(fix);
      }
    }
    setIsApplyingAll(false);
  };

  const renderStatusIcon = (id: string) => {
    const { status, message } = getStatus(id);
    if (status === 'loading') return <Loader2 className="ogi-spin" size={16} />;
    if (status === 'success') return <CheckCircle size={16} />;
    if (status === 'error') return <span title={message}><AlertCircle size={16} /></span>;
    return null;
  };

  return (
    <section className="ogi-fix-section" style={{ position: 'relative', zIndex: 10, marginBottom: '24px' }}>
      {/* Dynamic animation styles */}
      <style>{`
        @keyframes fixVaultPulse {
          0% { box-shadow: 0 0 0 0 rgba(122, 162, 247, 0.4); border-color: var(--ogi-primary); }
          50% { box-shadow: 0 0 0 6px rgba(122, 162, 247, 0); border-color: var(--ogi-secondary); }
          100% { box-shadow: 0 0 0 0 rgba(122, 162, 247, 0); border-color: var(--ogi-primary); }
        }
        .ogi-fix-analyzing {
          animation: fixVaultPulse 1.5s infinite;
        }
      `}</style>
      
      <div className={`ogi-card ${isAnalyzing ? 'ogi-fix-analyzing' : ''}`} style={{ border: '1px solid var(--ogi-accent)', background: 'var(--ogi-accent-bg)' }}>
        <div 
          className="ogi-card-header" 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ogi-muted)' }}>
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
            <Zap className="ogi-accent-text" size={16} />
            <h3 className="ogi-card-title ogi-accent-text" style={{ margin: 0 }}>Fix My Vault</h3>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {fixPlan && fixPlan.length > 0 && isExpanded && (
              <button 
                type="button"
                className="ogi-btn" 
                onClick={(e) => { e.stopPropagation(); handleApplyAllSafe(); }}
                disabled={isApplyingAll}
                title="Only executes safe linking actions"
                style={{ background: 'var(--ogi-success-bg)', color: 'var(--ogi-success)', borderColor: 'transparent', cursor: 'pointer', opacity: 1 }}
              >
                {isApplyingAll ? <Loader2 className="ogi-spin" size={16} /> : <Shield size={16} />}
                Apply All (Safe Mode)
              </button>
            )}
            <button 
              type="button"
              className="ogi-btn" 
              onClick={handleAnalyze} 
              disabled={isAnalyzing}
              style={{ background: 'var(--ogi-primary)', color: 'var(--ogi-bg)', cursor: 'pointer', opacity: 1 }}
            >
              {isAnalyzing ? <Loader2 className="ogi-spin" size={16} /> : <Play size={16} />}
              {fixPlan ? 'Re-Analyze' : 'Analyze & Improve'}
            </button>
          </div>
        </div>

        {isExpanded && isAnalyzing && (
          <div className="ogi-card-body ogi-card-body--padded" style={{ textAlign: 'center', color: 'var(--ogi-text-muted)' }}>
            <Loader2 className="ogi-spin" style={{ margin: '16px auto', display: 'block' }} size={24} />
            <p>Analyzing vault structure and semantics...</p>
          </div>
        )}

        {isExpanded && !isAnalyzing && fixPlan && fixPlan.length === 0 && (
          <div className="ogi-card-body ogi-card-body--padded" style={{ textAlign: 'center', color: 'var(--ogi-text-muted)' }}>
            <ShieldCheck size={32} style={{ margin: '0 auto 8px', color: 'var(--ogi-success)' }} />
            <p>Your vault is in great shape! No critical issues found.</p>
          </div>
        )}

        {isExpanded && !isAnalyzing && fixPlan && fixPlan.length > 0 && (
          <div className="ogi-card-body ogi-card-body--padded">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {fixPlan.map(fix => {
                const priorityColors = {
                  high: 'var(--ogi-error)',
                  medium: 'var(--ogi-warning)',
                  low: 'var(--ogi-text-muted)'
                };
                
                const actionIcon = 
                  fix.action.actionType === 'link' ? <LinkIcon size={14} /> :
                  fix.action.actionType === 'create_note' ? <FilePlus size={14} /> :
                  <ExternalLink size={14} />;

                const status = getStatus(fix.id).status;
                const isBtnDisabled = status === 'loading' || status === 'success';

                return (
                  <div key={fix.id} className="ogi-gap-item" style={{ borderColor: priorityColors[fix.priority] }}>
                    <div className="ogi-gap-header" style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="ogi-badge" style={{ backgroundColor: priorityColors[fix.priority], color: 'white', textTransform: 'capitalize' }}>
                          {fix.priority} Priority
                        </span>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{fix.title}</h4>
                      </div>
                      <span className="ogi-gap-confidence-label">
                        {(fix.confidence * 100).toFixed(0)}% Match
                      </span>
                    </div>

                    <p className="ogi-gap-description" style={{ marginBottom: '12px' }}>{fix.description}</p>
                    
                    <div className="ogi-gap-actions" style={{ justifyContent: 'flex-start' }}>
                      <button 
                        type="button"
                        className={`ogi-btn ogi-btn--${fix.action.actionType} ${status !== 'idle' ? `ogi-btn--${status}` : ''}`}
                        onClick={() => executeAction(fix)}
                        disabled={isBtnDisabled}
                        style={{ cursor: 'pointer' }}
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

import { useState, useEffect, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  ArrowLeft,
  Printer,
  FileText,
  Calendar,
  Building2,
  Stethoscope,
  Sparkles,
  CircleDot,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  X,
  History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workOrderService, type WorkOrderListItem } from '../services';
import { QRLabelModal } from '../components';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  CREATED: { label: 'Created', color: '#6B7280', bg: '#F3F4F6', icon: <CircleDot size={12} /> },
  ASSIGNED: { label: 'Assigned', color: '#3B82F6', bg: '#EFF6FF', icon: <Clock size={12} /> },
  IN_PROGRESS: { label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB', icon: <PlayCircle size={12} /> },
  INTERNAL_VERIFICATION: { label: 'Internal Verification', color: '#8B5CF6', bg: '#F5F3FF', icon: <CheckCircle2 size={12} /> },
  EXTERNAL_VERIFICATION: { label: 'External Verification', color: '#6366F1', bg: '#EEF2FF', icon: <CheckCircle2 size={12} /> },
  COMPLETED: { label: 'Completed', color: '#10B981', bg: '#ECFDF5', icon: <CheckCircle2 size={12} /> },
  FAILED: { label: 'Failed', color: '#EF4444', bg: '#FEF2F2', icon: <AlertCircle size={12} /> },
  CANCELLED: { label: 'Cancelled', color: '#F97316', bg: '#FFF3E0', icon: <X size={12} /> },
};

const parseNotesAndPayments = (notesString: string | null): { userNotes: string } => {
  if (!notesString) return { userNotes: '' };
  const startTag = '<!-- PAYMENTS_START -->';
  const startIndex = notesString.indexOf(startTag);
  
  if (startIndex !== -1) {
    const userNotes = notesString.substring(0, startIndex).trim();
    return { userNotes };
  }
  return { userNotes: notesString.trim() };
};

const getCombinedProcessLogs = (proc: any, workOrder: any) => {
  const logs: Array<{
    id: string;
    action: string;
    timestamp: string;
    notes: string | null;
  }> = [];

  // 1. Add process activity logs
  if (proc.activityLogs) {
    proc.activityLogs.forEach((log: any) => {
      logs.push({
        id: log.id,
        action: log.action,
        timestamp: log.timestamp,
        notes: log.notes,
      });
    });
  }

  // 2. Add ReworkLog logs for this process step
  if (workOrder && workOrder.reworkLogs) {
    const reworkLogsForStep = workOrder.reworkLogs.filter(
      (log: any) => log.processName === proc.processName
    );
    reworkLogsForStep.forEach((log: any) => {
      // Rework initiation
      logs.push({
        id: `rework-init-${log.id}`,
        action: 'REWORK_ASSIGNED',
        timestamp: log.initiatedAt,
        notes: `Rework cycle #${log.reworkCount} initiated by ${log.initiatedBy?.firstName || 'Admin'} ${log.initiatedBy?.lastName || ''} (Flagged at verification step: "${log.verificationStage}")`,
      });

      // Rework completion
      if (log.completedAt) {
        logs.push({
          id: `rework-comp-${log.id}`,
          action: 'REWORK_COMPLETED',
          timestamp: log.completedAt,
          notes: `Rework cycle #${log.reworkCount} completed by technician.`,
        });
      }

      // Rework approval
      if (log.approvedAt) {
        logs.push({
          id: `rework-appr-${log.id}`,
          action: 'REWORK_APPROVED',
          timestamp: log.approvedAt,
          notes: `Rework cycle #${log.reworkCount} approved at verification step.`,
        });
      }
    });
  }

  // 3. Add RepetitionLog logs where this process was affected
  if (workOrder && workOrder.repetitionLogs) {
    workOrder.repetitionLogs.forEach((log: any) => {
      // Check if this step was reset due to this repetition
      const wasReset = log.completedSteps && log.completedSteps.split(', ').map((s: string) => s.trim()).includes(proc.processName);
      if (wasReset) {
        logs.push({
          id: `rep-reset-${log.id}`,
          action: 'REPETITION_RESET',
          timestamp: log.initiatedAt,
          notes: `Process repeated (Cycle #${log.repetitionCount}). Step reset due to repetition request from verification step "${log.verificationStage}" by ${log.initiatedBy?.firstName || 'Admin'} ${log.initiatedBy?.lastName || ''}.`,
        });
      }

      // Check if this step was the one that triggered the repetition
      if (log.verificationStage === proc.processName) {
        logs.push({
          id: `rep-trig-${log.id}`,
          action: 'REPETITION_TRIGGERED',
          timestamp: log.initiatedAt,
          notes: `Repetition cycle #${log.repetitionCount} triggered by ${log.initiatedBy?.firstName || 'Admin'} ${log.initiatedBy?.lastName || ''}. All preceding completed steps have been reset.`,
        });
      }
    });
  }

  // Sort logs by timestamp descending
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] = useState<WorkOrderListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAuditRow, setExpandedAuditRow] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    workOrderService.getById(id)
      .then((data) => {
        setWorkOrder(data);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load work order details');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: '12px' }}>
        <Loader2 size={36} className="spinner" style={{ color: 'var(--accent-primary, #6FAED9)' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading work order details...</span>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={48} style={{ color: '#EF4444', marginBottom: '1rem' }} />
        <h3>Work Order Not Found</h3>
        <p style={{ color: 'var(--text-muted)' }}>The requested work order could not be loaded.</p>
        <button className="btn btn--outline" onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[workOrder.status] || STATUS_CONFIG.CREATED;
  const processes = workOrder.processes || [];
  const { userNotes } = parseNotesAndPayments(workOrder.notes);

  // Determine active stepper index dynamically based on 6 stages
  let finalStep = { label: 'Completed', statusKey: 'COMPLETED' };
  if (workOrder.status === 'FAILED') {
    finalStep = { label: 'Failed', statusKey: 'FAILED' };
  } else if (workOrder.status === 'CANCELLED') {
    finalStep = { label: 'Cancelled', statusKey: 'CANCELLED' };
  }

  const steps = [
    { label: 'Created', statusKey: 'CREATED' },
    { label: 'Assigned', statusKey: 'ASSIGNED' },
    { label: 'In Progress', statusKey: 'IN_PROGRESS' },
    { label: 'Internal Verification', statusKey: 'INTERNAL_VERIFICATION' },
    { label: 'External Verification', statusKey: 'EXTERNAL_VERIFICATION' },
    finalStep
  ];

  const currentStatusIdx = steps.findIndex(s => s.statusKey === workOrder.status);

  return (
    <div className="work-order-detail-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto', padding: '1rem 0' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div className="page-header__left" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)} style={{ padding: '8px' }} title="Go Back">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-header__title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span>Work Order Details</span>
              <span style={{ 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                padding: '4px 10px', 
                borderRadius: '6px', 
                backgroundColor: 'rgba(111, 174, 217, 0.1)', 
                color: 'var(--accent-primary, #6FAED9)',
                fontFamily: 'monospace',
                border: '1px solid rgba(111, 174, 217, 0.2)'
              }}>
                Folio: {workOrder.folioNumber}
              </span>
              {workOrder.boxNumber && (
                <span style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  padding: '4px 10px', 
                  borderRadius: '6px', 
                  backgroundColor: 'rgba(148, 163, 184, 0.08)', 
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)'
                }}>
                  Box: {workOrder.boxNumber}
                </span>
              )}
            </h1>
            <p className="page-header__subtitle">Operational workflow status and tracking details</p>
          </div>
        </div>
        
        <div className="page-header__right">
          <button className="btn btn--primary" onClick={() => setIsQrModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={16} />
            <span>Print QR Label</span>
          </button>
        </div>
      </div>

      {/* Grid: Left - General Info, Right - Spec Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* General Summary Card */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', color: 'var(--text-heading)' }}>
            <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>General Information</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Patient</span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{workOrder.patient}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Status</span>
              <span className="wo-status-badge" style={{ color: sc.color, backgroundColor: sc.bg, marginTop: '2px' }}>
                {sc.icon}
                <span style={{ marginLeft: '4px' }}>{sc.label}</span>
              </span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}><Stethoscope size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Doctor</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{workOrder.doctor?.name || '—'}</span>
              {workOrder.doctor?.clinicName && (
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{workOrder.doctor.clinicName}</span>
              )}
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}><Sparkles size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Prosthesis Type</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{workOrder.prosthesisType?.name || '—'}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}><CircleDot size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Color</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{workOrder.color}</span>
            </div>
            {workOrder.branch && (
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}><Building2 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Branch</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {workOrder.branch.name} ({workOrder.branch.code})
                </span>
              </div>
            )}
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}><Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Created Date</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {new Date(workOrder.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Specification & Notes Card */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', color: 'var(--text-heading)' }}>
            <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Specifications & Notes</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Specifications</span>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.5', padding: '0.75rem', borderRadius: '8px', backgroundColor: 'var(--bg-overlay, #f8fafc)', border: '1px solid var(--border)' }}>
                {workOrder.specification || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No specification details provided.</span>}
              </div>
            </div>
            {userNotes && (
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Notes</span>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {userNotes}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workflow Stepper Progress */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        padding: '1.75rem 1.5rem 2rem 1.5rem',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Workflow Timeline Progress
        </h3>

        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          position: 'relative',
          width: '100%',
          margin: '0 auto',
        }}>
          {/* Background Line */}
          <div style={{
            position: 'absolute',
            top: '14.5px',
            left: 'calc((100% / 6) / 2)',
            right: 'calc((100% / 6) / 2)',
            height: '3px',
            backgroundColor: 'var(--border, #E5E7EB)',
            zIndex: 1,
            borderRadius: '2px'
          }} />
          
          {/* Active Line Fill */}
          {currentStatusIdx > 0 && (
            <div style={{
              position: 'absolute',
              top: '14.5px',
              left: 'calc((100% / 6) / 2)',
              width: `calc(${currentStatusIdx} * (100% / 6))`,
              height: '3px',
              backgroundColor: workOrder.status === 'COMPLETED' ? 'var(--success, #10B981)' : workOrder.status === 'FAILED' ? '#EF4444' : workOrder.status === 'CANCELLED' ? '#F97316' : 'var(--accent-primary, #6FAED9)',
              boxShadow: `0 0 8px ${workOrder.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.4)' : workOrder.status === 'FAILED' ? 'rgba(239, 68, 68, 0.4)' : workOrder.status === 'CANCELLED' ? 'rgba(249, 115, 22, 0.4)' : 'var(--accent-primary-glow)'}`,
              transition: 'all 0.3s ease',
              zIndex: 1,
              borderRadius: '2px'
            }} />
          )}

          {steps.map((step, idx) => {
            const isCompleted = idx < currentStatusIdx;
            const isActive = idx === currentStatusIdx;
            const isHighlighted = idx <= currentStatusIdx;

            let circleBg = 'var(--bg-surface, #FFFFFF)';
            let circleBorder = '2px solid var(--text-muted, #94A3B8)';
            let circleColor = 'var(--text-muted, #94A3B8)';
            let circleShadow = 'none';
            let symbol: React.ReactNode = idx + 1;

            if (isHighlighted) {
              if (isCompleted) {
                circleBg = 'var(--success, #10B981)';
                circleBorder = '2px solid var(--success, #10B981)';
                circleColor = '#FFFFFF';
                symbol = '✓';
              } else if (isActive) {
                if (workOrder.status === 'COMPLETED') {
                  circleBg = 'var(--success, #10B981)';
                  circleBorder = '2px solid var(--success, #10B981)';
                  circleColor = '#FFFFFF';
                  symbol = '✓';
                  circleShadow = '0 0 0 5px rgba(16, 185, 129, 0.2)';
                } else if (workOrder.status === 'FAILED') {
                  circleBg = '#EF4444';
                  circleBorder = '2px solid #EF4444';
                  circleColor = '#FFFFFF';
                  symbol = '✕';
                  circleShadow = '0 0 0 5px rgba(239, 68, 68, 0.2)';
                } else if (workOrder.status === 'CANCELLED') {
                  circleBg = '#F97316';
                  circleBorder = '2px solid #F97316';
                  circleColor = '#FFFFFF';
                  symbol = '✕';
                  circleShadow = '0 0 0 5px rgba(249, 115, 22, 0.2)';
                } else {
                  circleBg = 'var(--accent-primary, #6FAED9)';
                  circleBorder = '2px solid var(--accent-primary, #6FAED9)';
                  circleColor = '#FFFFFF';
                  circleShadow = '0 0 0 5px var(--accent-primary-glow, rgba(111, 174, 217, 0.3))';
                }
              }
            }

            return (
              <div key={step.label} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                zIndex: 2,
                flex: 1
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: circleBg,
                  border: circleBorder,
                  color: circleColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  boxShadow: circleShadow,
                  transition: 'all 0.3s ease'
                }}>
                  {symbol}
                </div>
                <div style={{
                  marginTop: '0.625rem',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 800 : isHighlighted ? 700 : 500,
                  color: isActive ? (workOrder.status === 'COMPLETED' ? 'var(--success, #10B981)' : workOrder.status === 'FAILED' ? '#EF4444' : workOrder.status === 'CANCELLED' ? '#F97316' : 'var(--accent-primary)') : isHighlighted ? 'var(--text-primary)' : 'var(--text-muted)',
                  textAlign: 'center',
                  maxWidth: '96px',
                  lineHeight: '1.2'
                }}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Processes Table */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Detailed Process Flow</span>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '6px',
            backgroundColor: 'rgba(111, 174, 217, 0.1)',
            color: 'var(--accent-primary)',
            border: '1px solid var(--border)'
          }}>
            Total Steps: {processes.length}
          </span>
        </h3>

        {processes.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
            No processes configured for this work order.
          </div>
        ) : (
          <div style={{
            overflowX: 'auto',
            border: '1px solid var(--border)',
            borderRadius: '8px'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(111, 174, 217, 0.04)' }}>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Step</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Process Name</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Assigned Technician</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Start Time</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>End Time</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Time Audit</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((proc: any, idx: number) => {
                  const stepStatus = proc.status || 'NOT_STARTED';

                  const formatDate = (dateStr: string | Date) => {
                    return new Date(dateStr).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  };

                  let startTimeStr = proc.startedAt ? formatDate(proc.startedAt) : '—';
                  let endTimeStr = proc.endedAt ? formatDate(proc.endedAt) : (stepStatus === 'IN_PROGRESS' ? 'Running...' : stepStatus === 'PAUSED' ? 'Paused' : '—');
                  
                  let badgeColor = 'var(--text-muted, #64748B)';
                  let badgeBg = 'var(--bg-overlay, rgba(148, 163, 184, 0.08))';
                  let statusLabel = 'Not Started';

                  if (stepStatus === 'COMPLETED') {
                    badgeColor = 'var(--success, #10B981)';
                    badgeBg = 'var(--success-bg, rgba(16, 185, 129, 0.08))';
                    statusLabel = 'Complete';
                  } else if (stepStatus === 'IN_PROGRESS') {
                    badgeColor = 'var(--warning, #F59E0B)';
                    badgeBg = 'var(--warning-bg, rgba(245, 158, 11, 0.08))';
                    statusLabel = 'In Progress';
                  } else if (stepStatus === 'PAUSED') {
                    badgeColor = 'var(--warning, #F59E0B)';
                    badgeBg = 'var(--warning-bg, rgba(245, 158, 11, 0.08))';
                    statusLabel = 'Paused';
                  } else if (stepStatus === 'FAILED') {
                    badgeColor = '#EF4444';
                    badgeBg = 'rgba(239, 68, 68, 0.08)';
                    statusLabel = 'Failed';
                  } else if (stepStatus === 'CANCELLED') {
                    badgeColor = '#94A3B8';
                    badgeBg = 'rgba(148, 163, 184, 0.08)';
                    statusLabel = 'Cancelled';
                  }

                  const combinedLogs = getCombinedProcessLogs(proc, workOrder);
                  const hasLogs = combinedLogs.length > 0;
                  const isExpanded = expandedAuditRow === proc.id;

                  const repetitionsForStep = (workOrder?.repetitionLogs || []).filter((r: any) =>
                    r.verificationStage === proc.processName ||
                    (r.completedSteps && r.completedSteps.split(', ').map((s: string) => s.trim()).includes(proc.processName))
                  );

                  return (
                    <Fragment key={proc.id}>
                      <tr style={{
                        borderBottom: idx < processes.length - 1 ? '1px solid var(--border)' : 'none',
                        backgroundColor: stepStatus === 'IN_PROGRESS' ? 'rgba(111, 174, 217, 0.03)' : 'transparent'
                      }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span>{proc.processName}</span>
                            {proc.isVerification && (
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: proc.technicianId ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                color: proc.technicianId ? '#8B5CF6' : '#6366F1'
                              }}>
                                {proc.technicianId ? 'Internal' : 'External'} Verification
                              </span>
                            )}
                            {proc.reworkActive && (
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#EF4444'
                              }}>
                                Rework Active
                              </span>
                            )}
                            {!proc.reworkActive && proc.reworkCount > 0 && (
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                color: '#D97706'
                              }}>
                                Reworked ({proc.reworkCount})
                              </span>
                            )}
                            {repetitionsForStep.length > 0 && (
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                color: '#8B5CF6'
                              }} title={`Step repeated in ${repetitionsForStep.length} cycle(s)`}>
                                Repeated ({repetitionsForStep.length})
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {proc.isVerification && !proc.technicianId ? (
                            <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                              {workOrder.doctor?.name ? `${workOrder.doctor.name} (External Doctor)` : 'External Doctor'}
                            </span>
                          ) : proc.technician ? (
                            `${proc.technician.firstName} ${proc.technician.lastName}`
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{startTimeStr}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{endTimeStr}</td>
                        
                        {/* Time Audit Column */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {hasLogs ? (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: 'var(--accent-primary, #3B82F6)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                backgroundColor: 'transparent'
                              }}
                              onClick={() => setExpandedAuditRow(isExpanded ? null : proc.id)}
                            >
                              <History size={12} />
                              <span>{isExpanded ? 'Hide Audit' : `View Audit (${combinedLogs.length})`}</span>
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>No activity logs</span>
                          )}
                        </td>

                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: '100px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: badgeColor,
                            backgroundColor: badgeBg
                          }}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>

                      {/* Collapsible Audit Logs */}
                      {isExpanded && hasLogs && (
                        <tr style={{ backgroundColor: 'rgba(111, 174, 217, 0.02)' }}>
                          <td colSpan={7} style={{ padding: '0.75rem 1rem 1rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.75rem',
                              padding: '1rem',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-surface)'
                            }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Process Activity History &mdash; {proc.processName}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {combinedLogs.map((log: any, lidx: number) => {
                                  const getActionLabel = (act: string) => {
                                    switch (act) {
                                      case 'START': return 'Process Started';
                                      case 'PAUSE': return 'Process Paused';
                                      case 'RESUME': return 'Process Resumed';
                                      case 'END': return 'Process Completed';
                                      case 'REWORK_ASSIGNED': return 'Rework Assigned';
                                      case 'REWORK_COMPLETED': return 'Rework Completed';
                                      case 'REWORK_APPROVED': return 'Rework Approved';
                                      case 'REPETITION_RESET': return 'Process Repeated (Reset)';
                                      case 'REPETITION_TRIGGERED': return 'Repetition Triggered';
                                      default: return act.replace('_', ' ');
                                    }
                                  };

                                  const getActionColor = (act: string) => {
                                    switch (act) {
                                      case 'START': return 'var(--accent-primary, #3B82F6)';
                                      case 'PAUSE': return 'var(--warning, #F59E0B)';
                                      case 'RESUME': return 'var(--accent-primary, #3B82F6)';
                                      case 'END': return 'var(--success, #10B981)';
                                      case 'REWORK_ASSIGNED': return '#EF4444';
                                      case 'REWORK_COMPLETED': return '#10B981';
                                      case 'REWORK_APPROVED': return '#8B5CF6';
                                      case 'REPETITION_RESET': return '#F97316';
                                      case 'REPETITION_TRIGGERED': return '#EC4899';
                                      default: return 'var(--text-secondary)';
                                    }
                                  };

                                  return (
                                    <div key={lidx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                      <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: getActionColor(log.action),
                                        marginTop: '5px',
                                        flexShrink: 0
                                      }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            <span style={{ color: getActionColor(log.action) }}>{getActionLabel(log.action)}</span>
                                          </span>
                                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {new Date(log.timestamp).toLocaleDateString('en-IN', {
                                              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                                            })}
                                          </span>
                                        </div>
                                        {log.notes && (
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                                            {log.notes}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable QR Modal */}
      <QRLabelModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        workOrder={{
          folioNumber: workOrder.folioNumber,
          patient: workOrder.patient,
          doctor: workOrder.doctor,
          qrToken: workOrder.qrToken
        }}
      />
    </div>
  );
}

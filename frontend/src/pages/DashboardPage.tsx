import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context';
import { TechnicianDashboardPage } from './TechnicianDashboardPage';
import {
  Activity,
  Users,
  ClipboardList,
  ShieldCheck,
  Play,
  Check,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workOrderService } from '../services';

export function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  if (user?.role === 'TECHNICIAN') {
    return <TechnicianDashboardPage />;
  }

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeSaving, setOutcomeSaving] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const data = await workOrderService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard statistics', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Auto refresh dashboard metrics every 15 seconds
    const timer = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  const handleStartVerification = async (workOrderId: string, processId: string) => {
    const loadingToast = toast.loading('Starting verification process...');
    try {
      await workOrderService.startVerification(workOrderId, processId);
      toast.success('Verification started! Status updated to monitoring.', { id: loadingToast });
      fetchDashboardData();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to start verification.';
      toast.error(errMsg, { id: loadingToast });
    }
  };

  const triggerOutcomeSelection = (alertItem: any) => {
    setSelectedAlert(alertItem);
    setShowOutcomeModal(true);
  };

  const handleEndVerification = async (outcome: 'SUCCESS' | 'REWORK') => {
    if (!selectedAlert) return;
    setOutcomeSaving(true);
    const loadingToast = toast.loading(`Completing verification as ${outcome}...`);
    try {
      await workOrderService.endVerification(selectedAlert.workOrderId, selectedAlert.id, outcome);
      toast.success(`Verification completed! Status logged as ${outcome}.`, { id: loadingToast });
      setShowOutcomeModal(false);
      setSelectedAlert(null);
      fetchDashboardData();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to complete verification.';
      toast.error(errMsg, { id: loadingToast });
    } finally {
      setOutcomeSaving(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading && !stats) {
    return (
      <div className="table-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader2 size={36} className="spinner" />
        <span style={{ marginLeft: '12px' }}>Loading branch analytics...</span>
      </div>
    );
  }

  const alerts = stats?.verificationAlerts || [];
  const statusSummary = stats?.woStatusSummary || {};
  const pendingProcs = stats?.pendingProcesses || [];
  const techOverview = stats?.technicianActivityOverview || [];

  return (
    <div className="dashboard-page animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header Greeting */}
      <div className="dashboard-page__header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="dashboard-page__title">
            {getGreeting()}, {user?.firstName}!
          </h1>
          <p className="dashboard-page__subtitle" style={{ color: 'var(--text-secondary)' }}>
            Branch Management Console {isAdmin && user?.branchId ? `(Branch Scoped)` : ''}
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '20px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.15)',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--accent-primary, #3B82F6)'
        }}>
          <Clock size={14} className="animate-spin-slow" />
          <span>Real-time Active Monitoring</span>
        </div>
      </div>

      {/* Verification Alerts Panel */}
      {alerts.length > 0 && (
        <div className="dashboard-card" style={{
          border: '1px solid rgba(139, 92, 246, 0.25)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          background: 'linear-gradient(to right, rgba(139, 92, 246, 0.03), rgba(99, 102, 241, 0.03))',
          boxShadow: '0 4px 20px -2px rgba(139, 92, 246, 0.06)'
        }}>
          <h3 className="dashboard-card__title" style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '1rem'
          }}>
            <ShieldCheck size={20} style={{ color: '#8B5CF6' }} />
            Pending Verification Alerts
            <span style={{
              fontSize: '0.75rem',
              backgroundColor: '#8B5CF6',
              color: '#FFFFFF',
              padding: '2px 8px',
              borderRadius: '100px',
              fontWeight: 700
            }}>{alerts.length}</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {alerts.map((alert: any) => {
              const isNotStarted = alert.status === 'NOT_STARTED';
              const isInternal = alert.type === 'INTERNAL';
              return (
                <div key={alert.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-surface, #FFFFFF)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', padding: '2px 6px', borderRadius: '4px' }}>
                        {alert.folioNumber}
                      </span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{alert.patient}</span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: isInternal ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        color: isInternal ? '#8B5CF6' : '#6366F1'
                      }}>
                        {alert.type} VERIFICATION
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: isNotStarted ? 'rgba(156, 163, 175, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: isNotStarted ? '#6B7280' : '#F59E0B'
                      }}>
                        {isNotStarted ? 'NOT STARTED' : 'IN PROGRESS'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Process: <strong>{alert.processName}</strong> • Assigned Evaluator: <strong>{alert.assignedTo}</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {isNotStarted ? (
                      <button
                        className="btn btn--primary btn--sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#8B5CF6', border: 'none' }}
                        onClick={() => handleStartVerification(alert.workOrderId, alert.id)}
                      >
                        <Play size={12} /> Start Verification
                      </button>
                    ) : (
                      <button
                        className="btn btn--primary btn--sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#10B981', border: 'none' }}
                        onClick={() => triggerOutcomeSelection(alert)}
                      >
                        <Check size={12} /> End Verification
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Counters Grid */}
      <div className="dashboard-page__stats" style={{ marginBottom: '2.5rem' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <div className="stat-card__icon stat-card__icon--primary">
            <Activity size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats?.inProgressWorkOrders ?? 0}</span>
            <span className="stat-card__label">Active Orders</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <div className="stat-card__icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{alerts.length}</span>
            <span className="stat-card__label">Pending Verifications</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="stat-card__icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
            <Clock size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{pendingProcs.length}</span>
            <span className="stat-card__label">Pending Tech Steps</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-card__icon stat-card__icon--success">
            <ClipboardList size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats?.completedWorkOrders ?? 0}</span>
            <span className="stat-card__label">Completed Today</span>
          </div>
        </div>
      </div>

      {/* Grid Layout for Queue and Technicians */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
        {/* Pending Processes Queue */}
        <div className="dashboard-card" style={{ borderRadius: '16px', border: '1px solid var(--border)', padding: '1.5rem' }}>
          <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <Clock size={18} style={{ color: '#F59E0B' }} />
            Pending Processes Queue
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: 'auto' }}>Ready to start</span>
          </h3>

          {pendingProcs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--success)', opacity: 0.6 }} />
              <h4 style={{ fontWeight: 500, fontSize: '0.875rem' }}>All steps launched!</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                There are no pending process steps awaiting technician start action.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
              {pendingProcs.map((proc: any) => (
                <div key={proc.id} style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-card, #F9FAFB)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                        {proc.folioNumber}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{proc.patient}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Step: <strong>{proc.processName}</strong>
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-muted)' }}>Assigned</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {proc.technicianName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Technician Activity Overview */}
        <div className="dashboard-card" style={{ borderRadius: '16px', border: '1px solid var(--border)', padding: '1.5rem' }}>
          <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <Users size={18} style={{ color: 'var(--accent-primary)' }} />
            Technician Load Overview
          </h3>

          {techOverview.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Users size={32} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <h4 style={{ fontWeight: 500, fontSize: '0.875rem' }}>No active technicians</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                Add technicians or activate work orders to see activity summaries.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
              {techOverview.map((tech: any) => {
                const isIdle = tech.activeStep === 'Idle';
                return (
                  <div key={tech.id} style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-surface, #FFFFFF)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{tech.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isIdle ? '#9CA3AF' : 'var(--success)'
                        }} />
                        <span style={{ fontSize: '0.75rem', color: isIdle ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {tech.activeStep}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)' }}>
                        {tech.completedToday}
                      </span>
                      <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-muted)' }}>
                        Completed Today
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status Summary Visual Indicator Panel */}
      <div className="dashboard-card" style={{ borderRadius: '16px', border: '1px solid var(--border)', padding: '1.5rem', marginTop: '2rem' }}>
        <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          Work Order Status Summary
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
          {Object.entries({
            CREATED: { label: 'Created', color: '#6B7280', bg: '#F3F4F6' },
            ASSIGNED: { label: 'Assigned', color: '#3B82F6', bg: '#EFF6FF' },
            IN_PROGRESS: { label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB' },
            INTERNAL_VERIFICATION: { label: 'Internal Verification', color: '#8B5CF6', bg: '#F5F3FF' },
            EXTERNAL_VERIFICATION: { label: 'External Verification', color: '#6366F1', bg: '#EEF2FF' },
            COMPLETED: { label: 'Completed', color: '#10B981', bg: '#ECFDF5' },
            FAILED: { label: 'Failed', color: '#EF4444', bg: '#FEF2F2' },
            CANCELLED: { label: 'Cancelled', color: '#94A3B8', bg: '#F8FAFC' },
          }).map(([key, value]) => {
            const count = statusSummary[key] || 0;
            return (
              <div key={key} style={{
                padding: '0.75rem',
                borderRadius: '10px',
                backgroundColor: value.bg,
                border: '1px solid rgba(0,0,0,0.03)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: value.color }}>{count}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {value.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom End Verification Outcome Selection Modal */}
      {showOutcomeModal && selectedAlert && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => !outcomeSaving && setShowOutcomeModal(false)}>
          <div className="modal" style={{ maxWidth: '400px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={20} style={{ color: '#8B5CF6' }} />
                  <span>Verify Work Order</span>
                </h2>
                <p className="modal__subtitle">Select evaluation outcome</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !outcomeSaving && setShowOutcomeModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-card, #F3F4F6)',
                border: '1px solid var(--border)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem'
              }}>
                Order: <strong>{selectedAlert.folioNumber} ({selectedAlert.patient})</strong><br />
                Verification Stage: <strong>{selectedAlert.processName}</strong>
              </div>

              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>Select the outcome:</p>
              
              <button
                type="button"
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: '#ECFDF5',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '0.75rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  width: '100%',
                  borderRadius: '8px',
                  cursor: outcomeSaving ? 'not-allowed' : 'pointer'
                }}
                disabled={outcomeSaving}
                onClick={() => handleEndVerification('SUCCESS')}
              >
                <CheckCircle2 size={18} /> Approve (Success)
              </button>

              <button
                type="button"
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: '#FEF2F2',
                  color: '#EF4444',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '0.75rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  width: '100%',
                  borderRadius: '8px',
                  cursor: outcomeSaving ? 'not-allowed' : 'pointer'
                }}
                disabled={outcomeSaving}
                onClick={() => handleEndVerification('REWORK')}
              >
                <AlertCircle size={18} /> Flag (Rework Needed)
              </button>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setShowOutcomeModal(false)}
                disabled={outcomeSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

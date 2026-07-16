import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useSocket } from '../context';
import { TechnicianDashboardPage } from './TechnicianDashboardPage';
import { OwnerDashboardPage } from './OwnerDashboardPage';
import { SuperAdminDashboardPage } from './SuperAdminDashboardPage';
import {
  Activity,
  ClipboardList,
  ShieldCheck,
  Play,
  Check,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  X,
  Eye,
  History,
  Wrench,
  RotateCcw,
  UserCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { workOrderService } from '../services';
import { ViewWorkOrderModal } from '../components';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  if (user?.role === 'SUPER_ADMIN') {
    return <SuperAdminDashboardPage />;
  }

  if (user?.role === 'TECHNICIAN') {
    return <TechnicianDashboardPage />;
  }

  if (user?.role === 'OWNER') {
    return <OwnerDashboardPage />;
  }

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [selectedWOId, setSelectedWOId] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [hoveredTechId, setHoveredTechId] = useState<string | null>(null);
  const [hoveredType, setHoveredType] = useState<'rework' | 'repetition' | null>(null);
  const [activeModalTech, setActiveModalTech] = useState<any | null>(null);
  const [activeModalType, setActiveModalType] = useState<'rework' | 'repetition' | null>(null);

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

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    fetchDashboardData();

    if (!socket) return;

    // Listen to real-time events to reload dashboard stats
    socket.on('work_order_created', fetchDashboardData);
    socket.on('work_order_updated', fetchDashboardData);

    return () => {
      socket.off('work_order_created', fetchDashboardData);
      socket.off('work_order_updated', fetchDashboardData);
    };
  }, [socket, fetchDashboardData]);

  // Handle connection restore
  useEffect(() => {
    if (isConnected) {
      fetchDashboardData();
    }
  }, [isConnected, fetchDashboardData]);

  const handleStartVerification = async (workOrderId: string, processId: string) => {
    const loadingToast = toast.loading(t('dashboard.startingVerification'));
    try {
      await workOrderService.startVerification(workOrderId, processId);
      toast.success(t('dashboard.verificationStarted'), { id: loadingToast });
      fetchDashboardData();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || t('dashboard.verificationFailed');
      toast.error(errMsg, { id: loadingToast });
    }
  };

  const triggerOutcomeSelection = (alertItem: any) => {
    setSelectedAlert(alertItem);
    setShowOutcomeModal(true);
  };

  const handleEndVerification = async (outcome: 'SUCCESS' | 'REWORK' | 'REPETITION') => {
    if (!selectedAlert) return;
    setOutcomeSaving(true);
    const loadingToast = toast.loading(t('dashboard.completingVerification', { outcome }));
    try {
      await workOrderService.endVerification(selectedAlert.workOrderId, selectedAlert.id, outcome);
      toast.success(t('dashboard.verificationCompleted', { outcome }), { id: loadingToast });
      setShowOutcomeModal(false);
      const targetWoId = selectedAlert.workOrderId;
      setSelectedAlert(null);
      fetchDashboardData();
      if (outcome === 'REWORK') {
        navigate('/work-orders', { state: { editWorkOrderId: targetWoId, activeTab: 'processes' } });
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || t('dashboard.verificationCompleteFailed');
      toast.error(errMsg, { id: loadingToast });
    } finally {
      setOutcomeSaving(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greetingMorning');
    if (hour < 17) return t('dashboard.greetingAfternoon');
    return t('dashboard.greetingEvening');
  };

  if (loading && !stats) {
    return (
      <div className="table-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader2 size={36} className="spinner" />
        <span style={{ marginLeft: '12px' }}>{t('dashboard.loadingAnalytics')}</span>
      </div>
    );
  }

  const alerts = (stats?.verificationAlerts || []).filter((a: any) => a.status === 'NOT_STARTED');
  const statusSummary = stats?.woStatusSummary || {};
  const pendingProcs = stats?.pendingProcesses || [];
  const inProgressWOs = stats?.inProgressWOs || [];
  const verificationWOs = stats?.verificationWOs || [];
  const repetitionLogs = stats?.repetitionLogs || [];
  const technicianActivityOverview = stats?.technicianActivityOverview || [];

  return (
    <div className="dashboard-page animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header Greeting */}
      <div className="dashboard-page__header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="dashboard-page__title">
            {getGreeting()}, {user?.firstName}!
          </h1>
          <p className="dashboard-page__subtitle" style={{ color: 'var(--text-secondary)' }}>
            {t('dashboard.branchManagementConsole')} {isAdmin && user?.branchId ? ` ${t('dashboard.branchScoped')}` : ''}
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 10px',
          borderRadius: '6px',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#10B981'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#10B981',
            display: 'inline-block'
          }} />
          <span>{t('dashboard.realTimeMonitoring')}</span>
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
            {t('dashboard.pendingVerificationAlerts')}
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
                    {isInternal ? t('enums.verificationType.INTERNAL') : t('enums.verificationType.EXTERNAL')} {t('dashboard.verification')}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: isNotStarted ? 'rgba(156, 163, 175, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: isNotStarted ? '#6B7280' : '#F59E0B'
                      }}>
                        {isNotStarted ? t('enums.processStatus.NOT_STARTED') : t('enums.processStatus.IN_PROGRESS')}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {t('dashboard.process')}: <strong>{alert.type === 'INTERNAL' ? t('workOrders.internalVerification', { defaultValue: 'Verification (Internal)' }) : t('workOrders.externalVerification', { defaultValue: 'Verification (External)' })}</strong> • {t('dashboard.assignedEvaluator')}: <strong>{alert.assignedTo}</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn--ghost btn--sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border)' }}
                      onClick={() => {
                        setSelectedWOId(alert.workOrderId);
                        setShowViewModal(true);
                      }}
                    >
                      <Eye size={12} /> {t('dashboard.viewWO')}
                    </button>
                    {(() => {
                      const isExternal = alert.type === 'EXTERNAL';
                      const canCompleteExternal = !isExternal || alert.defaultAdminId === user?.id;

                      if (isNotStarted) {
                        if (isExternal) return null;
                        return (
                          <button
                            className="btn btn--primary btn--sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#8B5CF6', border: 'none' }}
                            onClick={() => handleStartVerification(alert.workOrderId, alert.id)}
                          >
                            <Play size={12} /> {t('dashboard.startVerification')}
                          </button>
                        );
                      }

                      return (
                        <button
                          className="btn btn--primary btn--sm"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: canCompleteExternal ? '#10B981' : '#94A3B8',
                            border: 'none',
                            cursor: canCompleteExternal ? 'pointer' : 'not-allowed',
                          }}
                          onClick={() => canCompleteExternal && triggerOutcomeSelection(alert)}
                          disabled={!canCompleteExternal}
                          title={canCompleteExternal ? undefined : t('dashboard.onlyDefaultAdmin')}
                        >
                          <Check size={12} /> {t('dashboard.endVerification')}
                        </button>
                      );
                    })()}
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
            <span className="stat-card__label">{t('dashboard.activeOrders')}</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #8B5CF6' }}>
          <div className="stat-card__icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{alerts.length}</span>
            <span className="stat-card__label">{t('dashboard.pendingVerifications')}</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div className="stat-card__icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
            <Clock size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{pendingProcs.length}</span>
            <span className="stat-card__label">{t('dashboard.pendingTechSteps')}</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-card__icon stat-card__icon--success">
            <ClipboardList size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats?.completedWorkOrders ?? 0}</span>
            <span className="stat-card__label">{t('dashboard.completedToday')}</span>
          </div>
        </div>
      </div>

      {/* Workflow Pipelines: In-Progress and Verification WOs Segregated */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* In-Progress Work Orders */}
        <div className="dashboard-card" style={{ borderRadius: '16px', border: '1px solid var(--border)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <Activity size={18} style={{ color: 'var(--accent-primary, #3B82F6)' }} />
            {t('dashboard.inProgressWorkOrders')}
            <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--accent-primary, #3B82F6)', color: '#FFFFFF', padding: '2px 8px', borderRadius: '100px', fontWeight: 700, marginLeft: '6px' }}>{inProgressWOs.length}</span>
          </h3>

          {inProgressWOs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--success)', opacity: 0.6 }} />
              <h4 style={{ fontWeight: 500, fontSize: '0.875rem' }}>{t('dashboard.noActiveInProgress')}</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                {t('dashboard.createOrAssign')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
              {inProgressWOs.map((wo: any) => {
                const activeStep = wo.processes.find((p: any) => p.status === 'IN_PROGRESS' || p.status === 'PAUSED')
                  || wo.processes.find((p: any) => p.status === 'NOT_STARTED')
                  || wo.processes[wo.processes.length - 1];

                const activeStepTech = activeStep?.technician
                  ? `${activeStep.technician.firstName} ${activeStep.technician.lastName}`
                  : t('dashboard.unassigned');

                return (
                  <div key={wo.id} style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-surface, #FFFFFF)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', padding: '2px 6px', borderRadius: '4px' }}>
                          {wo.folioNumber}
                        </span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{wo.patient}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          backgroundColor: wo.status === 'ASSIGNED' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: wo.status === 'ASSIGNED' ? '#3B82F6' : '#F59E0B'
                        }}>
                          {wo.status === 'ASSIGNED' ? t('enums.workOrderStatus.ASSIGNED') : t('enums.workOrderStatus.IN_PROGRESS')}
                        </span>
                        <button
                          className="btn-action"
                          style={{
                            color: 'var(--accent-primary, #3B82F6)',
                            backgroundColor: '#EFF6FF',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSelectedWOId(wo.id);
                            setShowViewModal(true);
                          }}
                          title={t('dashboard.viewWorkOrder')}
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <div>
                        {t('dashboard.doctor')}: <strong style={{ color: 'var(--text-primary)' }}>{wo.doctor?.name || '—'}</strong>
                      </div>
                      <div>
                        {t('dashboard.prosthesis')}: <strong style={{ color: 'var(--accent-primary)' }}>{wo.prosthesisType?.name || '—'}</strong>
                      </div>
                    </div>

                    {activeStep && (
                      <div style={{
                        marginTop: '4px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-card, #F9FAFB)',
                        border: '1px solid var(--border)',
                        fontSize: '0.78rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>{t('dashboard.activeStep')}: <strong>{activeStep.processName}</strong></span>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>{t('dashboard.tech')}: <strong>{activeStepTech}</strong></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Work Orders in Verification */}
        <div className="dashboard-card" style={{ borderRadius: '16px', border: '1px solid var(--border)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <ShieldCheck size={18} style={{ color: '#8B5CF6' }} />
            {t('dashboard.workOrdersInVerification')}
            <span style={{ fontSize: '0.75rem', backgroundColor: '#8B5CF6', color: '#FFFFFF', padding: '2px 8px', borderRadius: '100px', fontWeight: 700, marginLeft: '6px' }}>{verificationWOs.length}</span>
          </h3>

          {verificationWOs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center' }}>
              <ShieldCheck size={32} style={{ color: '#8B5CF6', opacity: 0.6 }} />
              <h4 style={{ fontWeight: 500, fontSize: '0.875rem' }}>{t('dashboard.noOrdersInVerification')}</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                {t('dashboard.verificationAudit')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
              {verificationWOs.map((wo: any) => {
                const activeVerification = wo.processes.find((p: any) => p.isVerification && (p.status === 'NOT_STARTED' || p.status === 'IN_PROGRESS' || p.status === 'PAUSED'));
                const isNotStarted = activeVerification?.status === 'NOT_STARTED';
                const evaluator = activeVerification?.technicianId && activeVerification.technician
                  ? `${activeVerification.technician.firstName} ${activeVerification.technician.lastName}`
                  : (wo.doctor?.name ? `${wo.doctor.name} (${t('dashboard.externalDoctor')})` : t('dashboard.externalDoctor'));

                return (
                  <div key={wo.id} style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-surface, #FFFFFF)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', padding: '2px 6px', borderRadius: '4px' }}>
                          {wo.folioNumber}
                        </span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{wo.patient}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          backgroundColor: wo.status === 'INTERNAL_VERIFICATION' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                          color: wo.status === 'INTERNAL_VERIFICATION' ? '#8B5CF6' : '#6366F1'
                        }}>
                          {wo.status === 'INTERNAL_VERIFICATION' ? t('enums.verificationType.INTERNAL') : t('enums.verificationType.EXTERNAL')} {t('dashboard.verification')}
                        </span>
                        <button
                          className="btn-action"
                          style={{
                            color: 'var(--accent-primary, #3B82F6)',
                            backgroundColor: '#EFF6FF',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSelectedWOId(wo.id);
                            setShowViewModal(true);
                          }}
                          title={t('dashboard.viewWorkOrder')}
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <div>
                        {t('dashboard.doctor')}: <strong style={{ color: 'var(--text-primary)' }}>{wo.doctor?.name || '—'}</strong>
                      </div>
                      <div>
                        {t('dashboard.prosthesis')}: <strong style={{ color: 'var(--accent-primary)' }}>{wo.prosthesisType?.name || '—'}</strong>
                      </div>
                    </div>

                    {activeVerification && (
                      <div style={{
                        marginTop: '4px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-card, #F9FAFB)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {t('dashboard.verification')}: <strong>{activeVerification.technicianId ? t('workOrders.internalVerification', { defaultValue: 'Verification (Internal)' }) : t('workOrders.externalVerification', { defaultValue: 'Verification (External)' })}</strong>
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {t('dashboard.evaluator')}: <strong>{evaluator}</strong>
                          </span>
                        </div>

                        <div>
                          {(() => {
                            const isExternal = !activeVerification.technicianId;
                            const canCompleteExternal = !isExternal || wo.branch?.defaultAdminId === user?.id;

                            if (isNotStarted) {
                              if (isExternal) return null;
                              return (
                                <button
                                  className="btn btn--primary btn--sm"
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#8B5CF6', border: 'none', padding: '4px 10px', fontSize: '0.725rem', fontWeight: 600 }}
                                  onClick={() => handleStartVerification(wo.id, activeVerification.id)}
                                >
                                  <Play size={10} /> {t('dashboard.start')}
                                </button>
                              );
                            }

                            return (
                              <button
                                className="btn btn--primary btn--sm"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  backgroundColor: canCompleteExternal ? '#10B981' : '#94A3B8',
                                  border: 'none',
                                  padding: '4px 10px',
                                  fontSize: '0.725rem',
                                  fontWeight: 600,
                                  cursor: canCompleteExternal ? 'pointer' : 'not-allowed',
                                }}
                                onClick={() => canCompleteExternal && triggerOutcomeSelection({
                                  id: activeVerification.id,
                                  workOrderId: wo.id,
                                  folioNumber: wo.folioNumber,
                                  patient: wo.patient,
                                  processName: activeVerification.processName
                                })}
                                disabled={!canCompleteExternal}
                                title={canCompleteExternal ? undefined : t('dashboard.onlyDefaultAdmin')}
                              >
                                <Check size={10} /> {t('dashboard.end')}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Technician Activity and Repetition Lists */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem', marginBottom: '2.5rem', marginTop: '2rem' }}>
        
        {/* Technician Activity & Performance Overview */}
        <div className="dashboard-card" style={{ borderRadius: '16px', border: '1px solid var(--border)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <Wrench size={18} style={{ color: 'var(--accent-primary, #3B82F6)' }} />
            {t('dashboard.technicianActivity')}
          </h3>

          {technicianActivityOverview.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center' }}>
              <UserCheck size={32} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              <h4 style={{ fontWeight: 500, fontSize: '0.875rem' }}>{t('dashboard.noActiveTechnicians')}</h4>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>{t('navigation.technician')}</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center' }}>{t('dashboard.completed')}</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center' }}>{t('dashboard.reworks')}</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center' }}>{t('dashboard.repetitions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {technicianActivityOverview.map((tech: any) => (
                    <tr key={tech.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{tech.name}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'center', fontWeight: 700 }}>{tech.completedToday}</td>
                      <td style={{ padding: '12px 12px', textAlign: 'center', position: 'relative' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveModalTech(tech);
                              setActiveModalType('rework');
                            }}
                            onMouseEnter={() => {
                              setHoveredTechId(tech.id);
                              setHoveredType('rework');
                            }}
                            onMouseLeave={() => {
                              setHoveredTechId(null);
                              setHoveredType(null);
                            }}
                            style={{
                              padding: '2px 10px',
                              borderRadius: '100px',
                              backgroundColor: tech.reworkCount > 0 ? '#FEF2F2' : 'var(--bg-overlay)',
                              color: tech.reworkCount > 0 ? '#EF4444' : 'var(--text-muted)',
                              border: tech.reworkCount > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              outline: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '28px'
                            }}
                          >
                            {tech.reworkCount}
                          </button>
                          {hoveredTechId === tech.id && hoveredType === 'rework' && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              marginTop: '8px',
                              zIndex: 100,
                              width: '280px',
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              boxShadow: 'var(--shadow-lg)',
                              padding: '0.75rem',
                              fontSize: '0.75rem',
                              textAlign: 'left',
                              pointerEvents: 'none'
                            }}>
                              <h4 style={{ fontWeight: 700, marginBottom: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertCircle size={12} style={{ color: '#EF4444' }} />
                                {t('dashboard.reworkProcesses', { count: tech.reworkCount })}
                              </h4>
                              {tech.reworkDetails.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.noReworks')}</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                  {tech.reworkDetails.map((detail: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', borderBottom: idx < tech.reworkDetails.length - 1 ? '1px dashed var(--border)' : 'none', paddingBottom: idx < tech.reworkDetails.length - 1 ? '4px' : 0 }}>
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{detail.processName} ({detail.folioNumber})</span>
                                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{t('dashboard.reworkCount', { count: detail.reworkCount })} • {detail.status}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'center', position: 'relative' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveModalTech(tech);
                              setActiveModalType('repetition');
                            }}
                            onMouseEnter={() => {
                              setHoveredTechId(tech.id);
                              setHoveredType('repetition');
                            }}
                            onMouseLeave={() => {
                              setHoveredTechId(null);
                              setHoveredType(null);
                            }}
                            style={{
                              padding: '2px 10px',
                              borderRadius: '100px',
                              backgroundColor: tech.repetitionCount > 0 ? '#FDF4FF' : 'var(--bg-overlay)',
                              color: tech.repetitionCount > 0 ? '#D946EF' : 'var(--text-muted)',
                              border: tech.repetitionCount > 0 ? '1px solid rgba(217, 70, 239, 0.2)' : '1px solid transparent',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              outline: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '28px'
                            }}
                          >
                            {tech.repetitionCount}
                          </button>
                          {hoveredTechId === tech.id && hoveredType === 'repetition' && (
                            <div style={{
                              position: 'absolute',
                              top: '100%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              marginTop: '8px',
                              zIndex: 100,
                              width: '280px',
                              backgroundColor: 'var(--bg-surface)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              boxShadow: 'var(--shadow-lg)',
                              padding: '0.75rem',
                              fontSize: '0.75rem',
                              textAlign: 'left',
                              pointerEvents: 'none'
                            }}>
                              <h4 style={{ fontWeight: 700, marginBottom: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <RotateCcw size={12} style={{ color: '#D946EF' }} />
                                {t('dashboard.repetitionWorkOrders', { count: tech.repetitionCount })}
                              </h4>
                              {tech.repetitionDetails.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.noRepetitions')}</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                  {tech.repetitionDetails.map((detail: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', borderBottom: idx < tech.repetitionDetails.length - 1 ? '1px dashed var(--border)' : 'none', paddingBottom: idx < tech.repetitionDetails.length - 1 ? '4px' : 0 }}>
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{detail.folioNumber} ({detail.patient})</span>
                                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{t('dashboard.totalRepetitions', { count: detail.repetitionCount })}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Repetition Work Orders List */}
        <div className="dashboard-card" style={{ borderRadius: '16px', border: '1px solid var(--border)', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <History size={18} style={{ color: '#8B5CF6' }} />
            {t('dashboard.repetitionWO')}
            <span style={{ fontSize: '0.75rem', backgroundColor: '#8B5CF6', color: '#FFFFFF', padding: '2px 8px', borderRadius: '100px', fontWeight: 700, marginLeft: '6px' }}>{repetitionLogs.length}</span>
          </h3>

          {repetitionLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center' }}>
              <History size={32} style={{ color: '#8B5CF6', opacity: 0.6 }} />
              <h4 style={{ fontWeight: 500, fontSize: '0.875rem' }}>{t('dashboard.noRepetitionsTriggered')}</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                {t('dashboard.repetitionWillAppear')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
              {repetitionLogs.map((log: any) => (
                <div key={log.id} style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-surface, #FFFFFF)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', padding: '2px 6px', borderRadius: '4px' }}>
                        {log.workOrder.folioNumber}
                      </span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{log.workOrder.patient}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        backgroundColor: 'rgba(217, 70, 239, 0.1)',
                        color: '#D946EF'
                      }}>
                        {t('dashboard.repetitionNumber', { count: log.repetitionCount })}
                      </span>
                      <button
                        className="btn-action"
                        style={{
                          color: 'var(--accent-primary, #3B82F6)',
                          backgroundColor: '#EFF6FF',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedWOId(log.workOrder.id);
                          setShowViewModal(true);
                        }}
                        title={t('dashboard.viewWorkOrder')}
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <div>
                      {t('dashboard.triggeredBy')}: <strong style={{ color: 'var(--text-primary)' }}>{log.initiatedBy ? `${log.initiatedBy.firstName} ${log.initiatedBy.lastName}` : t('dashboard.system')}</strong>
                    </div>
                    <div>
                      {t('dashboard.triggeredAt')}: <strong style={{ color: 'var(--text-primary)' }}>{new Date(log.initiatedAt).toLocaleString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-US')}</strong>
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card, #F9FAFB)',
                    border: '1px solid var(--border)',
                    fontSize: '0.78rem'
                  }}>
                    {t('dashboard.stage')}: <strong>{log.verificationStage}</strong> • {t('dashboard.resetSteps')}: <strong>{log.completedSteps}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Summary Visual Indicator Panel */}
      <div className="dashboard-card" style={{ borderRadius: '16px', border: '1px solid var(--border)', padding: '1.5rem', marginTop: '2rem' }}>
        <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          {t('dashboard.workOrderStatusSummary')}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
          {Object.entries({
            CREATED: { label: t('enums.workOrderStatus.CREATED'), color: '#6B7280', bg: '#F3F4F6' },
            ASSIGNED: { label: t('enums.workOrderStatus.ASSIGNED'), color: '#3B82F6', bg: '#EFF6FF' },
            IN_PROGRESS: { label: t('enums.workOrderStatus.IN_PROGRESS'), color: '#F59E0B', bg: '#FFFBEB' },
            INTERNAL_VERIFICATION: { label: t('enums.workOrderStatus.INTERNAL_VERIFICATION'), color: '#8B5CF6', bg: '#F5F3FF' },
            EXTERNAL_VERIFICATION: { label: t('enums.workOrderStatus.EXTERNAL_VERIFICATION'), color: '#6366F1', bg: '#EEF2FF' },
            COMPLETED: { label: t('enums.workOrderStatus.COMPLETED'), color: '#10B981', bg: '#ECFDF5' },
            FAILED: { label: t('enums.workOrderStatus.FAILED'), color: '#EF4444', bg: '#FEF2F2' },
            CANCELLED: { label: t('enums.workOrderStatus.CANCELLED'), color: '#F97316', bg: '#FFF3E0' },
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
                  <span>{t('dashboard.verifyWorkOrder')}</span>
                </h2>
                <p className="modal__subtitle">{t('dashboard.selectOutcome')}</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !outcomeSaving && setShowOutcomeModal(false)}
                aria-label={t('common.close')}
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
                {t('dashboard.order')}: <strong>{selectedAlert.folioNumber} ({selectedAlert.patient})</strong><br />
                {t('dashboard.verificationStage')}: <strong>{selectedAlert.type === 'INTERNAL' ? t('workOrders.internalVerification', { defaultValue: 'Verification (Internal)' }) : t('workOrders.externalVerification', { defaultValue: 'Verification (External)' })}</strong>
              </div>

              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 600 }}>{t('dashboard.selectTheOutcome')}</p>
              
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
                <CheckCircle2 size={18} /> {t('dashboard.approveSuccess')}
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
                <AlertCircle size={18} /> {t('dashboard.flagRework')}
              </button>

              <button
                type="button"
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: '#FDF4FF',
                  color: '#D946EF',
                  border: '1px solid rgba(217, 70, 239, 0.25)',
                  padding: '0.75rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  width: '100%',
                  borderRadius: '8px',
                  cursor: outcomeSaving ? 'not-allowed' : 'pointer'
                }}
                disabled={outcomeSaving}
                onClick={() => handleEndVerification('REPETITION')}
              >
                <History size={18} /> {t('dashboard.flagRepetition')}
              </button>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setShowOutcomeModal(false)}
                disabled={outcomeSaving}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ViewWorkOrderModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedWOId(null);
        }}
        workOrderId={selectedWOId}
        onUpdate={fetchDashboardData}
      />

      {/* Rework Involvement Modal */}
      {activeModalTech && activeModalType === 'rework' && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setActiveModalTech(null)}>
          <div className="modal" style={{ maxWidth: '600px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={20} style={{ color: '#EF4444' }} />
                  <span>{t('dashboard.reworkInvolvement', { name: activeModalTech.name })}</span>
                </h2>
                <p className="modal__subtitle">{t('dashboard.processesReworked')}</p>
              </div>
              <button className="modal__close" onClick={() => setActiveModalTech(null)} aria-label={t('common.close')}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {activeModalTech.reworkDetails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {t('dashboard.noReworkProcesses')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {activeModalTech.reworkDetails.map((rework: any) => (
                    <div key={rework.id} style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-overlay)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span 
                            style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedWOId(rework.workOrderId);
                              setShowViewModal(true);
                              setActiveModalTech(null);
                            }}
                            title={t('dashboard.clickToViewWO')}
                          >
                            {rework.folioNumber}
                          </span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{rework.patient}</span>
                        </div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {t('dashboard.process')}: <strong>{rework.processName}</strong> • {t('dashboard.reworkCountLabel')}: <strong>{rework.reworkCount}</strong>
                        </span>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          {t('dashboard.flaggedIn')}: <strong>{rework.verificationStage}</strong> • {new Date(rework.initiatedAt).toLocaleString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-US')}
                        </span>
                      </div>
                      <div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '100px',
                          backgroundColor: rework.status === 'Approved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: rework.status === 'Approved' ? '#10B981' : '#F59E0B'
                        }}>
                          {rework.status === 'Approved' ? t('enums.processAction.REWORK_APPROVED') : rework.status === 'In Progress' ? t('enums.processStatus.IN_PROGRESS') : rework.status === 'Completed' ? t('enums.processStatus.COMPLETED') : rework.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setActiveModalTech(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repetition Involvement Modal */}
      {activeModalTech && activeModalType === 'repetition' && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setActiveModalTech(null)}>
          <div className="modal" style={{ maxWidth: '600px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RotateCcw size={20} style={{ color: '#D946EF' }} />
                  <span>{t('dashboard.repetitionInvolvement', { name: activeModalTech.name })}</span>
                </h2>
                <p className="modal__subtitle">{t('dashboard.repetitionInvolvementSubtitle')}</p>
              </div>
              <button className="modal__close" onClick={() => setActiveModalTech(null)} aria-label={t('common.close')}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
              {activeModalTech.repetitionDetails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {t('dashboard.noRepetitionInvolvement')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {activeModalTech.repetitionDetails.map((wo: any) => (
                    <div key={wo.id} style={{
                      padding: '1rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-overlay)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span 
                            style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedWOId(wo.id);
                              setShowViewModal(true);
                              setActiveModalTech(null);
                            }}
                            title={t('dashboard.clickToViewWO')}
                          >
                            {wo.folioNumber}
                          </span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{wo.patient}</span>
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(217, 70, 239, 0.1)',
                          color: '#D946EF',
                          padding: '2px 8px',
                          borderRadius: '100px'
                        }}>
                          {t('dashboard.xRepetitions', { count: wo.repetitionCount })}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('dashboard.triggeredRepetitionEvents')}</span>
                        {wo.repetitionLogs.map((log: any) => (
                          <div key={log.id} style={{
                            fontSize: '0.725rem',
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--bg-surface)',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '4px'
                          }}>
                            <span>{t('dashboard.stage')}: <strong>{log.verificationStage}</strong> ({t('dashboard.triggeredBy')}: {log.initiatedBy})</span>
                            <span>{new Date(log.initiatedAt).toLocaleString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-US')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setActiveModalTech(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

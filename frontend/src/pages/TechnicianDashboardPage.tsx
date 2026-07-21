import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useSocket } from '../context';
import {
  Activity,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  AlertCircle,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import {
  technicianPortalService,
  type TechnicianDashboardStats,
  type TechnicianWorkOrderListItem,
  type TechnicianProcessItem,
} from '../services';

// Toggle flag to control display of Quick QR Scan section (hidden by default, can be set to true if needed)
const SHOW_QUICK_QR_SCAN = false;

export function TechnicianDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState<TechnicianDashboardStats | null>(null);
  const [assignedJobs, setAssignedJobs] = useState<TechnicianWorkOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper check if previous sequence steps are completed
  const isPrecedingStepCompleted = useCallback((currentProc: TechnicianProcessItem, processes: TechnicianProcessItem[]) => {
    return processes
      .filter((p) => p.sequence < currentProc.sequence)
      .every((p) => p.status === 'COMPLETED');
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsData, jobsData] = await Promise.all([
        technicianPortalService.getDashboardStats(),
        technicianPortalService.getAssignedWorkOrders('ALL'),
      ]);
      setStats(statsData);
      
      // Filter work orders to ONLY show those that are ready to start, in progress, or paused
      const readyOrActiveJobs = jobsData.filter((wo) => {
        const activeStep = wo.processes.find(
          (p) => p.technicianId === user?.id && (p.status === 'IN_PROGRESS' || p.status === 'PAUSED')
        );
        if (activeStep) return true;

        const pendingStep = wo.processes.find(
          (p) => p.technicianId === user?.id && p.status === 'NOT_STARTED'
        );
        if (pendingStep) {
          return isPrecedingStepCompleted(pendingStep, wo.processes);
        }

        return false;
      });

      setAssignedJobs(readyOrActiveJobs);
    } catch {
      toast.error(t('techDashboard.failedLoadDashboard'));
    } finally {
      setLoading(false);
    }
  }, [t, user?.id, isPrecedingStepCompleted]);

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    fetchDashboardData();

    if (!socket) return;

    socket.on('work_order_created', fetchDashboardData);
    socket.on('work_order_updated', fetchDashboardData);

    return () => {
      socket.off('work_order_created', fetchDashboardData);
      socket.off('work_order_updated', fetchDashboardData);
    };
  }, [socket, fetchDashboardData]);

  useEffect(() => {
    if (isConnected) {
      fetchDashboardData();
    }
  }, [isConnected, fetchDashboardData]);

  const handleAction = async (
    e: React.MouseEvent,
    processId: string,
    action: 'start' | 'pause' | 'resume' | 'end'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let actionLoadingKey = 'startingProcess';
    if (action === 'pause') actionLoadingKey = 'pausingProcess';
    else if (action === 'resume') actionLoadingKey = 'resumingProcess';
    else if (action === 'end') actionLoadingKey = 'endingProcess';

    const loadingToast = toast.loading(t(`techDashboard.${actionLoadingKey}`));
    try {
      if (action === 'start') {
        await technicianPortalService.startProcess(processId);
        toast.success(t('techDashboard.processStarted'), { id: loadingToast });
      } else if (action === 'pause') {
        await technicianPortalService.pauseProcess(processId);
        toast.success(t('techDashboard.processPaused'), { id: loadingToast });
      } else if (action === 'resume') {
        await technicianPortalService.resumeProcess(processId);
        toast.success(t('techDashboard.processResumed'), { id: loadingToast });
      } else if (action === 'end') {
        await technicianPortalService.endProcess(processId);
        toast.success(t('techDashboard.processEnded'), { id: loadingToast });
      }
      fetchDashboardData();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || t('techDashboard.processActionFailed', { action: t(`techDashboard.action.${action}`) });
      toast.error(errMsg, { id: loadingToast });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greetingMorning');
    if (hour < 17) return t('dashboard.greetingAfternoon');
    return t('dashboard.greetingEvening');
  };

  // Find process assigned to this technician in a work order
  const getAssignedProcess = (wo: TechnicianWorkOrderListItem) => {
    // 1. First look for IN_PROGRESS or PAUSED step assigned to tech
    const activeStep = wo.processes.find(
      (p) => p.technicianId === user?.id && (p.status === 'IN_PROGRESS' || p.status === 'PAUSED')
    );
    if (activeStep) return activeStep;

    // 2. Otherwise look for first NOT_STARTED step assigned to tech
    return wo.processes.find(
      (p) => p.technicianId === user?.id && p.status === 'NOT_STARTED'
    );
  };

  if (loading && !stats) {
    return (
      <div className="loading-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="dashboard-page__header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="dashboard-page__title">
            {getGreeting()}, {user?.firstName}!
          </h1>
          <p className="dashboard-page__subtitle" style={{ color: 'var(--text-secondary)' }}>
            {t('dashboard.techWorkspaceSubtitle')}
          </p>
        </div>
      </div>

      {/* Glow Stat Cards */}
      <div className="dashboard-page__stats grid grid-cols-1 md:grid-cols-4 gap-6" style={{ marginBottom: '2.5rem' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--accent-primary)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card__icon stat-card__icon--primary" style={{ backgroundColor: 'rgba(111,174,217,0.1)', color: 'var(--accent-primary)' }}>
            <Clock size={22} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats?.pendingCount ?? 0}</span>
            <span className="stat-card__label">{t('techDashboard.pendingSteps')}</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card__icon stat-card__icon--success" style={{ backgroundColor: 'rgba(46,204,113,0.1)', color: 'var(--success)' }}>
            <Activity size={22} className="animate-pulse" />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats?.activeCount ?? 0}</span>
            <span className="stat-card__label">{t('techDashboard.activeSteps')}</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card__icon stat-card__icon--warning" style={{ backgroundColor: 'rgba(241,196,15,0.1)', color: 'var(--warning)' }}>
            <Pause size={22} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats?.pausedCount ?? 0}</span>
            <span className="stat-card__label">{t('techDashboard.pausedSteps')}</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--info)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card__icon stat-card__icon--info" style={{ backgroundColor: 'rgba(52,152,219,0.1)', color: 'var(--info)' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats?.completedTodayCount ?? 0}</span>
            <span className="stat-card__label">{t('dashboard.completedToday')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Work Queue Control Section */}
        <div className="lg:col-span-2">
          <div className="dashboard-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="dashboard-card__title" style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} style={{ color: 'var(--success)' }} />
                {t('techDashboard.myWorkQueue')}
              </h3>
              <Link to="/tech/work-orders" className="btn btn--outline btn--sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {t('techDashboard.viewAllQueue')} <ChevronRight size={14} />
              </Link>
            </div>

            {assignedJobs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <ClipboardList size={36} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <h4 style={{ fontWeight: 500, fontSize: '0.95rem' }}>{t('techDashboard.noQueueWorkOrders')}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0' }}>
                  {t('techDashboard.noQueueWorkOrdersDesc')}
                </p>
                <Link to="/tech/work-orders" className="btn btn--primary btn--sm" style={{ marginTop: '0.5rem' }}>
                  {t('techDashboard.openMyWorkOrders')}
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {assignedJobs.map((wo) => {
                  const proc = getAssignedProcess(wo);
                  if (!proc) return null;

                  const isActive = proc.status === 'IN_PROGRESS';
                  const isPaused = proc.status === 'PAUSED';
                  const isNotStarted = proc.status === 'NOT_STARTED';
                  const isReady = isNotStarted && isPrecedingStepCompleted(proc, wo.processes);

                  return (
                    <div
                      key={wo.id}
                      className="card animate-fade-in"
                      style={{
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: `1px solid ${isActive ? 'var(--accent-primary)' : isPaused ? 'var(--warning)' : isReady ? 'var(--success)' : 'var(--border)'}`,
                        backgroundColor: 'var(--bg-surface)',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Top indicator bar */}
                      <div style={{
                        position: 'absolute',
                        top: '0',
                        left: '0',
                        right: '0',
                        height: '3px',
                        backgroundColor: isActive ? 'var(--accent-primary)' : isPaused ? 'var(--warning)' : isReady ? 'var(--success)' : 'var(--border)'
                      }} />

                      {/* Header Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-primary)', backgroundColor: 'rgba(111,174,217,0.1)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(111,174,217,0.2)' }}>
                              WO#: {wo.folioNumber}
                            </span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{wo.patient}</span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                            {wo.prosthesisType?.name} • {t('workOrder.boxNo')}: {wo.boxNumber || t('common.na')}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '3px 10px',
                              borderRadius: '100px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              backgroundColor: isActive
                                ? 'rgba(46,204,113,0.1)'
                                : isPaused
                                  ? 'rgba(241,196,15,0.1)'
                                  : isReady
                                    ? 'rgba(111,174,217,0.1)'
                                    : 'rgba(148,163,184,0.1)',
                              color: isActive
                                ? 'var(--success)'
                                : isPaused
                                  ? 'var(--warning)'
                                  : isReady
                                    ? 'var(--accent-primary)'
                                    : 'var(--text-muted)'
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: isActive
                                  ? 'var(--success)'
                                  : isPaused
                                    ? 'var(--warning)'
                                    : isReady
                                      ? 'var(--accent-primary)'
                                      : 'var(--text-muted)'
                              }}
                              className={isActive ? 'animate-pulse' : ''}
                            />
                            {isActive
                              ? t('enums.processStatus.IN_PROGRESS')
                              : isPaused
                                ? t('enums.processStatus.PAUSED')
                                : isReady
                                  ? t('techDashboard.readyToStart')
                                  : t('techDashboard.precedingStepBlocked')}
                          </span>
                        </div>
                      </div>

                      {/* Step Details Box */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'var(--bg-card)',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('techDashboard.currentStep')}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>Step {proc.sequence + 1}: {proc.processName}</span>
                            {proc.reworkActive && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                                {t('workOrder.reworkActive')}
                              </span>
                            )}
                          </span>
                        </div>

                        {proc.pauseCount > 0 && (
                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              {t('techDashboard.pauses')}
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              {t('techDashboard.xTimes', { count: proc.pauseCount })}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action Control Panel */}
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Link
                          to={`/tech/work-orders?selectWo=${wo.id}`}
                          className="btn btn--outline btn--sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Eye size={14} /> {t('techDashboard.viewDetails')}
                        </Link>

                        {isNotStarted && isReady && (
                          <button
                            className="btn btn--primary btn--sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={(e) => handleAction(e, proc.id, 'start')}
                          >
                            <Play size={14} /> {t('workOrder.startProcess')}
                          </button>
                        )}

                        {isNotStarted && !isReady && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontStyle: 'italic' }}>
                            <Clock size={13} /> {t('techDashboard.precedingStepBlocked')}
                          </span>
                        )}

                        {isActive && (
                          <>
                            <button
                              className="btn btn--warning btn--sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                              onClick={(e) => handleAction(e, proc.id, 'pause')}
                            >
                              <Pause size={14} /> {t('workOrder.pauseProcess')}
                            </button>
                            <button
                              className="btn btn--primary btn--sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                              onClick={(e) => handleAction(e, proc.id, 'end')}
                            >
                              <CheckCircle2 size={14} /> {t('workOrder.endProcess')}
                            </button>
                          </>
                        )}

                        {isPaused && (
                          <>
                            <button
                              className="btn btn--success btn--sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                              onClick={(e) => handleAction(e, proc.id, 'resume')}
                            >
                              <Play size={14} /> {t('workOrder.resumeProcess')}
                            </button>
                            <button
                              className="btn btn--primary btn--sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                              onClick={(e) => handleAction(e, proc.id, 'end')}
                            >
                              <CheckCircle2 size={14} /> {t('workOrder.endProcess')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info Section */}
        <div className="lg:col-span-1" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick QR Scan Section - Controlled by SHOW_QUICK_QR_SCAN flag */}
          {SHOW_QUICK_QR_SCAN && (
            <div className="dashboard-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} style={{ color: 'var(--accent-primary)' }} />
                {t('techDashboard.quickQRScan')}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: '1.4' }}>
                {t('techDashboard.quickQRScanDesc')}
              </p>
              <div style={{
                border: '2px dashed var(--border)',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-card)',
                gap: '8px',
                cursor: 'not-allowed',
                opacity: 0.8
              }}>
                <div style={{ width: '60px', height: '60px', backgroundColor: 'var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.5rem' }}>📷</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('techDashboard.cameraScanDisabled')}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {t('techDashboard.requiresHttpsApp')}
                </span>
              </div>
            </div>
          )}

          <div className="dashboard-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
              {t('techDashboard.workflowRules')}
            </h3>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', margin: '0' }}>
              <li>
                <strong>{t('techDashboard.ruleStrictSequencingTitle')}</strong> {t('techDashboard.ruleStrictSequencingDesc')}
              </li>
              <li>
                <strong>{t('techDashboard.ruleAutomaticHandoffTitle')}</strong> {t('techDashboard.ruleAutomaticHandoffDesc')}
              </li>
              <li>
                <strong>{t('techDashboard.rulePauseLoggingTitle')}</strong> {t('techDashboard.rulePauseLoggingDesc')}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

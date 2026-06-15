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
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  technicianPortalService,
  type TechnicianDashboardStats,
  type TechnicianWorkOrderListItem,
} from '../services';

export function TechnicianDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<TechnicianDashboardStats | null>(null);
  const [activeJobs, setActiveJobs] = useState<TechnicianWorkOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statsData, jobsData] = await Promise.all([
        technicianPortalService.getDashboardStats(),
        technicianPortalService.getAssignedWorkOrders('IN_PROGRESS'),
      ]);
      setStats(statsData);
      setActiveJobs(jobsData);
    } catch {
      toast.error('Failed to load dashboard data. Please try again.');
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

  const handleAction = async (
    e: React.MouseEvent,
    processId: string,
    action: 'start' | 'pause' | 'resume' | 'end'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const loadingToast = toast.loading(`${action.toUpperCase()}ing process...`);
    try {
      if (action === 'start') {
        await technicianPortalService.startProcess(processId);
        toast.success('Process started successfully!', { id: loadingToast });
      } else if (action === 'pause') {
        await technicianPortalService.pauseProcess(processId);
        toast.success('Process paused successfully!', { id: loadingToast });
      } else if (action === 'resume') {
        await technicianPortalService.resumeProcess(processId);
        toast.success('Process resumed successfully!', { id: loadingToast });
      } else if (action === 'end') {
        await technicianPortalService.endProcess(processId);
        toast.success('Process ended and completed!', { id: loadingToast });
      }
      fetchDashboardData();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || `Failed to perform ${action} action.`;
      toast.error(errMsg, { id: loadingToast });
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
      <div className="loading-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  // Find process assigned to this technician in a work order
  const getAssignedProcess = (wo: TechnicianWorkOrderListItem) => {
    return wo.processes.find((p) => p.technicianId === user?.id && (p.status === 'IN_PROGRESS' || p.status === 'PAUSED'));
  };

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="dashboard-page__header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="dashboard-page__title">
            {getGreeting()}, {user?.firstName}!
          </h1>
          <p className="dashboard-page__subtitle" style={{ color: 'var(--text-secondary)' }}>
            Here is your active technician workspace for today.
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
            <span className="stat-card__label">Pending Steps</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card__icon stat-card__icon--success" style={{ backgroundColor: 'rgba(46,204,113,0.1)', color: 'var(--success)' }}>
            <Activity size={22} className="animate-pulse" />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats?.activeCount ?? 0}</span>
            <span className="stat-card__label">Active Steps</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card__icon stat-card__icon--warning" style={{ backgroundColor: 'rgba(241,196,15,0.1)', color: 'var(--warning)' }}>
            <Pause size={22} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats?.pausedCount ?? 0}</span>
            <span className="stat-card__label">Paused Steps</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--info)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="stat-card__icon stat-card__icon--info" style={{ backgroundColor: 'rgba(52,152,219,0.1)', color: 'var(--info)' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats?.completedTodayCount ?? 0}</span>
            <span className="stat-card__label">Completed Today</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Queue Control Section */}
        <div className="lg:col-span-2">
          <div className="dashboard-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="dashboard-card__title" style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} style={{ color: 'var(--success)' }} />
                My Active Queue
              </h3>
              <Link to="/tech/work-orders" className="btn btn--outline btn--sm" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                View All Queue <ChevronRight size={14} />
              </Link>
            </div>

            {activeJobs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <ClipboardList size={36} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <h4 style={{ fontWeight: 500, fontSize: '0.95rem' }}>No active processes currently</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '320px', margin: '0' }}>
                  Head over to the Work Orders page to start one of your assigned pending steps.
                </p>
                <Link to="/tech/work-orders" className="btn btn--primary btn--sm" style={{ marginTop: '0.5rem' }}>
                  Open My Work Orders
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeJobs.map((wo) => {
                  const proc = getAssignedProcess(wo);
                  if (!proc) return null;
                  const isPaused = proc.status === 'PAUSED';

                  return (
                    <div
                      key={wo.id}
                      className="card animate-fade-in"
                      style={{
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: `1px solid ${isPaused ? 'var(--warning)' : 'var(--border)'}`,
                        backgroundColor: 'var(--bg-surface)',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {isPaused && (
                        <div style={{
                          position: 'absolute',
                          top: '0',
                          left: '0',
                          right: '0',
                          height: '3px',
                          backgroundColor: 'var(--warning)'
                        }} />
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', padding: '2px 8px', borderRadius: '100px' }}>
                              {wo.folioNumber}
                            </span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{wo.patient}</span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                            {wo.prosthesisType?.name} • Box: {wo.boxNumber || 'N/A'}
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '100px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: isPaused ? 'rgba(241,196,15,0.1)' : 'rgba(46,204,113,0.1)',
                              color: isPaused ? 'var(--warning)' : 'var(--success)'
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: isPaused ? 'var(--warning)' : 'var(--success)'
                              }}
                              className={!isPaused ? 'animate-pulse' : ''}
                            />
                            {isPaused ? 'Paused' : 'In Progress'}
                          </span>
                        </div>
                      </div>

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
                            Current Stage
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {proc.processName}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            Pauses
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {proc.pauseCount} times
                          </span>
                        </div>
                      </div>

                      {/* Control Panel Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        {isPaused ? (
                          <button
                            className="btn btn--success btn--sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={(e) => handleAction(e, proc.id, 'resume')}
                          >
                            <Play size={14} /> Resume Process
                          </button>
                        ) : (
                          <button
                            className="btn btn--warning btn--sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={(e) => handleAction(e, proc.id, 'pause')}
                          >
                            <Pause size={14} /> Pause Process
                          </button>
                        )}
                        <button
                          className="btn btn--primary btn--sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={(e) => handleAction(e, proc.id, 'end')}
                        >
                          <CheckCircle2 size={14} /> End Process
                        </button>
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
          <div className="dashboard-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} style={{ color: 'var(--accent-primary)' }} />
              Quick QR Scan
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0', lineHeight: '1.4' }}>
              Instantly start or complete processes by scanning the QR code printed on the physical Work Order box.
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
                Camera Scan Disabled
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                Requires HTTPS Companion App
              </span>
            </div>
          </div>

          <div className="dashboard-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
              Workflow Rules
            </h3>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', margin: '0' }}>
              <li>
                <strong>Strict Sequencing:</strong> You cannot start a process step until the previous step is 100% completed.
              </li>
              <li>
                <strong>Automatic Handoff:</strong> When you click "End Process", the next technician will be alerted automatically.
              </li>
              <li>
                <strong>Pause Logging:</strong> Pausing a step stops the active duration log, preventing SLA inflation.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

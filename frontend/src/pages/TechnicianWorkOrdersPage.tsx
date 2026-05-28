import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context';
import {
  Search,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  Lock,
  ChevronRight,
  X,
  Calendar,
  User,
  Activity,
  Clipboard,
  ShieldCheck,
  AlertTriangle,
  History,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  technicianPortalService,
  type TechnicianWorkOrderListItem,
  type TechnicianProcessItem,
} from '../services';

// Digital timer sub-component for premium visual effect
function ProcessTimer({ startedAt, lastPausedAt, totalPauseDuration, status }: {
  startedAt: string | null;
  lastPausedAt: string | null;
  totalPauseDuration: number;
  status: string;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setSeconds(0);
      return;
    }

    const calculateElapsed = () => {
      const startTime = new Date(startedAt).getTime();
      const now = new Date().getTime();

      let pauseTime = totalPauseDuration * 1000;
      if (status === 'PAUSED' && lastPausedAt) {
        const pauseStart = new Date(lastPausedAt).getTime();
        pauseTime += (now - pauseStart);
      }

      const elapsed = Math.max(0, now - startTime - pauseTime);
      setSeconds(Math.floor(elapsed / 1000));
    };

    calculateElapsed();

    if (status !== 'IN_PROGRESS') {
      return;
    }

    const interval = setInterval(calculateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startedAt, lastPausedAt, totalPauseDuration, status]);

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: '1.25rem',
      fontWeight: 700,
      color: status === 'PAUSED' ? 'var(--warning)' : 'var(--accent-primary)',
      backgroundColor: status === 'PAUSED' ? 'rgba(241,196,15,0.08)' : 'rgba(111,174,217,0.08)',
      padding: '4px 12px',
      borderRadius: '6px',
      border: `1px solid ${status === 'PAUSED' ? 'var(--warning)' : 'var(--accent-primary)'}`,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    }}>
      <Clock size={16} />
      <span>{formatTime(seconds)}</span>
    </div>
  );
}

export function TechnicianWorkOrdersPage() {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<TechnicianWorkOrderListItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<TechnicianWorkOrderListItem | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const detailRef = useRef<HTMLDivElement>(null);

  const fetchWorkOrders = useCallback(async () => {
    try {
      const data = await technicianPortalService.getAssignedWorkOrders(activeTab);
      setWorkOrders(data);

      // Refresh selected order details if drawer is open to update stepper and logs
      if (selectedOrder) {
        const updated = await technicianPortalService.getWorkOrderDetail(selectedOrder.id);
        setSelectedOrder(updated);
      }
    } catch {
      toast.error('Failed to retrieve work orders.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedOrder?.id]);

  useEffect(() => {
    fetchWorkOrders();
  }, [activeTab]);

  // Click outside to close drawer helper
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (detailRef.current && !detailRef.current.contains(event.target as Node)) {
        setSelectedOrder(null);
      }
    }
    if (selectedOrder) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOrder]);

  const handleSelectOrder = async (order: TechnicianWorkOrderListItem) => {
    try {
      setLoading(true);
      const detail = await technicianPortalService.getWorkOrderDetail(order.id);
      setSelectedOrder(detail);
    } catch {
      toast.error('Failed to load work order details.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (processId: string, action: 'start' | 'pause' | 'resume' | 'end') => {
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
        toast.success('Process completed!', { id: loadingToast });
      }
      fetchWorkOrders();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || `Failed to ${action} process.`;
      toast.error(errMsg, { id: loadingToast });
    }
  };

  // Helper check if previous sequence steps are completed
  const isPrecedingStepCompleted = (currentProc: TechnicianProcessItem, processes: TechnicianProcessItem[]) => {
    return processes
      .filter((p) => p.sequence < currentProc.sequence)
      .every((p) => p.status === 'COMPLETED');
  };

  // Filter local items by search query (folio or patient name)
  const filteredOrders = workOrders.filter((wo) =>
    wo.folioNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wo.patient.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMyStep = (wo: TechnicianWorkOrderListItem) => {
    return wo.processes.find((p) => p.technicianId === user?.id);
  };

  const getActionBadgeColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'rgba(46,204,113,0.1)';
      case 'IN_PROGRESS':
        return 'rgba(111,174,217,0.1)';
      case 'PAUSED':
        return 'rgba(241,196,15,0.1)';
      default:
        return 'var(--bg-card)';
    }
  };

  const getActionTextColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'var(--success)';
      case 'IN_PROGRESS':
        return 'var(--accent-primary)';
      case 'PAUSED':
        return 'var(--warning)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const formatActivityTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  };

  const formatDurationString = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  if (loading && workOrders.length === 0) {
    return (
      <div className="loading-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="work-orders-page animate-fade-in" style={{ position: 'relative' }}>
      {/* Search and Tabs Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-page__title">My Work Orders</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manage processes assigned to you and update production queues.
          </p>
        </div>

        <div className="search-bar" style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 12px', minWidth: '280px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
          <input
            type="text"
            placeholder="Search by folio or patient name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.85rem', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Tabs Row */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((tab) => (
          <button
            key={tab}
            className={`btn btn--sm ${activeTab === tab ? 'btn--primary' : 'btn--outline'}`}
            style={{ padding: '0.35rem 1rem', borderRadius: '100px', fontSize: '0.75rem', textTransform: 'capitalize' }}
            onClick={() => { setActiveTab(tab); setSelectedOrder(null); }}
          >
            {tab === 'ALL' ? 'All Assigned' : tab === 'PENDING' ? 'Not Started' : tab === 'IN_PROGRESS' ? 'In Progress / Paused' : 'Completed'}
          </button>
        ))}
      </div>

      {/* Main Container: Split screen when details drawer is open */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ alignItems: 'flex-start' }}>
        {/* Work Order Cards List */}
        <div className={selectedOrder ? 'lg:col-span-2' : 'lg:col-span-3'} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <Clipboard size={42} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <h4 style={{ fontWeight: 500 }}>No assigned work orders found</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '320px', margin: '0' }}>
                You do not have any work orders matches this filter context.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((wo) => {
                const myStep = getMyStep(wo);
                const isSelected = selectedOrder?.id === wo.id;
                if (!myStep) return null;

                return (
                  <div
                    key={wo.id}
                    className="card active-card animate-fade-in"
                    style={{
                      padding: '1.25rem',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                      backgroundColor: 'var(--bg-surface)',
                      boxShadow: 'var(--shadow-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                    onClick={() => handleSelectOrder(wo)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', padding: '2px 8px', borderRadius: '100px', marginRight: '6px' }}>
                          {wo.folioNumber}
                        </span>
                        <h4 style={{ display: 'inline', fontWeight: 600, fontSize: '0.9rem' }}>{wo.patient}</h4>
                      </div>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {new Date(wo.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '0.75rem' }}>
                      <div>Prosthesis: <strong>{wo.prosthesisType?.name}</strong></div>
                      <div>Doctor: <strong>{wo.doctor?.name} ({wo.doctor?.clinicName || 'Clinic'})</strong></div>
                      <div>Box No: <strong>{wo.boxNumber || 'N/A'}</strong></div>
                    </div>

                    {/* Step assigned to this technician highlight block */}
                    <div style={{
                      backgroundColor: getActionBadgeColor(myStep.status),
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>My Step Assignment</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{myStep.processName}</span>
                      </div>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: getActionTextColor(myStep.status),
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
                      }}>
                        {myStep.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600, alignItems: 'center', gap: '2px' }}>
                      View Details & Stepper <ChevronRight size={12} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Details Stepper Slide-Drawer on Right */}
        {selectedOrder && (
          <div
            ref={detailRef}
            className="lg:col-span-1 dashboard-card animate-fade-in"
            style={{
              padding: '1.5rem',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-lg)',
              position: 'sticky',
              top: '80px',
              zIndex: 10,
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', padding: '2px 8px', borderRadius: '100px' }}>
                  {selectedOrder.folioNumber}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Work Order Details
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* General Specs Block */}
            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>{selectedOrder.patient}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={13} /> Created: {new Date(selectedOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={13} /> Doctor: {selectedOrder.doctor?.name} ({selectedOrder.doctor?.clinicName || 'Clinic'})</div>
                {selectedOrder.specification && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    border: '1px solid var(--border)',
                    lineHeight: '1.4'
                  }}>
                    <strong>Dental Spec/Shade:</strong> {selectedOrder.specification}
                  </div>
                )}
                {selectedOrder.notes && (
                  <div style={{ fontSize: '0.75rem', fontStyle: 'italic', marginTop: '4px' }}>
                    Notes: {selectedOrder.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Stepper Timeline Tracker */}
            <div style={{ marginBottom: '1.75rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={14} /> Workflow Stepper Sequence
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedOrder.processes.map((proc, index) => {
                  const isCompleted = proc.status === 'COMPLETED';
                  const isActive = proc.status === 'IN_PROGRESS';
                  const isPaused = proc.status === 'PAUSED';
                  const isAssignedToMe = proc.technicianId === user?.id;
                  const isReady = proc.status === 'NOT_STARTED' && isPrecedingStepCompleted(proc, selectedOrder.processes);
                  const isBlocked = proc.status === 'NOT_STARTED' && !isReady;

                  return (
                    <div
                      key={proc.id}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        position: 'relative'
                      }}
                    >
                      {/* Vertically linking timeline lines */}
                      {index < selectedOrder.processes.length - 1 && (
                        <div style={{
                          position: 'absolute',
                          left: '11px',
                          top: '24px',
                          bottom: '-12px',
                          width: '2px',
                          backgroundColor: isCompleted ? 'var(--success)' : 'var(--border)',
                          zIndex: 1
                        }} />
                      )}

                      {/* Timeline Dot/Icon */}
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                          backgroundColor: isCompleted
                            ? 'var(--success)'
                            : isPaused
                              ? 'var(--warning)'
                              : isActive
                                ? 'var(--accent-primary)'
                                : isBlocked
                                  ? 'var(--border)'
                                  : 'var(--bg-card)',
                          border: `1.5px solid ${isCompleted ? 'var(--success)' : isPaused ? 'var(--warning)' : isActive ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                          color: '#fff',
                        }}
                        className={isActive ? 'animate-pulse' : ''}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={13} />
                        ) : isBlocked ? (
                          <Lock size={10} style={{ color: 'var(--text-muted)' }} />
                        ) : (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isActive || isPaused ? '#fff' : 'var(--text-secondary)' }}>
                            {proc.sequence + 1}
                          </span>
                        )}
                      </div>

                      {/* Process Card Item Details */}
                      <div style={{
                        flex: 1,
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        backgroundColor: (isActive || isPaused) ? 'var(--bg-card)' : 'var(--bg-surface)',
                        border: `1px solid ${(isActive || isPaused) ? 'var(--accent-primary)' : 'var(--border)'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: (isActive || isPaused) ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                              {proc.processName}
                            </span>
                            {isAssignedToMe && (
                              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: 'var(--success)', backgroundColor: 'rgba(46,204,113,0.08)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(46,204,113,0.2)' }}>
                                Assigned To Me
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            Tech: {proc.technician ? `${proc.technician.firstName} ${proc.technician.lastName[0]}.` : 'Unassigned'}
                          </span>
                        </div>

                        {proc.totalActiveDuration > 0 && isCompleted && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <ShieldCheck size={11} style={{ color: 'var(--success)' }} />
                            {formatDurationString(proc.totalActiveDuration)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Real-time active job controls */}
            {(() => {
              const myStep = getMyStep(selectedOrder);
              if (!myStep) return null;

              const isCompleted = myStep.status === 'COMPLETED';
              const isActive = myStep.status === 'IN_PROGRESS';
              const isPaused = myStep.status === 'PAUSED';
              const isReady = myStep.status === 'NOT_STARTED' && isPrecedingStepCompleted(myStep, selectedOrder.processes);
              const isBlocked = myStep.status === 'NOT_STARTED' && !isReady;

              return (
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  marginBottom: '1.5rem'
                }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                    Process Timing Control Panel
                  </h4>

                  {isBlocked && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.75rem', backgroundColor: 'rgba(231,76,60,0.05)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.1)' }}>
                      <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '1px' }} />
                      <span>You cannot start your assigned step step because preceding steps in the sequence have not been completed.</span>
                    </div>
                  )}

                  {!isBlocked && !isCompleted && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {(isActive || isPaused) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Active Time Elapsed:</span>
                          <ProcessTimer
                            startedAt={myStep.startedAt}
                            lastPausedAt={myStep.lastPausedAt}
                            totalPauseDuration={myStep.totalPauseDuration}
                            status={myStep.status}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {myStep.status === 'NOT_STARTED' && (
                          <button
                            className="btn btn--primary"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            onClick={() => handleAction(myStep.id, 'start')}
                          >
                            <Play size={16} /> Start Process
                          </button>
                        )}

                        {isActive && (
                          <button
                            className="btn btn--warning"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            onClick={() => handleAction(myStep.id, 'pause')}
                          >
                            <Pause size={16} /> Pause Process
                          </button>
                        )}

                        {isPaused && (
                          <button
                            className="btn btn--success"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#fff' }}
                            onClick={() => handleAction(myStep.id, 'resume')}
                          >
                            <Play size={16} /> Resume Process
                          </button>
                        )}

                        {(isActive || isPaused) && (
                          <button
                            className="btn btn--primary"
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            onClick={() => handleAction(myStep.id, 'end')}
                          >
                            <CheckCircle2 size={16} /> End Process
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isCompleted && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>
                      <CheckCircle2 size={18} />
                      <span>Completed! Total Active Time: {formatDurationString(myStep.totalActiveDuration)}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Audit Trail Timeline Logs */}
            {selectedOrder.processes.find(p => p.technicianId === user?.id)?.activityLogs && (
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={14} /> Process Log Audit Trail
                </h4>

                {(() => {
                  const myStep = getMyStep(selectedOrder);
                  const logs = myStep?.activityLogs || [];

                  if (logs.length === 0) {
                    return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No logs captured yet.</span>;
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '8px', borderLeft: '2px solid var(--border)' }}>
                      {logs.map((log) => (
                        <div key={log.id} style={{ position: 'relative', fontSize: '0.75rem', display: 'flex', flexDirection: 'column' }}>
                          {/* Dot marker */}
                          <div style={{
                            position: 'absolute',
                            left: '-13px',
                            top: '4px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: log.action === 'END' ? 'var(--success)' : log.action === 'PAUSE' ? 'var(--warning)' : 'var(--accent-primary)'
                          }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                            <span style={{ color: log.action === 'END' ? 'var(--success)' : log.action === 'PAUSE' ? 'var(--warning)' : 'var(--text-primary)' }}>
                              {log.action} Action
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                              {formatActivityTime(log.timestamp)}
                            </span>
                          </div>
                          {log.notes && (
                            <span style={{ color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.7rem' }}>
                              {log.notes}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

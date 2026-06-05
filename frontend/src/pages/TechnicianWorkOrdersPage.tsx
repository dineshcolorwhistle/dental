import { useState, useEffect, useCallback } from 'react';
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
  Edit3,
  FileText,
  Save,
  QrCode,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  technicianPortalService,
  type TechnicianWorkOrderListItem,
  type TechnicianProcessItem,
} from '../services';
import { QRLabelModal } from '../components';

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
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrWO, setQrWO] = useState<any>(null);

  const [detailTab, setDetailTab] = useState<'general' | 'process'>('general');

  // Editable notes state
  const [notesText, setNotesText] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Sync notes state when selected order updates or changes
  useEffect(() => {
    if (selectedOrder) {
      if (!isEditingNotes) {
        setNotesText(selectedOrder.notes || '');
      }
    } else {
      setNotesText('');
      setIsEditingNotes(false);
      setDetailTab('general');
    }
  }, [selectedOrder, isEditingNotes]);

  const handleSaveNotes = async () => {
    if (!selectedOrder) return;
    setSavingNotes(true);
    const loadingToast = toast.loading('Updating notes...');
    try {
      await technicianPortalService.updateNotes(selectedOrder.id, notesText);
      toast.success('Notes updated successfully!', { id: loadingToast });
      setIsEditingNotes(false);
      
      // Update local state instantly to avoid waiting for reload
      setSelectedOrder(prev => prev ? { ...prev, notes: notesText } : null);
      setWorkOrders(prev => prev.map(wo => wo.id === selectedOrder.id ? { ...wo, notes: notesText } : wo));
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to update notes.';
      toast.error(errMsg, { id: loadingToast });
    } finally {
      setSavingNotes(false);
    }
  };

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

  // Drawer clicked backdrop is handled directly via overlay onClick event.

  const handleSelectOrder = async (order: TechnicianWorkOrderListItem) => {
    try {
      setLoading(true);
      setDetailTab('general');
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

      {/* Main Container: Full width card list since detail drawer is now a premium modal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Clipboard size={42} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            <h4 style={{ fontWeight: 500 }}>No assigned work orders found</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '320px', margin: '0' }}>
              You do not have any work orders matching this filter context.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.5rem'
          }}>
            {filteredOrders.map((wo) => {
              const myStep = getMyStep(wo);
              const isSelected = selectedOrder?.id === wo.id;
              if (!myStep) return null;

              return (
                <div
                  key={wo.id}
                  className="card active-card animate-fade-in"
                  style={{
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                    backgroundColor: 'var(--bg-surface)',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1.25rem',
                  }}
                  onClick={() => handleSelectOrder(wo)}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-light)', padding: '2px 8px', borderRadius: '100px', marginRight: '6px' }}>
                          {wo.folioNumber}
                        </span>
                        <h4 style={{ display: 'inline', fontWeight: 600, fontSize: '0.9rem' }}>{wo.patient}</h4>
                      </div>
                      <button
                        type="button"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setQrWO(wo);
                          setShowQrModal(true);
                        }}
                        title="Print QR Label"
                      >
                        <QrCode size={16} />
                      </button>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.75rem' }}>
                      <div>Prosthesis: <strong>{wo.prosthesisType?.name}</strong></div>
                      <div>Doctor: <strong>{wo.doctor?.name} ({wo.doctor?.clinicName || 'Clinic'})</strong></div>
                      <div>Box No: <strong>{wo.boxNumber || 'N/A'}</strong></div>
                    </div>
                  </div>

                  <div>
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                        Created: {new Date(wo.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                        View Details & Stepper <ChevronRight size={12} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Stepper Premium Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div
            className="modal modal--lg animate-fade-in"
            style={{ maxHeight: '90vh', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__header" style={{ padding: '1.5rem 1.75rem 1rem 1.75rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span>{selectedOrder.patient}</span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(111, 174, 217, 0.1)',
                    color: 'var(--accent-primary)',
                    fontFamily: 'monospace',
                    border: '1px solid rgba(111, 174, 217, 0.2)'
                  }}>
                    Folio: {selectedOrder.folioNumber}
                  </span>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '6px',
                      height: '24px'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setQrWO(selectedOrder);
                      setShowQrModal(true);
                    }}
                  >
                    <QrCode size={12} />
                    <span>Print QR</span>
                  </button>
                </h2>
                <p className="modal__subtitle" style={{ marginTop: '4px' }}>
                  Work Order Details, Interactive Stepper & Processing Timer
                </p>
              </div>
              <button
                className="modal__close"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs navigation */}
            <div style={{ padding: '0 1.75rem', marginTop: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div className="modal-tabs" style={{ display: 'flex', gap: '1.5rem' }}>
                <button
                  type="button"
                  className={`modal-tab-btn ${detailTab === 'general' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => setDetailTab('general')}
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: detailTab === 'general' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: detailTab === 'general' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  General Information
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${detailTab === 'process' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => setDetailTab('process')}
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: detailTab === 'process' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: detailTab === 'process' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Process & Audit
                </button>
              </div>
            </div>

            <div className="modal__body" style={{ padding: '1.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {detailTab === 'general' && (
                <>
                  {/* General Specs Block */}
                  <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Created On</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                          <span>{new Date(selectedOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Doctor</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          <User size={14} style={{ color: 'var(--accent-primary)' }} />
                          <span>{selectedOrder.doctor?.name} ({selectedOrder.doctor?.clinicName || 'Clinic'})</span>
                        </div>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Color</span>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          backgroundColor: 'rgba(111, 174, 217, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          display: 'inline-block'
                        }}>{selectedOrder.color}</span>
                      </div>
                      {selectedOrder.boxNumber && (
                        <div>
                          <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Box Number</span>
                          <span style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            backgroundColor: 'rgba(148, 163, 184, 0.08)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            display: 'inline-block'
                          }}>{selectedOrder.boxNumber}</span>
                        </div>
                      )}
                    </div>
                    {selectedOrder.specification && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        border: '1px solid var(--border)',
                        lineHeight: '1.5',
                        color: 'var(--text-primary)'
                      }}>
                        <strong style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Dental Spec/Shade Instructions</strong>
                        {selectedOrder.specification}
                      </div>
                    )}
                  </div>

                  {/* Premium Editable Work Order Notes Section */}
                  <div style={{
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <FileText size={14} /> Work Order Notes
                      </h4>
                      {!isEditingNotes && (
                        <button
                          onClick={() => setIsEditingNotes(true)}
                          className="btn btn--outline btn--sm"
                          style={{
                            padding: '2px 8px',
                            fontSize: '0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            borderRadius: '6px'
                          }}
                        >
                          <Edit3 size={11} /> Edit Notes
                        </button>
                      )}
                    </div>

                    {isEditingNotes ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <textarea
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          placeholder="Enter process notes, special requirements, or updates for this work order..."
                          style={{
                            width: '100%',
                            minHeight: '90px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--accent-primary)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '0.8rem',
                            lineHeight: '1.4',
                            resize: 'vertical',
                            outline: 'none',
                            boxShadow: '0 0 0 2px rgba(111,174,217,0.1)'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => {
                              setIsEditingNotes(false);
                              setNotesText(selectedOrder.notes || '');
                            }}
                            disabled={savingNotes}
                            className="btn btn--outline btn--sm"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveNotes}
                            disabled={savingNotes}
                            className="btn btn--primary btn--sm"
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Save size={12} /> {savingNotes ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '0.78rem',
                        lineHeight: '1.5',
                        color: selectedOrder.notes ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontStyle: selectedOrder.notes ? 'normal' : 'italic'
                      }}>
                        {selectedOrder.notes || 'No work order notes recorded yet. Click edit to add notes.'}
                      </div>
                    )}
                  </div>
                </>
              )}

              {detailTab === 'process' && (
                <>
                  {/* Stepper Timeline Tracker */}
                  <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.25rem' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                        marginBottom: '1.5rem',
                        marginTop: '1.5rem'
                      }}>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                          Process Timing Control Panel
                        </h4>

                        {isBlocked && (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.75rem', backgroundColor: 'rgba(231,76,60,0.05)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.1)' }}>
                            <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '1px' }} />
                            <span>You cannot start your assigned step because preceding steps in the sequence have not been completed.</span>
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
                  {(() => {
                    const myStep = getMyStep(selectedOrder);
                    const logs = myStep?.activityLogs || [];

                    if (logs.length === 0) return null;

                    return (
                      <div style={{ marginTop: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <History size={14} /> Process Log Audit Trail
                        </h4>

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
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <QRLabelModal
        isOpen={showQrModal}
        onClose={() => {
          setShowQrModal(false);
          setQrWO(null);
        }}
        workOrder={qrWO}
      />
    </div>
  );
}

import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../context';
import {
  X,
  Loader2,
  History,
  Play,
  Check,
  PlusCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workOrderService } from '../services';

interface PaymentHistoryItem {
  amount: number;
  notes: string;
  date: string;
}

interface ViewWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string | null;
  onUpdate?: (updatedWO?: any) => void;
}

const parseNotesAndPayments = (notesString: string | null): { userNotes: string; payments: PaymentHistoryItem[] } => {
  if (!notesString) return { userNotes: '', payments: [] };
  const startTag = '<!-- PAYMENTS_START -->';
  const endTag = '<!-- PAYMENTS_END -->';
  const startIndex = notesString.indexOf(startTag);
  const endIndex = notesString.indexOf(endTag);
  
  if (startIndex !== -1 && endIndex !== -1) {
    const userNotes = (notesString.substring(0, startIndex) + notesString.substring(endIndex + endTag.length)).trim();
    const paymentsJson = notesString.substring(startIndex + startTag.length, endIndex).trim();
    let payments = [];
    try {
      payments = JSON.parse(paymentsJson);
    } catch (e) {
      console.error('Failed to parse payment log', e);
    }
    return { userNotes, payments };
  }
  return { userNotes: notesString.trim(), payments: [] };
};

const stringifyNotesAndPayments = (userNotes: string, payments: PaymentHistoryItem[]): string => {
  const cleanedNotes = userNotes.trim();
  if (payments.length === 0) return cleanedNotes;
  return `${cleanedNotes}\n\n<!-- PAYMENTS_START -->${JSON.stringify(payments)}<!-- PAYMENTS_END -->`;
};

export function ViewWorkOrderModal({ isOpen, onClose, workOrderId, onUpdate }: ViewWorkOrderModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isLabAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';

  const [selectedWO, setSelectedWO] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'general' | 'process' | 'payment'>('general');
  const [showAddFundForm, setShowAddFundForm] = useState(false);
  const [addFundAmount, setAddFundAmount] = useState('');
  const [addFundNotes, setAddFundNotes] = useState('');
  const [expandedAuditRow, setExpandedAuditRow] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    if (isOpen && workOrderId) {
      setLoading(true);
      setViewTab('general');
      setShowAddFundForm(false);
      setAddFundAmount('');
      setAddFundNotes('');
      setExpandedAuditRow(null);

      workOrderService.getById(workOrderId)
        .then((data) => {
          setSelectedWO(data);
        })
        .catch((err) => {
          console.error('Failed to load work order details', err);
          toast.error('Failed to load work order details');
          onClose();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setSelectedWO(null);
    }
  }, [isOpen, workOrderId, onClose]);

  if (!isOpen || !workOrderId) return null;

  const handleInlineStartVerification = async (woId: string, processId: string) => {
    const loadingToast = toast.loading('Starting verification process...');
    try {
      await workOrderService.startVerification(woId, processId);
      toast.success('Verification started!', { id: loadingToast });
      const detailedWo = await workOrderService.getById(woId);
      setSelectedWO(detailedWo);
      if (onUpdate) onUpdate(detailedWo);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to start verification.';
      toast.error(errMsg, { id: loadingToast });
    }
  };

  const handleInlineEndVerification = async (woId: string, processId: string, outcome: 'SUCCESS' | 'REWORK') => {
    const loadingToast = toast.loading(`Completing verification as ${outcome}...`);
    try {
      await workOrderService.endVerification(woId, processId, outcome);
      toast.success(`Verification completed as ${outcome}!`, { id: loadingToast });
      const detailedWo = await workOrderService.getById(woId);
      setSelectedWO(detailedWo);
      if (onUpdate) onUpdate(detailedWo);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Failed to complete verification.';
      toast.error(errMsg, { id: loadingToast });
    }
  };

  const handleAddFund = async () => {
    if (!selectedWO) return;
    const quote = selectedWO.totalQuote || 0;
    const { userNotes, payments } = parseNotesAndPayments(selectedWO.notes);
    const initialPay = selectedWO.initialPayment || 0;
    const balance = Math.max(0, quote - initialPay);

    const amount = parseFloat(addFundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }
    if (amount > balance) {
      toast.error(`Amount cannot exceed the remaining balance of $${balance.toLocaleString('es-MX')}`);
      return;
    }

    try {
      setSubmittingPayment(true);
      const newPayments: PaymentHistoryItem[] = [
        ...payments,
        {
          amount,
          notes: addFundNotes.trim(),
          date: new Date().toISOString()
        }
      ];

      const serializedNotes = stringifyNotesAndPayments(userNotes, newPayments);

      const updatedWO = await workOrderService.update(selectedWO.id, {
        initialPayment: initialPay + amount,
        notes: serializedNotes
      });

      toast.success('Fund added successfully!');
      setSelectedWO(updatedWO);
      if (onUpdate) onUpdate(updatedWO);
      
      setAddFundAmount('');
      setAddFundNotes('');
      setShowAddFundForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '1020px', width: '95%', height: 'auto', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        {loading || !selectedWO ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '12px' }}>
            <Loader2 size={36} className="spinner" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading work order details...</span>
          </div>
        ) : (
          <>
            <div className="modal__header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', margin: 0 }}>
                  <span>Work Order Details</span>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    padding: '2px 8px', 
                    borderRadius: '6px', 
                    backgroundColor: 'rgba(111, 174, 217, 0.1)', 
                    color: 'var(--accent-primary, #6FAED9)',
                    fontFamily: 'monospace',
                    border: '1px solid rgba(111, 174, 217, 0.2)'
                  }}>
                    Folio: {selectedWO.folioNumber}
                  </span>
                  {selectedWO.boxNumber && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: '6px', 
                      backgroundColor: 'rgba(148, 163, 184, 0.08)', 
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)'
                    }}>
                      Box: {selectedWO.boxNumber}
                    </span>
                  )}
                </h2>
                <p className="modal__subtitle" style={{ marginTop: '4px', margin: 0 }}>
                  Complete information and dynamic workflow progress tracking
                </p>
              </div>
              <button
                className="modal__close"
                onClick={onClose}
                aria-label="Close"
                style={{ top: '1.5rem', right: '1.5rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs navigation */}
            <div style={{ padding: '0 1.5rem', marginTop: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div className="modal-tabs" style={{ display: 'flex', gap: '1.5rem' }}>
                <button
                  type="button"
                  className={`modal-tab-btn ${viewTab === 'general' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => setViewTab('general')}
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: viewTab === 'general' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: viewTab === 'general' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  General Instructions
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${viewTab === 'process' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => setViewTab('process')}
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: viewTab === 'process' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: viewTab === 'process' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  Process
                </button>
                {isLabAdminOrOwner && (
                  <button
                    type="button"
                    className={`modal-tab-btn ${viewTab === 'payment' ? 'modal-tab-btn--active' : ''}`}
                    onClick={() => setViewTab('payment')}
                    style={{
                      padding: '0.75rem 0.5rem',
                      fontWeight: 600,
                      border: 'none',
                      borderBottom: viewTab === 'payment' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      color: viewTab === 'payment' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Payment Details
                  </button>
                )}
              </div>
            </div>

            <div className="modal__body" style={{ 
              maxHeight: 'calc(80vh - 140px)', 
              overflowY: 'auto', 
              padding: '1.5rem', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem' 
            }}>
              {(() => {
                const processes = selectedWO.processes || [];
                const { userNotes, payments } = parseNotesAndPayments(selectedWO.notes);
                
                // Determine active stepper index
                let activeIndex = 0;
                if (selectedWO.status === 'COMPLETED') {
                  activeIndex = processes.length;
                } else if (selectedWO.status === 'INTERNAL_VERIFICATION') {
                  const ivIdx = processes.findIndex((p: any) => p.isVerification && p.technicianId);
                  activeIndex = ivIdx !== -1 ? ivIdx : processes.length - 1;
                } else if (selectedWO.status === 'EXTERNAL_VERIFICATION') {
                  const evIdx = processes.findIndex((p: any) => p.isVerification && !p.technicianId);
                  activeIndex = evIdx !== -1 ? evIdx : processes.length - 1;
                } else if (selectedWO.status === 'IN_PROGRESS') {
                  const ipIdx = processes.findIndex((p: any) => p.status === 'IN_PROGRESS');
                  activeIndex = ipIdx !== -1 ? ipIdx : Math.min(processes.length - 1, Math.max(0, Math.floor(processes.length / 2)));
                } else if (selectedWO.status === 'ASSIGNED') {
                  activeIndex = 0;
                } else { // CREATED, FAILED, CANCELLED
                  activeIndex = -1;
                }

                // Determine active/in-progress step or fallback to first step details
                const hasActiveProcess = activeIndex >= 0 && activeIndex < processes.length;
                const displayProc = hasActiveProcess ? processes[activeIndex] : processes[0];

                const activeStepName = displayProc?.processName || 'No steps configured';
                const activeTechnician = displayProc?.technician 
                  ? `${displayProc.technician.firstName} ${displayProc.technician.lastName}` 
                  : (displayProc?.isVerification && !displayProc?.technicianId ? (selectedWO.doctor?.name || 'External Doctor') : 'Unassigned');

                const stepStatus = displayProc?.status || 'NOT_STARTED';
                const getStepStatusLabel = (status?: string) => {
                  if (!status) return 'Not Started';
                  switch (status) {
                    case 'COMPLETED': return 'Completed';
                    case 'IN_PROGRESS': return 'In Progress';
                    case 'PAUSED': return 'Paused';
                    case 'FAILED': return 'Failed';
                    case 'CANCELLED': return 'Cancelled';
                    default: return 'Not Started';
                  }
                };
                const stepStatusLabel = getStepStatusLabel(stepStatus);
                const getStepStatusColor = (status?: string) => {
                  switch (status) {
                    case 'COMPLETED': return 'var(--success, #10B981)';
                    case 'IN_PROGRESS': return 'var(--warning, #F59E0B)';
                    case 'PAUSED': return 'var(--warning, #F59E0B)';
                    case 'FAILED': return '#EF4444';
                    case 'CANCELLED': return '#94A3B8';
                    default: return 'var(--text-muted)';
                  }
                };
                const stepStatusColor = getStepStatusColor(stepStatus);

                // 1. GENERAL INSTRUCTIONS TAB
                if (viewTab === 'general') {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Specification & Current Progress Step Card Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '1.5rem'
                      }}>
                        {/* Specification Details */}
                        <div style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1.5rem',
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Specification Details
                          </span>
                          <div style={{ 
                            fontSize: '0.9375rem',
                            color: 'var(--text-primary)',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                            fontWeight: 500
                          }}>
                            {selectedWO.specification || (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No specification details provided.</span>
                            )}
                          </div>
                        </div>

                        {/* Current Progress Step */}
                        <div style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1.5rem',
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Current Progress Step
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                fontSize: '0.725rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '100px',
                                backgroundColor: 'rgba(111, 174, 217, 0.15)',
                                color: 'var(--accent-primary)',
                              }}>
                                Step {activeIndex >= 0 ? activeIndex + 1 : 1} of {processes.length || 1}
                              </span>
                            </div>
                            <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                              {activeStepName}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                Technician: <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeTechnician}</strong>
                              </span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                Status: <strong style={{ 
                                  fontWeight: 700, 
                                  color: stepStatusColor
                                }}>{stepStatusLabel}</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Summary Section */}
                      <div>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                          Work Order Summary Details
                        </span>
                        
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
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1.25rem'
                          }}>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Patient</span>
                              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedWO.patient}</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Doctor</span>
                              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedWO.doctor?.name || '—'}</span>
                              {selectedWO.doctor?.clinicName && (
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedWO.doctor.clinicName}</span>
                              )}
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Prosthesis Type</span>
                              <span style={{
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                                color: 'var(--accent-primary)',
                                backgroundColor: 'var(--accent-primary-glow)',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                display: 'inline-block',
                                marginTop: '2px',
                                border: '1px solid var(--border)'
                              }}>{selectedWO.prosthesisType?.name || '—'}</span>
                            </div>
                            {selectedWO.branch && (
                              <div>
                                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Branch</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {selectedWO.branch.name} ({selectedWO.branch.code})
                                </span>
                              </div>
                            )}
                            <div>
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Created On</span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {new Date(selectedWO.createdAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Notes */}
                          {userNotes && (
                            <div style={{
                              borderTop: '1px solid var(--border)',
                              paddingTop: '0.75rem',
                              marginTop: '0.25rem'
                            }}>
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Notes</span>
                              <div style={{ 
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)',
                                whiteSpace: 'pre-wrap',
                                lineHeight: '1.5'
                              }}>
                                {userNotes}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // 2. PROCESS TAB
                if (viewTab === 'process') {
                  const STATIC_STEPS = [
                    { label: 'Created', statusKey: 'CREATED' },
                    { label: 'Assigned', statusKey: 'ASSIGNED' },
                    { label: 'In Progress', statusKey: 'IN_PROGRESS' },
                    { label: 'Internal Verification', statusKey: 'INTERNAL_VERIFICATION' },
                    { label: 'External Verification', statusKey: 'EXTERNAL_VERIFICATION' },
                    { label: 'Completed', statusKey: 'COMPLETED' },
                    { label: 'Failed', statusKey: 'FAILED' },
                    { label: 'Cancelled', statusKey: 'CANCELLED' }
                  ];

                  const statusKeys = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'INTERNAL_VERIFICATION', 'EXTERNAL_VERIFICATION', 'COMPLETED', 'FAILED', 'CANCELLED'];
                  const currentStatusIdx = statusKeys.indexOf(selectedWO.status);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Dynamic Center-Aligned Timeline */}
                      <div style={{
                        backgroundColor: 'var(--bg-overlay, #f1f5f9)',
                        padding: '1.75rem 1.5rem 2rem 1.5rem',
                        borderRadius: '16px',
                        border: '1px solid var(--border)',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                      }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>
                          Workflow Timeline Progress
                        </span>

                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          position: 'relative',
                          width: '100%',
                          margin: '0 auto',
                        }}>
                          {/* Background Line (Center aligned between first and last circles) */}
                          <div style={{
                            position: 'absolute',
                            top: '14.5px',
                            left: 'calc((100% / 8) / 2)',
                            right: 'calc((100% / 8) / 2)',
                            height: '3px',
                            backgroundColor: 'var(--border, #E5E7EB)',
                            zIndex: 1,
                            borderRadius: '2px'
                          }} />
                          
                          {/* Active Line Fill (Starts center of first, ends center of current active) */}
                          {currentStatusIdx > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '14.5px',
                              left: 'calc((100% / 8) / 2)',
                              width: `calc(${currentStatusIdx} * (100% / 8))`,
                              height: '3px',
                              backgroundColor: selectedWO.status === 'FAILED' ? '#EF4444' : selectedWO.status === 'CANCELLED' ? '#94A3B8' : 'var(--accent-primary, #6FAED9)',
                              boxShadow: `0 0 8px ${selectedWO.status === 'FAILED' ? 'rgba(239, 68, 68, 0.4)' : selectedWO.status === 'CANCELLED' ? 'rgba(148, 163, 184, 0.4)' : 'var(--accent-primary-glow)'}`,
                              transition: 'all 0.3s ease',
                              zIndex: 1,
                              borderRadius: '2px'
                            }} />
                          )}

                          {STATIC_STEPS.map((step, idx) => {
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
                                if (selectedWO.status === 'FAILED') {
                                  circleBg = '#EF4444';
                                  circleBorder = '2px solid #EF4444';
                                  circleColor = '#FFFFFF';
                                  symbol = '✕';
                                  circleShadow = '0 0 0 5px rgba(239, 68, 68, 0.2)';
                                } else if (selectedWO.status === 'CANCELLED') {
                                  circleBg = '#94A3B8';
                                  circleBorder = '2px solid #94A3B8';
                                  circleColor = '#FFFFFF';
                                  symbol = '✕';
                                  circleShadow = '0 0 0 5px rgba(148, 163, 184, 0.2)';
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
                                  color: isActive ? (selectedWO.status === 'FAILED' ? '#EF4444' : selectedWO.status === 'CANCELLED' ? '#64748B' : 'var(--accent-primary)') : isHighlighted ? 'var(--text-primary)' : 'var(--text-muted)',
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

                      {/* Detailed Process Grid */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Detailed Process Flow
                          </span>
                          <span style={{
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(111, 174, 217, 0.1)',
                            color: 'var(--accent-primary)',
                            border: '1px solid var(--border)'
                          }}>
                            Total Steps: {processes.length}
                          </span>
                        </div>

                        {processes.length === 0 ? (
                          <div style={{ padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                            No processes to display.
                          </div>
                        ) : (
                          <div style={{
                            overflowX: 'auto',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-surface)'
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

                                  const hasLogs = proc.activityLogs && proc.activityLogs.length > 0;
                                  const isExpanded = expandedAuditRow === proc.id;

                                  return (
                                    <Fragment key={proc.id}>
                                      <tr style={{
                                        borderBottom: idx < processes.length - 1 ? '1px solid var(--border)' : 'none',
                                        backgroundColor: stepStatus === 'IN_PROGRESS' ? 'rgba(111, 174, 217, 0.03)' : 'transparent'
                                      }}>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                                          </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                          {proc.isVerification && !proc.technicianId ? (
                                            <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                              {selectedWO.doctor?.name ? `${selectedWO.doctor.name} (External Doctor)` : 'External Doctor'}
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
                                              <span>{isExpanded ? 'Hide Audit' : `View Audit (${proc.activityLogs?.length})`}</span>
                                            </button>
                                          ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>No activity logs</span>
                                          )}
                                        </td>

                                        <td style={{ padding: '0.75rem 1rem' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
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
                                            {proc.isVerification && isLabAdminOrOwner && (
                                              <>
                                                {stepStatus === 'NOT_STARTED' && (
                                                  (() => {
                                                    const precedingComplete = processes
                                                      .filter((p: any) => p.sequence < proc.sequence)
                                                      .every((p: any) => p.status === 'COMPLETED');
                                                    if (precedingComplete) {
                                                      return (
                                                        <button
                                                          className="btn btn--primary btn--sm"
                                                          style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#8B5CF6', border: 'none', padding: '3px 8px', fontSize: '0.7rem', marginTop: '6px', fontWeight: 600 }}
                                                          onClick={() => handleInlineStartVerification(selectedWO.id, proc.id)}
                                                        >
                                                          <Play size={10} /> Start
                                                        </button>
                                                      );
                                                    }
                                                    return null;
                                                  })()
                                                )}
                                                {(stepStatus === 'IN_PROGRESS' || stepStatus === 'PAUSED') && (
                                                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                                                    <button
                                                      className="btn btn--primary btn--sm"
                                                      style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#10B981', border: 'none', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600 }}
                                                      onClick={() => handleInlineEndVerification(selectedWO.id, proc.id, 'SUCCESS')}
                                                    >
                                                      <Check size={10} /> Approve
                                                    </button>
                                                    <button
                                                      className="btn btn--primary btn--sm"
                                                      style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#EF4444', border: 'none', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600 }}
                                                      onClick={() => handleInlineEndVerification(selectedWO.id, proc.id, 'REWORK')}
                                                    >
                                                      Flag
                                                    </button>
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>

                                      {/* Collapsible Process Audit Log Timeline */}
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
                                              backgroundColor: 'var(--bg-surface)',
                                              boxShadow: 'var(--shadow-sm)'
                                            }}>
                                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Process Activity History &mdash; {proc.processName}
                                              </div>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {[...proc.activityLogs!].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((log: any, lidx: number) => {
                                                  const getActionLabel = (act: string) => {
                                                    switch (act) {
                                                      case 'START': return 'Process Started';
                                                      case 'PAUSE': return 'Process Paused';
                                                      case 'RESUME': return 'Process Resumed';
                                                      case 'END': return 'Process Completed';
                                                      default: return act;
                                                    }
                                                  };

                                                  const getActionColor = (act: string) => {
                                                    switch (act) {
                                                      case 'START': return 'var(--accent-primary, #3B82F6)';
                                                      case 'PAUSE': return 'var(--warning, #F59E0B)';
                                                      case 'RESUME': return 'var(--accent-primary, #3B82F6)';
                                                      case 'END': return 'var(--success, #10B981)';
                                                      default: return 'var(--text-secondary)';
                                                    }
                                                  };

                                                  return (
                                                    <div key={lidx} style={{
                                                      display: 'flex',
                                                      gap: '0.75rem',
                                                      alignItems: 'flex-start'
                                                    }}>
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
                                                              day: 'numeric',
                                                              month: 'short',
                                                              year: 'numeric',
                                                              hour: '2-digit',
                                                              minute: '2-digit'
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
                    </div>
                  );
                }

                // 3. PAYMENT DETAILS TAB (Only ADMIN/OWNER)
                if (viewTab === 'payment') {
                  const quote = selectedWO.totalQuote || 0;
                  const initialPay = selectedWO.initialPayment || 0;
                  const balance = Math.max(0, quote - initialPay);
                  const isPaidComplete = initialPay >= quote;

                  let payStatusLabel = 'Unpaid';
                  let payStatusColor = '#64748B';
                  let payStatusBg = 'rgba(148, 163, 184, 0.08)';

                  if (isPaidComplete) {
                    payStatusLabel = 'Fully Paid';
                    payStatusColor = 'var(--success, #10B981)';
                    payStatusBg = 'var(--success-bg, rgba(16, 185, 129, 0.08))';
                  } else if (initialPay > 0) {
                    payStatusLabel = 'Partially Paid';
                    payStatusColor = 'var(--warning, #F59E0B)';
                    payStatusBg = 'var(--warning-bg, rgba(245, 158, 11, 0.08))';
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Metric summary grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '1.25rem'
                      }}>
                        <div style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Quoted Amount</span>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>${quote.toLocaleString('es-MX')}</span>
                        </div>

                        <div style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Paid</span>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success, #10B981)' }}>${initialPay.toLocaleString('es-MX')}</span>
                        </div>

                        <div style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Balance Due</span>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: balance > 0 ? '#EF4444' : 'var(--text-muted)' }}>${balance.toLocaleString('es-MX')}</span>
                        </div>

                        <div style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          justifyContent: 'center'
                        }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Payment Status</span>
                          <div>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 12px',
                              borderRadius: '100px',
                              fontSize: '0.8125rem',
                              fontWeight: 700,
                              color: payStatusColor,
                              backgroundColor: payStatusBg
                            }}>
                              {payStatusLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Add Payment area */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Payment Transactions
                          </span>
                          {isAdmin && !showAddFundForm && (
                            <button
                              type="button"
                              className="btn btn--outline btn--sm"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', border: '1.5px solid var(--accent-primary)' }}
                              onClick={() => {
                                setShowAddFundForm(true);
                                setAddFundAmount('');
                                setAddFundNotes('');
                              }}
                              disabled={isPaidComplete}
                            >
                              <PlusCircle size={14} />
                              <span>Add Fund</span>
                            </button>
                          )}
                        </div>

                        {/* Add Fund Form Container */}
                        {isAdmin && showAddFundForm && (
                          <div style={{
                            backgroundColor: 'var(--bg-overlay, #F8FAFC)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                          }}>
                            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-heading)' }}>Record New Payment Fund</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', alignItems: 'flex-start' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Amount ($) *</label>
                                <input
                                  type="number"
                                  className="form-input"
                                  placeholder="e.g. 1000"
                                  min="1"
                                  max={balance}
                                  step="0.01"
                                  value={addFundAmount}
                                  onChange={e => setAddFundAmount(e.target.value)}
                                  style={{ height: '36px', fontSize: '0.875rem' }}
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Payment Notes / Remarks</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="e.g. Second installment paid via UPI"
                                  value={addFundNotes}
                                  onChange={e => setAddFundNotes(e.target.value)}
                                  style={{ height: '36px', fontSize: '0.875rem' }}
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => setShowAddFundForm(false)}
                                disabled={submittingPayment}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn--primary btn--sm"
                                style={{ backgroundColor: 'var(--success, #10B981)', borderColor: 'var(--success, #10B981)', color: '#FFFFFF' }}
                                onClick={handleAddFund}
                                disabled={submittingPayment || !addFundAmount}
                              >
                                {submittingPayment ? (
                                  <><Loader2 size={12} className="spinner" /> <span>Adding...</span></>
                                ) : (
                                  <span>Submit Payment</span>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Transaction history log */}
                        <div style={{
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          backgroundColor: 'var(--bg-surface)'
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(111, 174, 217, 0.04)' }}>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date &amp; Time</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Received Amount</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Remarks</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Initial Payment Creation Row */}
                              <tr style={{ borderBottom: payments.length > 0 ? '1px solid var(--border)' : 'none' }}>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                  {new Date(selectedWO.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  ${((selectedWO.initialPayment || 0) - payments.reduce((acc: number, curr: any) => acc + curr.amount, 0)).toLocaleString('es-MX')}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 500, fontStyle: 'italic' }}>
                                  Initial payment registered at order creation
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 8px',
                                    borderRadius: '100px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--success, #10B981)',
                                    backgroundColor: 'var(--success-bg, rgba(16, 185, 129, 0.08))'
                                  }}>
                                    Settled
                                  </span>
                                </td>
                              </tr>

                              {/* Subsequent Added Funds Rows */}
                              {payments.map((payment: any, pidx: number) => (
                                <tr key={pidx} style={{
                                  borderBottom: pidx < payments.length - 1 ? '1px solid var(--border)' : 'none'
                                }}>
                                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                    {new Date(payment.date).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    ${payment.amount.toLocaleString('es-MX')}
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    {payment.notes || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No notes provided</span>}
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '2px 8px',
                                      borderRadius: '100px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      color: 'var(--success, #10B981)',
                                      backgroundColor: 'var(--success-bg, rgba(16, 185, 129, 0.08))'
                                    }}>
                                      Settled
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            <div className="modal__footer" style={{ 
              borderTop: '1px solid var(--border)', 
              padding: '1.25rem 1.5rem', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              backgroundColor: 'var(--bg-overlay, #F8FAFC)',
              borderBottomLeftRadius: 'var(--radius-xl, 20px)',
              borderBottomRightRadius: 'var(--radius-xl, 20px)',
              gap: '0.75rem'
            }}>
              <button
                type="button"
                className="btn"
                style={{
                  backgroundColor: 'var(--accent-primary, #6FAED9)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  padding: '0.5rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s ease'
                }}
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, useSocket } from '../context';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import {
  X,
  Loader2,
  History,
  Play,
  Check,
  PlusCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Pause,
  CheckCircle2,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workOrderService, paymentMethodService, type PaymentMethodItem } from '../services';
import { useAppDate } from '../hooks';
import { NoteHistoryThread } from './NoteHistoryThread';
import { WorkOrderChat } from './WorkOrderChat';
import { formatAuditNote, formatDuration, extractDurationFromNote } from '../utils/audit-formatter';
import { RoleBadge } from './RoleBadge';

interface PaymentHistoryItem {
  id?: string;
  amount: number;
  paymentMethod?: string;
  notes: string;
  date: string;
  registeredBy?: string;
}

interface ViewWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string | null;
  onUpdate?: (updatedWO?: any) => void;
  initialTab?: 'general' | 'process' | 'rework' | 'repetition' | 'payment' | 'chat';
}

const parseNotesAndPayments = (notesString: string | null | undefined): { userNotes: string; payments: PaymentHistoryItem[] } => {
  if (!notesString) return { userNotes: '', payments: [] };
  const marker = '<!-- PAYMENTS_START -->';
  const endMarker = '<!-- PAYMENTS_END -->';
  const startIndex = notesString.indexOf(marker);
  const endIndex = notesString.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1) {
    const userNotes = notesString.substring(0, startIndex).trim();
    const jsonStr = notesString.substring(startIndex + marker.length, endIndex).trim();
    let payments: PaymentHistoryItem[] = [];
    try {
      payments = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse payment history JSON from notes', e);
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
      // Verification processes do not pause; normalize any historical PAUSE to END
      const isVerification = proc.isVerification;
      const normalizedAction = isVerification && log.action === 'PAUSE' ? 'END' : log.action;
      logs.push({
        id: log.id,
        action: normalizedAction,
        timestamp: log.timestamp,
        notes: log.notes,
      });
    });
  }

  // 2. Add ReworkLog logs for this process step (both if it was reworked OR if this verification step triggered the rework)
  if (workOrder && workOrder.reworkLogs) {
    workOrder.reworkLogs.forEach((log: any) => {
      const initiatorName = `${log.initiatedBy?.firstName || 'Admin'} ${log.initiatedBy?.lastName || ''}`.trim();

      // Check if this step was the one being reworked (production process)
      if (log.processName === proc.processName) {
        logs.push({
          id: `rework-init-${log.id}`,
          action: 'REWORK_TRIGGERED',
          timestamp: log.initiatedAt,
          notes: `Rework cycle #${log.reworkCount} triggered by ${initiatorName} at verification step "${log.verificationStage}".${log.reworkReason ? ` Reason: ${log.reworkReason}` : ''}`,
        });

        if (log.completedAt) {
          logs.push({
            id: `rework-comp-${log.id}`,
            action: 'REWORK_COMPLETED',
            timestamp: log.completedAt,
            notes: `Rework cycle #${log.reworkCount} completed.`,
          });
        }

        if (log.approvedAt) {
          logs.push({
            id: `rework-appr-${log.id}`,
            action: 'REWORK_APPROVED',
            timestamp: log.approvedAt,
            notes: `Rework cycle #${log.reworkCount} approved.`,
          });
        }
      }

      // Check if this step was the verification step that triggered the rework
      if (proc.isVerification && log.verificationStage === proc.processName) {
        logs.push({
          id: `rework-trig-${log.id}`,
          action: 'REWORK_TRIGGERED',
          timestamp: log.initiatedAt,
          notes: `Rework cycle #${log.reworkCount} triggered by ${initiatorName} for step "${log.processName}".${log.reworkReason ? ` Reason: ${log.reworkReason}` : ''}`,
        });
      }
    });
  }

  // 3. Add RepetitionLog logs where this process was affected
  if (workOrder && workOrder.repetitionLogs) {
    workOrder.repetitionLogs.forEach((log: any) => {
      const initiatorName = `${log.initiatedBy?.firstName || 'Admin'} ${log.initiatedBy?.lastName || ''}`.trim();

      // Check if this step was reset due to this repetition (production process)
      const wasReset = log.completedSteps && log.completedSteps.split(', ').map((s: string) => s.trim()).includes(proc.processName);
      if (wasReset) {
        logs.push({
          id: `rep-reset-${log.id}`,
          action: 'REPETITION_TRIGGERED',
          timestamp: log.initiatedAt,
          notes: `Repetition cycle #${log.repetitionCount} triggered by ${initiatorName} at step "${log.verificationStage}". This step was reset to NOT_STARTED.`,
        });
      }

      // Check if this step was the one that triggered the repetition (verification process)
      if (proc.isVerification && log.verificationStage === proc.processName) {
        logs.push({
          id: `rep-trig-${log.id}`,
          action: 'REPETITION_TRIGGERED',
          timestamp: log.initiatedAt,
          notes: `Repetition cycle #${log.repetitionCount} triggered by ${initiatorName}. All preceding completed steps have been reset.`,
        });
      }
    });
  }

  // Sort logs by timestamp descending
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export function ViewWorkOrderModal({ isOpen, onClose, workOrderId, onUpdate, initialTab = 'general' }: ViewWorkOrderModalProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { formatDateTime: appFormatDateTime, formatDate: appFormatDate } = useAppDate();
  const { socket, isConnected } = useSocket();
  const isAdmin = user?.role === 'ADMIN';
  const isLabAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';

  const [selectedWO, setSelectedWO] = useState<any>(null);

  const sortedProcs = useMemo(() => {
    return [...(selectedWO?.processes || [])].sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0));
  }, [selectedWO?.processes]);

  const isCompleted = useMemo(() => {
    if (!selectedWO) return false;
    if (selectedWO.status === 'COMPLETED') return true;
    return sortedProcs.length > 0 && sortedProcs.every((p: any) => p.status === 'COMPLETED');
  }, [selectedWO?.status, sortedProcs]);

  const completionDate = useMemo(() => {
    if (!isCompleted || !selectedWO) return null;
    const finalProc = sortedProcs.length > 0 ? sortedProcs[sortedProcs.length - 1] : null;
    return finalProc?.endedAt || selectedWO.updatedAt;
  }, [isCompleted, sortedProcs, selectedWO]);
  const [loading, setLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'general' | 'process' | 'rework' | 'repetition' | 'payment' | 'chat'>(initialTab || 'general');

  useEffect(() => {
    if (user?.role === 'OWNER' && viewTab === 'chat') {
      setViewTab('general');
    }
  }, [user?.role, viewTab]);
  const [showAddFundForm, setShowAddFundForm] = useState(false);
  const [addFundAmount, setAddFundAmount] = useState('');
  const [addFundNotes, setAddFundNotes] = useState('');
  const [addFundPaymentMethod, setAddFundPaymentMethod] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [expandedAuditRow, setExpandedAuditRow] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  const fetchWorkOrderDetails = useCallback(async () => {
    if (!workOrderId) return;
    try {
      const data = await workOrderService.getById(workOrderId);
      setSelectedWO(data);
    } catch (err) {
      console.error('Failed to reload work order details silently', err);
    }
  }, [workOrderId]);

  const handleAddNote = async (content: string) => {
    if (!selectedWO) return;
    const newNote = await workOrderService.addNote(selectedWO.id, content);
    setSelectedWO((prev: any) =>
      prev
        ? {
            ...prev,
            notesList: [...(prev.notesList || []), newNote],
          }
        : null
    );
    if (onUpdate) onUpdate();
  };

  const handleUpdateNote = async (noteId: string, content: string) => {
    if (!selectedWO) return;
    const updated = await workOrderService.updateNote(selectedWO.id, noteId, content);
    setSelectedWO((prev: any) =>
      prev
        ? {
            ...prev,
            notesList: (prev.notesList || []).map((n: any) =>
              n.id === noteId ? updated : n
            ),
          }
        : null
    );
    if (onUpdate) onUpdate();
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedWO) return;
    await workOrderService.deleteNote(selectedWO.id, noteId);
    setSelectedWO((prev: any) =>
      prev
        ? {
            ...prev,
            notesList: (prev.notesList || []).filter((n: any) => n.id !== noteId),
          }
        : null
    );
    if (onUpdate) onUpdate();
  };

  useEffect(() => {
    if (isOpen && workOrderId) {
      setLoading(true);
      setViewTab(initialTab || 'general');
      setShowAddFundForm(false);
      setAddFundAmount('');
      setAddFundNotes('');
      setExpandedAuditRow(null);

      Promise.all([
        workOrderService.getById(workOrderId),
        paymentMethodService.getAll(true).catch(() => []),
      ])
        .then(([data, methods]) => {
          setSelectedWO(data);
          setPaymentMethods(methods);
          if (methods.length > 0) {
            setAddFundPaymentMethod(methods[0].name);
          } else {
            setAddFundPaymentMethod('Cash');
          }
        })
        .catch((err) => {
          console.error('Failed to load work order details', err);
          toast.error(t('workOrders.failedLoad'));
          onClose();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setSelectedWO(null);
    }
  }, [isOpen, workOrderId, initialTab, onClose, t]);

  useEffect(() => {
    if (!socket || !workOrderId || !isOpen) return;

    const handleSocketUpdate = (payload?: { id?: string }) => {
      if (!payload || !payload.id || payload.id === workOrderId) {
        fetchWorkOrderDetails();
      }
    };

    socket.on('work_order_updated', handleSocketUpdate);
    socket.on('work_order_created', handleSocketUpdate);

    return () => {
      socket.off('work_order_updated', handleSocketUpdate);
      socket.off('work_order_created', handleSocketUpdate);
    };
  }, [socket, workOrderId, isOpen, fetchWorkOrderDetails]);

  const prevConnectedRef = useRef(isConnected);
  useEffect(() => {
    if (!prevConnectedRef.current && isConnected && isOpen && workOrderId) {
      fetchWorkOrderDetails();
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, isOpen, workOrderId, fetchWorkOrderDetails]);

  if (!isOpen || !workOrderId) return null;

  const handleInlineStartVerification = async (woId: string, processId: string) => {
    const loadingToast = toast.loading(t('dashboard.startingVerification'));
    try {
      await workOrderService.startVerification(woId, processId);
      toast.success(t('dashboard.verificationStarted'), { id: loadingToast });
      const detailedWo = await workOrderService.getById(woId);
      setSelectedWO(detailedWo);
      if (onUpdate) onUpdate(detailedWo);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || t('dashboard.verificationFailed');
      toast.error(errMsg, { id: loadingToast });
    }
  };

  const handleInlineEndVerification = async (woId: string, processId: string, outcome: 'SUCCESS' | 'REWORK' | 'REPETITION') => {
    if (outcome === 'REWORK') {
      onClose();
      navigate('/work-orders', {
        state: {
          editWorkOrderId: woId,
          activeTab: 'processes',
          isReworkFlow: true,
          reworkVerificationProcessId: processId,
        },
      });
      return;
    }

    const loadingToast = toast.loading(t('dashboard.completingVerification', { outcome: t('enums.verificationOutcome.' + outcome) }));
    try {
      await workOrderService.endVerification(woId, processId, outcome);
      toast.success(t('dashboard.verificationCompleted', { outcome: t('enums.verificationOutcome.' + outcome) }), { id: loadingToast });
      const detailedWo = await workOrderService.getById(woId);
      setSelectedWO(detailedWo);
      if (onUpdate) onUpdate(detailedWo);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || t('dashboard.verificationCompleteFailed');
      toast.error(errMsg, { id: loadingToast });
    }
  };

  const handleInlineProcessAction = async (
    woId: string,
    processId: string,
    action: 'start' | 'pause' | 'resume' | 'end'
  ) => {
    let actionLoadingKey = 'startingProcess';
    if (action === 'pause') actionLoadingKey = 'pausingProcess';
    else if (action === 'resume') actionLoadingKey = 'resumingProcess';
    else if (action === 'end') actionLoadingKey = 'endingProcess';

    const loadingToast = toast.loading(t(`techDashboard.${actionLoadingKey}`, { defaultValue: 'Processing...' }));
    try {
      if (action === 'start') {
        await workOrderService.startProcess(woId, processId);
        toast.success(t('techDashboard.processStarted', { defaultValue: 'Process started!' }), { id: loadingToast });
      } else if (action === 'pause') {
        await workOrderService.pauseProcess(woId, processId);
        toast.success(t('techDashboard.processPaused', { defaultValue: 'Process paused!' }), { id: loadingToast });
      } else if (action === 'resume') {
        await workOrderService.resumeProcess(woId, processId);
        toast.success(t('techDashboard.processResumed', { defaultValue: 'Process resumed!' }), { id: loadingToast });
      } else if (action === 'end') {
        await workOrderService.endProcess(woId, processId);
        toast.success(t('techDashboard.processEnded', { defaultValue: 'Process completed!' }), { id: loadingToast });
      }
      const detailedWo = await workOrderService.getById(woId);
      setSelectedWO(detailedWo);
      if (onUpdate) onUpdate(detailedWo);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || t('techDashboard.processActionFailed', { action, defaultValue: 'Action failed' });
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
      toast.error(t('financePage.invalidAmount'));
      return;
    }
    if (amount > balance) {
      toast.error(t('financePage.amountExceedsBalance', { balance: balance.toLocaleString('es-MX') }));
      return;
    }

    try {
      setSubmittingPayment(true);
      const newPayments: PaymentHistoryItem[] = [
        ...payments,
        {
          id: `pay-${Date.now()}`,
          amount,
          paymentMethod: addFundPaymentMethod || (paymentMethods[0]?.name || 'Cash'),
          notes: addFundNotes.trim(),
          date: new Date().toISOString(),
          registeredBy: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined,
        }
      ];

      const serializedNotes = stringifyNotesAndPayments(userNotes, newPayments);

      const updatedWO = await workOrderService.update(selectedWO.id, {
        initialPayment: initialPay + amount,
        notes: serializedNotes
      });

      toast.success(t('financePage.fundAdded'));
      setSelectedWO(updatedWO);
      if (onUpdate) onUpdate(updatedWO);
      
      setAddFundAmount('');
      setAddFundNotes('');
      setAddFundPaymentMethod(paymentMethods[0]?.name || 'Cash');
      setShowAddFundForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('financePage.addPaymentFailed'));
    } finally {
      setSubmittingPayment(false);
    }
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: '1020px', width: '95%', height: 'auto', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
        {loading || !selectedWO ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '12px' }}>
            <Loader2 size={36} className="spinner" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('common.loading')}</span>
          </div>
        ) : (
          <>
            <div className="modal__header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', margin: 0, fontWeight: 800, fontSize: '1.25rem' }}>
                  <span>WO#: {selectedWO.folioNumber}</span>
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
                      {t('workOrders.boxNumber', { defaultValue: 'Box' })}: {selectedWO.boxNumber}
                    </span>
                  )}
                </h2>

                {isCompleted && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      backgroundColor: 'var(--success-bg, rgba(16, 185, 129, 0.1))',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        color: 'var(--success, #10B981)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      <CheckCircle2 size={14} />
                      {t('enums.workOrderStatus.COMPLETED', { defaultValue: 'Completed' })}
                    </span>
                    {completionDate && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary, #6B7280)',
                          fontWeight: 500,
                          borderLeft: '1px solid rgba(16, 185, 129, 0.3)',
                          paddingLeft: '0.4rem',
                        }}
                      >
                        {appFormatDate(completionDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                className="modal__close"
                onClick={onClose}
                aria-label={t('common.close')}
                style={{ position: 'static', margin: 0, flexShrink: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs navigation */}
            <div style={{ padding: '0 1rem', marginTop: '0.75rem', borderBottom: '1px solid var(--border)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div className="modal-tabs" style={{ display: 'flex', gap: '1rem', minWidth: 'max-content' }}>
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
                  {t('workOrders.generalTab', { defaultValue: t('workOrders.general', { defaultValue: 'General' }) })}
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
                  {t('workOrders.processes')}
                </button>
                {user?.role !== 'TECHNICIAN' && (selectedWO.reworkLogs?.length || 0) > 0 && (
                  <button
                    type="button"
                    className={`modal-tab-btn ${viewTab === 'rework' ? 'modal-tab-btn--active' : ''}`}
                    onClick={() => setViewTab('rework')}
                    style={{
                      padding: '0.75rem 0.5rem',
                      fontWeight: 600,
                      border: 'none',
                      borderBottom: viewTab === 'rework' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      color: viewTab === 'rework' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    {t('dashboard.reworks')}
                  </button>
                )}
                {user?.role !== 'TECHNICIAN' && (selectedWO.repetitionLogs?.length || 0) > 0 && (
                  <button
                    type="button"
                    className={`modal-tab-btn ${viewTab === 'repetition' ? 'modal-tab-btn--active' : ''}`}
                    onClick={() => setViewTab('repetition')}
                    style={{
                      padding: '0.75rem 0.5rem',
                      fontWeight: 600,
                      border: 'none',
                      borderBottom: viewTab === 'repetition' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      color: viewTab === 'repetition' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    {t('dashboard.repetitions')}
                  </button>
                )}
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
                    {t('financePage.paymentHistory')}
                  </button>
                )}
                {user?.role !== 'OWNER' && (
                  <button
                    type="button"
                    className={`modal-tab-btn ${viewTab === 'chat' ? 'modal-tab-btn--active' : ''}`}
                    onClick={() => setViewTab('chat')}
                    style={{
                      padding: '0.75rem 0.5rem',
                      fontWeight: 600,
                      border: 'none',
                      borderBottom: viewTab === 'chat' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      color: viewTab === 'chat' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    {t('workOrders.chatTab', { defaultValue: 'Chat' })}
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
                const sortedProcs = [...processes].sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0));
                const { userNotes, payments } = parseNotesAndPayments(selectedWO.notes);
                
                // Determine active process step index directly from processes list sorted by sequence
                let activeIndex = 0;
                if (selectedWO.status === 'COMPLETED' || (sortedProcs.length > 0 && sortedProcs.every((p: any) => p.status === 'COMPLETED'))) {
                  activeIndex = sortedProcs.length;
                } else if (selectedWO.status === 'FAILED' || selectedWO.status === 'CANCELLED') {
                  activeIndex = -1;
                } else {
                  // 1. Check if any process is actively IN_PROGRESS or PAUSED
                  const ipIdx = sortedProcs.findIndex((p: any) => p.status === 'IN_PROGRESS' || p.status === 'PAUSED');
                  if (ipIdx !== -1) {
                    activeIndex = ipIdx;
                  } else {
                    // 2. Otherwise find the first process in sequence that is NOT COMPLETED
                    const pendingIdx = sortedProcs.findIndex((p: any) => p.status !== 'COMPLETED' && p.status !== 'FAILED' && p.status !== 'CANCELLED');
                    if (pendingIdx !== -1) {
                      activeIndex = pendingIdx;
                    } else {
                      activeIndex = sortedProcs.length > 0 ? 0 : -1;
                    }
                  }
                }

                // Determine active/in-progress step or fallback to first step details
                const hasActiveProcess = activeIndex >= 0 && activeIndex < sortedProcs.length;
                const displayProc = hasActiveProcess ? sortedProcs[activeIndex] : sortedProcs[0];

                const activeStepName = displayProc?.processName || t('workOrders.noProcesses');
                const activeTechnician = displayProc?.technician 
                  ? `${displayProc.technician.firstName} ${displayProc.technician.lastName}` 
                  : ((displayProc?.isVerification ? !displayProc?.technicianId : (displayProc?.processName?.toLowerCase().includes('external') || (!displayProc?.technicianId && displayProc?.processName?.toLowerCase().includes('verification')))) 
                      ? (selectedWO.doctor?.name 
                          ? (selectedWO.doctor.clinicName 
                              ? `${selectedWO.doctor.name} (${selectedWO.doctor.clinicName})` 
                              : selectedWO.doctor.name) 
                          : t('dashboard.unassigned')) 
                      : t('dashboard.unassigned'));

                const stepStatus = displayProc?.status || 'NOT_STARTED';
                const getStepStatusLabel = (status?: string) => {
                  if (!status) return t('enums.processStatus.NOT_STARTED');
                  switch (status) {
                    case 'COMPLETED': return t('enums.processStatus.COMPLETED');
                    case 'IN_PROGRESS': return t('enums.processStatus.IN_PROGRESS');
                    case 'PAUSED': return t('enums.processStatus.PAUSED');
                    case 'FAILED': return t('enums.processStatus.FAILED');
                    case 'CANCELLED': return t('enums.processStatus.CANCELLED');
                    default: return t('enums.processStatus.NOT_STARTED');
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
                            {t('workOrders.specifications')}
                          </span>
                          <div style={{ 
                            fontSize: '0.9375rem',
                            color: 'var(--text-primary)',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                            fontWeight: 500
                          }}>
                            {selectedWO.specification || (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('workOrders.noSpecifications')}</span>
                            )}
                          </div>
                        </div>

                        {/* Color Details */}
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
                            {t('workOrders.shade')}
                          </span>
                          <div style={{ 
                            fontSize: '0.9375rem',
                            color: 'var(--text-primary)',
                            lineHeight: '1.6',
                            fontWeight: 700
                          }}>
                            {selectedWO.color}
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
                            {t('workOrders.currentProgressStep')}
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
                                {t('workOrders.stepOf', { current: activeIndex >= 0 ? activeIndex + 1 : 1, total: processes.length || 1 })}
                              </span>
                            </div>
                            <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                              {activeStepName}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {t('workOrders.assignedTechnician')}: <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeTechnician}</strong>
                              </span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {t('common.status')}: <strong style={{ 
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
                          {t('workOrders.summaryDetails')}
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
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.patient')}</span>
                              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {selectedWO.patient || t('workOrders.unnamedPatient', { defaultValue: 'Unnamed Patient' })}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.doctor')}</span>
                              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedWO.doctor?.name || '—'}</span>
                              {selectedWO.doctor?.clinicName && (
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedWO.doctor.clinicName}</span>
                              )}
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.prosthesisType')}</span>
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
                            <div>
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.shade')}</span>
                              <span style={{
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                display: 'inline-block',
                                marginTop: '2px'
                              }}>{selectedWO.color}</span>
                            </div>
                            {selectedWO.deliveryDate && (
                              <div>
                                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.deliveryDate', { defaultValue: 'Delivery Date' })}</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {formatDate(selectedWO.deliveryDate, i18n.language, user?.timezone, { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                            )}
                            {selectedWO.fileNumber && (
                              <div>
                                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.fileNumber', { defaultValue: 'File Number' })}</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedWO.fileNumber}</span>
                              </div>
                            )}
                            {selectedWO.branch && (
                              <div>
                                <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('common.branch')}</span>
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {selectedWO.branch.name} ({selectedWO.branch.code})
                                </span>
                              </div>
                            )}
                            <div>
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.createdAt')}</span>
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {formatDate(selectedWO.createdAt, i18n.language, user?.timezone, {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            {(() => {
                              const refs = selectedWO.paymentReferenceNumbers && selectedWO.paymentReferenceNumbers.length > 0
                                ? selectedWO.paymentReferenceNumbers
                                : (selectedWO.paymentReferenceNumber ? [selectedWO.paymentReferenceNumber] : []);
                              if (refs.length === 0) return null;
                              return (
                                <div>
                                  <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.paymentReferenceNumbers', { defaultValue: 'Payment Reference Numbers' })}</span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
                                    {refs.map((r: string, i: number) => (
                                      <span key={i} style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'var(--bg-overlay, #f1f5f9)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '12px' }}>{r}</span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Collapsible Notes Section */}
                          <div style={{
                            borderTop: '1px solid var(--border)',
                            paddingTop: '0.75rem',
                            marginTop: '0.75rem'
                          }}>
                            <button
                              type="button"
                              onClick={() => setIsNotesExpanded(prev => !prev)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                background: 'none',
                                border: 'none',
                                padding: '0.375rem 0',
                                cursor: 'pointer',
                                color: 'var(--text-heading)',
                                fontWeight: 700,
                                fontSize: '0.875rem'
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={16} />
                                <span>{t('workOrders.notesHistory', { defaultValue: 'Notes & Thread' })}</span>
                                {(selectedWO.notesList?.length || userNotes) ? (
                                  <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', padding: '1px 6px', borderRadius: '10px' }}>
                                    {(selectedWO.notesList?.length || 0) + (userNotes ? 1 : 0)}
                                  </span>
                                ) : null}
                              </span>
                              {isNotesExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {isNotesExpanded && (
                              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {userNotes && (
                                  <div style={{
                                    backgroundColor: 'var(--bg-overlay, #f8fafc)',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)'
                                  }}>
                                    <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                      {t('workOrders.adminNotes', { defaultValue: 'Admin Notes' })}
                                    </span>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                      {userNotes}
                                    </div>
                                  </div>
                                )}

                                <NoteHistoryThread
                                  notesList={selectedWO.notesList || []}
                                  currentUserId={user?.id || ''}
                                  userRole={user?.role || ''}
                                  onAddNote={handleAddNote}
                                  onUpdateNote={handleUpdateNote}
                                  onDeleteNote={handleDeleteNote}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }                // 2. PROCESS TAB
                if (viewTab === 'process') {
                  // Determine active stepper index dynamically based on 6 stages
                  let finalStepKey = 'COMPLETED';
                  if (selectedWO.status === 'FAILED') {
                    finalStepKey = 'FAILED';
                  } else if (selectedWO.status === 'CANCELLED') {
                    finalStepKey = 'CANCELLED';
                  }

                  const steps = [
                    { label: t('enums.workOrderStatus.CREATED'), statusKey: 'CREATED' },
                    { label: t('enums.workOrderStatus.ASSIGNED'), statusKey: 'ASSIGNED' },
                    { label: t('enums.workOrderStatus.IN_PROGRESS'), statusKey: 'IN_PROGRESS' },
                    { label: t('enums.workOrderStatus.INTERNAL_VERIFICATION'), statusKey: 'INTERNAL_VERIFICATION' },
                    { label: t('enums.workOrderStatus.EXTERNAL_VERIFICATION'), statusKey: 'EXTERNAL_VERIFICATION' },
                    { label: t(`enums.workOrderStatus.${finalStepKey}`), statusKey: finalStepKey }
                  ];

                  const currentStatusIdx = steps.findIndex(s => s.statusKey === selectedWO.status);

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
                          {t('workOrders.timeline')}
                        </span>

                        <div style={{
                          overflowX: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          paddingBottom: '0.25rem'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            position: 'relative',
                            width: '100%',
                            minWidth: '540px',
                            margin: '0 auto',
                          }}>
                          {/* Background Line (Center aligned between first and last circles) */}
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
                          
                          {/* Active Line Fill (Starts center of first, ends center of current active) */}
                          {currentStatusIdx > 0 && (
                            <div style={{
                              position: 'absolute',
                              top: '14.5px',
                              left: 'calc((100% / 6) / 2)',
                              width: `calc(${currentStatusIdx} * (100% / 6))`,
                              height: '3px',
                              backgroundColor: selectedWO.status === 'COMPLETED' ? 'var(--success, #10B981)' : selectedWO.status === 'FAILED' ? '#EF4444' : selectedWO.status === 'CANCELLED' ? '#F97316' : 'var(--accent-primary, #6FAED9)',
                              boxShadow: `0 0 8px ${selectedWO.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.4)' : selectedWO.status === 'FAILED' ? 'rgba(239, 68, 68, 0.4)' : selectedWO.status === 'CANCELLED' ? 'rgba(249, 115, 22, 0.4)' : 'var(--accent-primary-glow)'}`,
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
                                if (selectedWO.status === 'COMPLETED') {
                                  circleBg = 'var(--success, #10B981)';
                                  circleBorder = '2px solid var(--success, #10B981)';
                                  circleColor = '#FFFFFF';
                                  symbol = '✓';
                                  circleShadow = '0 0 0 5px rgba(16, 185, 129, 0.2)';
                                } else if (selectedWO.status === 'FAILED') {
                                  circleBg = '#EF4444';
                                  circleBorder = '2px solid #EF4444';
                                  circleColor = '#FFFFFF';
                                  symbol = '✕';
                                  circleShadow = '0 0 0 5px rgba(239, 68, 68, 0.2)';
                                } else if (selectedWO.status === 'CANCELLED') {
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
                              <div key={step.statusKey} style={{
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
                                  color: isActive ? (selectedWO.status === 'COMPLETED' ? 'var(--success, #10B981)' : selectedWO.status === 'FAILED' ? '#EF4444' : selectedWO.status === 'CANCELLED' ? '#F97316' : 'var(--accent-primary)') : isHighlighted ? 'var(--text-primary)' : 'var(--text-muted)',
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
                      </div>

                      {/* Total Completed Work Time Metric Section */}
                      {(() => {
                        const completedProcs = (selectedWO.processes || []).filter(
                          (p: any) => p.status === 'COMPLETED' || (p.totalActiveDuration && p.totalActiveDuration > 0)
                        );
                        const totalCompletedSeconds = (selectedWO.processes || []).reduce(
                          (acc: number, p: any) => acc + (p.totalActiveDuration || 0),
                          0
                        );
                        const hours = Math.floor(totalCompletedSeconds / 3600);
                        const mins = Math.floor((totalCompletedSeconds % 3600) / 60);
                        const timeText = hours > 0
                          ? `${hours} ${t('common.hours', { defaultValue: 'hrs' })} ${mins} ${t('common.mins', { defaultValue: 'min' })}`
                          : `${mins} ${t('common.mins', { defaultValue: 'min' })}`;

                        return (
                          <div style={{
                            backgroundColor: 'var(--bg-surface, #FFFFFF)',
                            padding: '1.25rem 1.5rem',
                            borderRadius: '16px',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                              <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                color: '#10B981',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Clock size={22} />
                              </div>
                              <div>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  {t('workOrders.totalCompletedWorkTime')}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {t('workOrders.completedWorkTimeDesc')} ({completedProcs.length} {completedProcs.length === 1 ? t('common.completedSingular', { defaultValue: 'completed' }) : t('common.completedPlural', { defaultValue: 'completed' })})
                                </span>
                              </div>
                            </div>
                            <div style={{
                              fontSize: '1.25rem',
                              fontWeight: 800,
                              color: '#10B981',
                              backgroundColor: 'rgba(16, 185, 129, 0.08)',
                              padding: '0.5rem 1rem',
                              borderRadius: '10px',
                              border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                              {timeText}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Detailed Process Grid */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('workOrders.processes')}
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
                            {t('workOrders.totalProcesses', { defaultValue: 'Total processes' })}: {processes.length}
                          </span>
                        </div>

                        {processes.length === 0 ? (
                          <div style={{ padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                            {t('workOrders.noProcesses')}
                          </div>
                        ) : (
                          <div style={{
                            overflowX: 'auto',
                            WebkitOverflowScrolling: 'touch',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-surface)',
                            width: '100%'
                          }}>
                            <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(111, 174, 217, 0.04)' }}>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('common.step')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.processName')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.assignedTechnician')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('common.startTime')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('common.endTime')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.workTime', { defaultValue: 'Work Time' })}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('common.timeAudit')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('common.status')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {processes.map((proc: any, idx: number) => {
                                  const stepStatus = proc.status || 'NOT_STARTED';

                                  const formatStepTime = (dateStr: string | Date) => {
                                    return formatDateTime(dateStr, i18n.language, user?.timezone, {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    });
                                  };

                                  let startTimeStr = proc.startedAt ? formatStepTime(proc.startedAt) : '—';
                                  let endTimeStr = proc.endedAt ? formatStepTime(proc.endedAt) : (stepStatus === 'IN_PROGRESS' ? t('common.running') : stepStatus === 'PAUSED' ? t('enums.processStatus.PAUSED') : '—');
                                  
                                  let badgeColor = 'var(--text-muted, #64748B)';
                                  let badgeBg = 'var(--bg-overlay, rgba(148, 163, 184, 0.08))';
                                  let statusLabel = t('enums.processStatus.NOT_STARTED');

                                  if (stepStatus === 'COMPLETED') {
                                    badgeColor = 'var(--success, #10B981)';
                                    badgeBg = 'var(--success-bg, rgba(16, 185, 129, 0.08))';
                                    statusLabel = t('enums.processStatus.COMPLETED');
                                  } else if (stepStatus === 'IN_PROGRESS') {
                                    badgeColor = 'var(--warning, #F59E0B)';
                                    badgeBg = 'var(--warning-bg, rgba(245, 158, 11, 0.08))';
                                    statusLabel = t('enums.processStatus.IN_PROGRESS');
                                  } else if (stepStatus === 'PAUSED') {
                                    badgeColor = 'var(--warning, #F59E0B)';
                                    badgeBg = 'var(--warning-bg, rgba(245, 158, 11, 0.08))';
                                    statusLabel = t('enums.processStatus.PAUSED');
                                  } else if (stepStatus === 'FAILED') {
                                    badgeColor = '#EF4444';
                                    badgeBg = 'rgba(239, 68, 68, 0.08)';
                                    statusLabel = t('enums.processStatus.FAILED');
                                  } else if (stepStatus === 'CANCELLED') {
                                    badgeColor = '#94A3B8';
                                    badgeBg = 'rgba(148, 163, 184, 0.08)';
                                    statusLabel = t('enums.processStatus.CANCELLED');
                                  }

                                  const combinedLogs = getCombinedProcessLogs(proc, selectedWO);
                                  const hasLogs = combinedLogs.length > 0;
                                  const isExpanded = expandedAuditRow === proc.id;

                                  const isExternal =
                                    proc.processType === 'EXTERNAL_VERIFICATION' ||
                                    (proc.isVerification && (!proc.technicianId || proc.technicianId === selectedWO?.doctorId)) ||
                                    proc.processName?.toLowerCase().includes('external');

                                  const isInternal =
                                    !isExternal &&
                                    (proc.processType === 'INTERNAL_VERIFICATION' ||
                                     proc.isVerification ||
                                     proc.processName?.toLowerCase().includes('internal') ||
                                     proc.processName?.toLowerCase().includes('verification'));

                                  const repetitionsForStep = (selectedWO?.repetitionLogs || []).filter((r: any) =>
                                    r.verificationStage === proc.processName ||
                                    (r.completedSteps && r.completedSteps.split(', ').map((s: string) => s.trim()).includes(proc.processName))
                                  );

                                  return (
                                    <Fragment key={proc.id}>
                                      <tr style={{
                                        borderBottom: idx < processes.length - 1 ? '1px solid var(--border)' : 'none',
                                        borderLeft: isExternal
                                          ? '4px solid #10B981'
                                          : isInternal
                                            ? '4px solid #7C3AED'
                                            : '4px solid transparent',
                                        backgroundColor: isExternal
                                          ? 'rgba(16, 185, 129, 0.04)'
                                          : isInternal
                                            ? 'rgba(124, 58, 237, 0.04)'
                                            : stepStatus === 'IN_PROGRESS'
                                              ? 'rgba(111, 174, 217, 0.03)'
                                              : 'transparent',
                                      }}>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{idx + 1}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '180px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span>{proc.processName}</span>
                                            {isInternal && (
                                              <span style={{
                                                fontSize: '0.625rem',
                                                fontWeight: 700,
                                                padding: '1px 6px',
                                                borderRadius: '4px',
                                                backgroundColor: '#F5F3FF',
                                                color: '#7C3AED',
                                                border: '1px solid #DDD6FE',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                              }}>
                                                <ShieldCheck size={10} />
                                                {t('enums.processType.INTERNAL_VERIFICATION', { defaultValue: 'Internal Verification' })}
                                              </span>
                                            )}
                                            {isExternal && (
                                              <span style={{
                                                fontSize: '0.625rem',
                                                fontWeight: 700,
                                                padding: '1px 6px',
                                                borderRadius: '4px',
                                                backgroundColor: '#ECFDF5',
                                                color: '#059669',
                                                border: '1px solid #A7F3D0',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                              }}>
                                                <Stethoscope size={10} />
                                                {t('enums.processType.EXTERNAL_VERIFICATION', { defaultValue: 'External Verification' })}
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
                                                {t('common.reworkActive')}
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
                                                {t('common.reworked')} ({proc.reworkCount})
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
                                              }} title={t('common.stepRepeatedInCycles', { count: repetitionsForStep.length })}>
                                                {t('common.repeated')} ({repetitionsForStep.length})
                                              </span>
                                            )}
                                            {proc.externalDoctorStatus && (
                                              <span style={{
                                                fontSize: '0.625rem',
                                                fontWeight: 700,
                                                padding: '1px 5px',
                                                borderRadius: '4px',
                                                backgroundColor: proc.externalDoctorStatus === 'SUCCESS' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                                color: proc.externalDoctorStatus === 'SUCCESS' ? '#10B981' : '#EF4444'
                                              }}>
                                                {t('dashboard.doctorStatus')}: {t(`enums.externalDoctorStatus.${proc.externalDoctorStatus}`, { defaultValue: proc.externalDoctorStatus })}
                                              </span>
                                            )}
                                          </div>
                                          {proc.externalDoctorNotes && (
                                            <div style={{ fontSize: '0.725rem', color: '#EF4444', fontStyle: 'italic', marginTop: '2px' }}>
                                              <strong>{t('dashboard.doctorNotes')}:</strong> "{proc.externalDoctorNotes}"
                                            </div>
                                          )}
                                          {proc.verificationResolvedBy && (
                                            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                              <strong>{t('dashboard.resolvedBy')}:</strong> {proc.verificationResolvedBy.firstName} {proc.verificationResolvedBy.lastName}
                                            </div>
                                          )}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500, minWidth: '150px' }}>
                                          {isExternal ? (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                                                {selectedWO.doctor?.name 
                                                  ? (selectedWO.doctor.clinicName 
                                                      ? `${selectedWO.doctor.name} (${selectedWO.doctor.clinicName})` 
                                                      : selectedWO.doctor.name) 
                                                  : t('dashboard.unassigned')}
                                              </span>
                                              <RoleBadge role="DOCTOR" />
                                            </div>
                                          ) : proc.technician ? (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                              <span>{`${proc.technician.firstName} ${proc.technician.lastName}`}</span>
                                              <RoleBadge role={proc.technician.role || (isInternal ? 'ADMIN' : 'TECHNICIAN')} />
                                            </div>
                                          ) : (
                                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('dashboard.unassigned')}</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{startTimeStr}</td>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{endTimeStr}</td>

                                        {/* Work Time Column */}
                                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                          {(() => {
                                            const hasWorkTime = (proc.totalActiveDuration && proc.totalActiveDuration > 0);
                                            const cycleCount = 1 + (proc.reworkCount || 0) + repetitionsForStep.length;

                                            if (stepStatus === 'COMPLETED') {
                                              return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                  <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontWeight: 700,
                                                    color: '#10B981',
                                                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8125rem',
                                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                                    width: 'fit-content'
                                                  }}>
                                                    <Clock size={12} />
                                                    {formatDuration(proc.totalActiveDuration)}
                                                  </span>
                                                  {cycleCount > 1 && (
                                                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                      {cycleCount} {t('workOrders.attempts', { defaultValue: 'attempts' })}
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            }

                                            if (hasWorkTime) {
                                              return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                  <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    fontWeight: 700,
                                                    color: '#8B5CF6',
                                                    backgroundColor: 'rgba(139, 92, 246, 0.08)',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8125rem',
                                                    border: '1px solid rgba(139, 92, 246, 0.2)',
                                                    width: 'fit-content'
                                                  }}>
                                                    <Clock size={12} />
                                                    {formatDuration(proc.totalActiveDuration)}
                                                  </span>
                                                  <span style={{ fontSize: '0.6875rem', color: '#D97706', fontWeight: 600 }}>
                                                    {stepStatus === 'IN_PROGRESS'
                                                      ? `+ Attempt #${cycleCount} running`
                                                      : stepStatus === 'PAUSED'
                                                        ? `+ Attempt #${cycleCount} paused`
                                                        : `(${t('workOrders.prevCycle', { defaultValue: 'Prev. cycle' })})`}
                                                  </span>
                                                </div>
                                              );
                                            }

                                            if (stepStatus === 'IN_PROGRESS') {
                                              return (
                                                <span style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '4px',
                                                  fontSize: '0.75rem',
                                                  fontWeight: 600,
                                                  color: '#F59E0B',
                                                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                                                  padding: '2px 6px',
                                                  borderRadius: '4px',
                                                  width: 'fit-content'
                                                }}>
                                                  <Clock size={11} className="animate-pulse" />
                                                  {t('common.running', { defaultValue: 'Running' })}
                                                </span>
                                              );
                                            }

                                            if (stepStatus === 'PAUSED') {
                                              return (
                                                <span style={{ fontSize: '0.75rem', color: '#F59E0B', fontStyle: 'italic' }}>
                                                  {t('enums.processStatus.PAUSED', { defaultValue: 'Paused' })}
                                                </span>
                                              );
                                            }

                                            return <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>—</span>;
                                          })()}
                                        </td>
                                        
                                        {/* Time Audit Column */}
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
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
                                              <span>{isExpanded ? t('dashboard.hideAudit') : t('dashboard.viewAudit', { count: combinedLogs.length })}</span>
                                            </button>
                                          ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>{t('dashboard.noActivityLogs')}</span>
                                          )}
                                        </td>

                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
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
                                              (() => {
                                                const isExternal = proc.isVerification && !proc.technicianId;
                                                const isAssigned = isExternal
                                                  ? (user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN')
                                                  : (proc.technicianId === user?.id || user?.role === 'SUPER_ADMIN');

                                                if (!isAssigned) return null;

                                                return (
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
                                                              style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#8B5CF6', border: 'none', padding: '3px 8px', fontSize: '0.7rem', marginTop: '6px', fontWeight: 600, cursor: 'pointer' }}
                                                              onClick={() => handleInlineStartVerification(selectedWO.id, proc.id)}
                                                            >
                                                              <Play size={10} /> {t('dashboard.start')}
                                                            </button>
                                                          );
                                                        }
                                                        return null;
                                                      })()
                                                    )}
                                                    {(stepStatus === 'IN_PROGRESS' || stepStatus === 'PAUSED') && (
                                                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                        <button
                                                          className="btn btn--primary btn--sm"
                                                          style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#10B981', border: 'none', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                          onClick={() => handleInlineEndVerification(selectedWO.id, proc.id, 'SUCCESS')}
                                                        >
                                                          <Check size={10} /> {t('dashboard.approve')}
                                                        </button>
                                                        <button
                                                          className="btn btn--primary btn--sm"
                                                          style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#EF4444', border: 'none', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                          onClick={() => handleInlineEndVerification(selectedWO.id, proc.id, 'REWORK')}
                                                        >
                                                          <AlertCircle size={10} /> {t('dashboard.rework')}
                                                        </button>
                                                        <button
                                                          className="btn btn--primary btn--sm"
                                                          style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#D946EF', border: 'none', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                          onClick={() => handleInlineEndVerification(selectedWO.id, proc.id, 'REPETITION')}
                                                        >
                                                          <History size={10} /> {t('dashboard.repetition')}
                                                        </button>
                                                      </div>
                                                    )}
                                                  </>
                                                );
                                              })()
                                            )}
                                            {!proc.isVerification && isLabAdminOrOwner && (proc.technicianId === user?.id || user?.role === 'SUPER_ADMIN') && (
                                              (() => {
                                                const precedingComplete = processes
                                                  .filter((p: any) => p.sequence < proc.sequence)
                                                  .every((p: any) => p.status === 'COMPLETED');

                                                return (
                                                  <div style={{ marginTop: '6px' }}>
                                                    {stepStatus === 'NOT_STARTED' && (
                                                      precedingComplete ? (
                                                        <button
                                                          className="btn btn--primary btn--sm"
                                                          style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#3B82F6', border: 'none', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                          onClick={() => handleInlineProcessAction(selectedWO.id, proc.id, 'start')}
                                                        >
                                                          <Play size={10} /> {t('workOrder.startProcess', { defaultValue: 'Start' })}
                                                        </button>
                                                      ) : (
                                                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                          <Clock size={10} /> {t('techDashboard.precedingStepBlocked', { defaultValue: 'Preceding step pending' })}
                                                        </span>
                                                      )
                                                    )}
                                                    {stepStatus === 'IN_PROGRESS' && (
                                                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        <button
                                                          className="btn btn--warning btn--sm"
                                                          style={{ display: 'flex', alignItems: 'center', gap: '2px', border: 'none', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                          onClick={() => handleInlineProcessAction(selectedWO.id, proc.id, 'pause')}
                                                        >
                                                          <Pause size={10} /> {t('workOrder.pauseProcess', { defaultValue: 'Pause' })}
                                                        </button>
                                                        <button
                                                          className="btn btn--primary btn--sm"
                                                          style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#10B981', border: 'none', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                          onClick={() => handleInlineProcessAction(selectedWO.id, proc.id, 'end')}
                                                        >
                                                          <CheckCircle2 size={10} /> {t('workOrder.endProcess', { defaultValue: 'Complete' })}
                                                        </button>
                                                      </div>
                                                    )}
                                                    {stepStatus === 'PAUSED' && (
                                                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        <button
                                                          className="btn btn--success btn--sm"
                                                          style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#10B981', color: '#fff', border: 'none', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                          onClick={() => handleInlineProcessAction(selectedWO.id, proc.id, 'resume')}
                                                        >
                                                          <Play size={10} /> {t('workOrder.resumeProcess', { defaultValue: 'Resume' })}
                                                        </button>
                                                        <button
                                                          className="btn btn--primary btn--sm"
                                                          style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#10B981', border: 'none', padding: '3px 8px', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                          onClick={() => handleInlineProcessAction(selectedWO.id, proc.id, 'end')}
                                                        >
                                                          <CheckCircle2 size={10} /> {t('workOrder.endProcess', { defaultValue: 'Complete' })}
                                                        </button>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })()
                                            )}
                                          </div>
                                        </td>
                                      </tr>

                                      {/* Collapsible Process Audit Log Timeline */}
                                      {isExpanded && hasLogs && (
                                        <tr style={{ backgroundColor: 'rgba(111, 174, 217, 0.02)' }}>
                                          <td colSpan={8} style={{ padding: '0.75rem 1rem 1rem 2.5rem', borderBottom: '1px solid var(--border)' }}>
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
                                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                  {t('dashboard.processActivityHistory')} &mdash; {proc.processName}
                                                </div>
                                                {(() => {
                                                  const cycleCount = 1 + (proc.reworkCount || 0) + repetitionsForStep.length;
                                                  if (!proc.totalActiveDuration && cycleCount <= 1) return null;
                                                  return (
                                                    <div style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '6px',
                                                      fontSize: '0.75rem',
                                                      fontWeight: 700,
                                                      color: '#10B981',
                                                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                      border: '1px solid rgba(16, 185, 129, 0.25)',
                                                      padding: '3px 10px',
                                                      borderRadius: '100px'
                                                    }}>
                                                      <Clock size={12} />
                                                      <span>{t('workOrders.totalWorkTime', { defaultValue: 'Total Work Time' })}: {formatDuration(proc.totalActiveDuration)}</span>
                                                      {cycleCount > 1 && (
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 600 }}>
                                                          • {cycleCount} {t('workOrders.attempts', { defaultValue: 'attempts' })}
                                                        </span>
                                                      )}
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {(() => {
                                                  const chronologicalEndLogs = combinedLogs
                                                    .filter((l: any) => l.action === 'END')
                                                    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                                                  return combinedLogs.map((log: any, lidx: number) => {
                                                    const durationPill = log.action === 'END' ? extractDurationFromNote(log.notes) : null;
                                                    const attemptIdx = log.action === 'END'
                                                      ? chronologicalEndLogs.findIndex((l: any) => l.id === log.id)
                                                      : -1;
                                                    const attemptLabel = (chronologicalEndLogs.length > 1 && attemptIdx !== -1)
                                                      ? ` (${t('workOrders.attempt', { defaultValue: 'Attempt' })} #${attemptIdx + 1})`
                                                      : '';
                                                  const getActionLabel = (act: string) => {
                                                    if (proc.isVerification) {
                                                      if (act === 'START') return t('enums.processAction.START_VERIFICATION', { defaultValue: 'Verification Started' });
                                                      if (act === 'END') return t('enums.processAction.END_VERIFICATION', { defaultValue: 'Verification Ended' });
                                                    }
                                                    switch (act) {
                                                      case 'START': return t('enums.processAction.START', { defaultValue: 'Process Started' });
                                                      case 'PAUSE': return t('enums.processAction.PAUSE', { defaultValue: 'Process Paused' });
                                                      case 'RESUME': return t('enums.processAction.RESUME', { defaultValue: 'Process Resumed' });
                                                      case 'END': return t('enums.processAction.END', { defaultValue: 'Process Completed' });
                                                      case 'REWORK_TRIGGERED': return t('enums.processAction.REWORK_TRIGGERED', { defaultValue: 'Rework Triggered' });
                                                      case 'REWORK_ASSIGNED': return t('enums.processAction.REWORK_ASSIGNED', { defaultValue: 'Rework Assigned' });
                                                      case 'REWORK_COMPLETED': return t('enums.processAction.REWORK_COMPLETED', { defaultValue: 'Rework Completed' });
                                                      case 'REWORK_APPROVED': return t('enums.processAction.REWORK_APPROVED', { defaultValue: 'Rework Approved' });
                                                      case 'REPETITION_RESET': return t('enums.processAction.REPETITION_RESET', { defaultValue: 'Repetition Triggered (Reset)' });
                                                      case 'REPETITION_TRIGGERED': return t('enums.processAction.REPETITION_TRIGGERED', { defaultValue: 'Repetition Triggered' });
                                                      default: return act.replace('_', ' ');
                                                    }
                                                  };

                                                  const getActionColor = (act: string) => {
                                                    switch (act) {
                                                      case 'START': return 'var(--accent-primary, #3B82F6)';
                                                      case 'PAUSE': return 'var(--warning, #F59E0B)';
                                                      case 'RESUME': return 'var(--accent-primary, #3B82F6)';
                                                      case 'END': return 'var(--success, #10B981)';
                                                      case 'REWORK_TRIGGERED':
                                                      case 'REWORK_ASSIGNED': return '#EF4444';
                                                      case 'REWORK_COMPLETED': return '#10B981';
                                                      case 'REWORK_APPROVED': return '#8B5CF6';
                                                      case 'REPETITION_RESET': return '#F97316';
                                                      case 'REPETITION_TRIGGERED': return '#EC4899';
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
                                                            <span style={{ color: getActionColor(log.action) }}>{getActionLabel(log.action)}{attemptLabel}</span>
                                                            {durationPill && (
                                                              <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px',
                                                                marginLeft: '6px',
                                                                padding: '1px 6px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.7rem',
                                                                fontWeight: 700,
                                                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                                                color: '#10B981',
                                                                border: '1px solid rgba(16, 185, 129, 0.2)'
                                                              }}>
                                                                <Clock size={10} />
                                                                {durationPill}
                                                              </span>
                                                            )}
                                                          </span>
                                                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            {formatDateTime(log.timestamp, i18n.language, user?.timezone)}
                                                          </span>
                                                        </div>
                                                        {log.notes && (
                                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                                                            {formatAuditNote(log.notes, t)}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  );
                                                  });
                                                })()}
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

                  let payStatusLabel = t('financePage.unpaid');
                  let payStatusColor = '#64748B';
                  let payStatusBg = 'rgba(148, 163, 184, 0.08)';

                  if (isPaidComplete) {
                    payStatusLabel = t('financePage.paidInFull');
                    payStatusColor = 'var(--success, #10B981)';
                    payStatusBg = 'var(--success-bg, rgba(16, 185, 129, 0.08))';
                  } else if (initialPay > 0) {
                    payStatusLabel = t('financePage.partiallyPaid');
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
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.totalPrice')}</span>
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
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.receivedAmount')}</span>
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
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('workOrders.pendingAmount')}</span>
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
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{t('financePage.paymentStatus', { defaultValue: 'Payment Status' })}</span>
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
                            {t('workOrders.paymentTransactions')}
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
                              <span>{t('financePage.recordPayment')}</span>
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
                            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-heading)' }}>{t('workOrders.recordNewPayment')}</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem', alignItems: 'flex-start' }}>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('financePage.paymentAmount')} *</label>
                                <input
                                  type="number"
                                  className="form-input"
                                  placeholder={t('workOrders.quotePlaceholder', { defaultValue: 'e.g. 1000' })}
                                  min="0.01"
                                  max={balance}
                                  step="0.01"
                                  value={addFundAmount}
                                  onChange={e => setAddFundAmount(e.target.value)}
                                  style={{ height: '36px', fontSize: '0.875rem' }}
                                />
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('paymentMethods.method', { defaultValue: 'Payment Method' })} *</label>
                                <select
                                  className="form-input"
                                  value={addFundPaymentMethod || (paymentMethods[0]?.name || 'Cash')}
                                  onChange={e => setAddFundPaymentMethod(e.target.value)}
                                  style={{ height: '36px', fontSize: '0.875rem', fontWeight: 600 }}
                                >
                                  {paymentMethods.length > 0 ? (
                                    paymentMethods.map((pm) => (
                                      <option key={pm.id} value={pm.name}>{pm.name}</option>
                                    ))
                                  ) : (
                                    <>
                                      <option value="Cash">{t('paymentMethods.defaultCash', { defaultValue: 'Cash' })}</option>
                                      <option value="Credit Card">{t('paymentMethods.defaultCreditCard', { defaultValue: 'Credit Card' })}</option>
                                      <option value="Debit Card">{t('paymentMethods.defaultDebitCard', { defaultValue: 'Debit Card' })}</option>
                                      <option value="Bank Transfer">{t('paymentMethods.defaultBankTransfer', { defaultValue: 'Bank Transfer' })}</option>
                                      <option value="Check">{t('paymentMethods.defaultCheck', { defaultValue: 'Check' })}</option>
                                    </>
                                  )}
                                </select>
                              </div>
                              <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t('financePage.paymentNotes')}</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder={t('financePage.paymentNotesPlaceholder', { defaultValue: 'e.g. Second installment paid via bank transfer' })}
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
                                {t('common.cancel')}
                              </button>
                              <button
                                type="button"
                                className="btn btn--primary btn--sm"
                                style={{ backgroundColor: 'var(--success, #10B981)', borderColor: 'var(--success, #10B981)', color: '#FFFFFF' }}
                                onClick={handleAddFund}
                                disabled={submittingPayment || !addFundAmount}
                              >
                                {submittingPayment ? (
                                  <><Loader2 size={12} className="spinner" /> <span>{t('common.loading')}</span></>
                                ) : (
                                  <span>{t('financePage.recordPayment')}</span>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Transaction history log */}
                        <div style={{
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          overflowX: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          backgroundColor: 'var(--bg-surface)',
                          width: '100%'
                        }}>
                          <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(111, 174, 217, 0.04)' }}>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('financePage.paymentDate')}</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.receivedAmount')}</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('paymentMethods.method', { defaultValue: 'Method' })}</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.notes')}</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('common.status')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Initial Payment Creation Row */}
                              <tr style={{ borderBottom: payments.length > 0 ? '1px solid var(--border)' : 'none' }}>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                  {appFormatDateTime(selectedWO.createdAt)}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  ${((selectedWO.initialPayment || 0) - payments.reduce((acc: number, curr: any) => acc + curr.amount, 0)).toLocaleString('es-MX')}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    backgroundColor: 'var(--bg-overlay, #f1f5f9)',
                                    color: 'var(--text-secondary)',
                                  }}>
                                    {t('workOrders.initialDeposit', { defaultValue: 'Initial Deposit' })}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 500, fontStyle: 'italic' }}>
                                  {t('workOrders.initialPaymentRegistered')}
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
                                    {t('financePage.settled')}
                                  </span>
                                </td>
                              </tr>

                              {/* Subsequent Added Funds Rows */}
                              {payments.map((payment: any, pidx: number) => (
                                <tr key={pidx} style={{
                                  borderBottom: pidx < payments.length - 1 ? '1px solid var(--border)' : 'none'
                                }}>
                                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                    {appFormatDateTime(payment.date)}
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    ${payment.amount.toLocaleString('es-MX')}
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                      color: 'var(--accent-primary, #3B82F6)',
                                    }}>
                                      {payment.paymentMethod || t('paymentMethods.defaultCash', { defaultValue: 'Cash' })}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    {payment.notes || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('workOrders.noSpecifications')}</span>}
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
                                      {t('financePage.settled')}
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

                if (viewTab === 'rework') {
                  const logs = selectedWO.reworkLogs || [];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('workOrders.reworkCycleTrail')}
                          </span>
                          <span style={{
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            color: '#EF4444',
                            border: '1px solid var(--border)'
                          }}>
                            {t('workOrders.totalReworkCycles', { count: logs.length })}
                          </span>
                        </div>

                        {logs.length === 0 ? (
                          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', border: '1.5px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <History size={32} style={{ opacity: 0.5 }} />
                            <h4 style={{ fontWeight: 500, fontSize: '0.875rem', margin: 0 }}>{t('workOrders.noReworkCycles')}</h4>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                              {t('workOrders.hasNotUndergoneRework')}
                            </p>
                          </div>
                        ) : (
                          <div style={{
                            overflowX: 'auto',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-surface)'
                          }}>
                            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.processName')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.reworkCount')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.initiatedBy')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.initiationDateTime')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.triggeringStage')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.assignedTechnician')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.completionDateTime')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.approvalDateTime')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('common.status')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {logs.map((log: any) => {
                                  const formatDate = (dateStr: string | null) => {
                                    if (!dateStr) return '—';
                                    return formatDateTime(dateStr, i18n.language, user?.timezone, {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                  };

                                  let statusColor = '#6B7280';
                                  let statusBg = 'rgba(107, 114, 128, 0.08)';
                                  let displayStatus = log.status;
                                  if (log.status === 'Approved') {
                                    statusColor = 'var(--success, #10B981)';
                                    statusBg = 'var(--success-bg, rgba(16, 185, 129, 0.08))';
                                    displayStatus = t('enums.processAction.REWORK_APPROVED');
                                  } else if (log.status === 'In Progress') {
                                    statusColor = 'var(--warning, #F59E0B)';
                                    statusBg = 'var(--warning-bg, rgba(245, 158, 11, 0.08))';
                                    displayStatus = t('enums.processStatus.IN_PROGRESS');
                                  } else if (log.status === 'Completed') {
                                    statusColor = 'var(--accent-primary, #3B82F6)';
                                    statusBg = 'rgba(59, 130, 246, 0.08)';
                                    displayStatus = t('enums.processStatus.COMPLETED');
                                  }


                                  return (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {log.processName}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        {log.reworkCount}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {log.initiatedBy ? `${log.initiatedBy.firstName} ${log.initiatedBy.lastName}` : t('dashboard.system')}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                        {formatDate(log.initiatedAt)}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                        {log.verificationStage}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {log.technician ? `${log.technician.firstName} ${log.technician.lastName}` : t('dashboard.unassigned')}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                        {formatDate(log.completedAt)}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                        {formatDate(log.approvedAt)}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          padding: '2px 8px',
                                          borderRadius: '100px',
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          color: statusColor,
                                          backgroundColor: statusBg
                                        }}>
                                          {displayStatus}
                                        </span>
                                      </td>
                                    </tr>
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

                if (viewTab === 'repetition') {
                  const logs = selectedWO.repetitionLogs || [];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('workOrders.repetitionCycleTrail')}
                          </span>
                          <span style={{
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            color: '#EF4444',
                            border: '1px solid var(--border)'
                          }}>
                            {t('workOrders.totalRepetitionCycles', { count: logs.length })}
                          </span>
                        </div>

                        {logs.length === 0 ? (
                          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', border: '1.5px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <History size={32} style={{ opacity: 0.5 }} />
                            <h4 style={{ fontWeight: 500, fontSize: '0.875rem', margin: 0 }}>{t('workOrders.noRepetitionCycles')}</h4>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                              {t('workOrders.hasNotUndergoneRepetition')}
                            </p>
                          </div>
                        ) : (
                          <div style={{
                            overflowX: 'auto',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-surface)'
                          }}>
                            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.repetitionCycle')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.triggeringStage')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.initiatedBy')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.initiationDateTime')}</th>
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('workOrders.previousCompletedSteps')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {logs.map((log: any) => {
                                  const formatDate = (dateStr: string | null) => {
                                    if (!dateStr) return '—';
                                    return formatDateTime(dateStr, i18n.language, user?.timezone, {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                  };


                                  return (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {t('dashboard.repetitionNumber', { count: log.repetitionCount })}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                        {log.verificationStage}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {log.initiatedBy ? `${log.initiatedBy.firstName} ${log.initiatedBy.lastName}` : t('dashboard.system')}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                        {formatDate(log.initiatedAt)}
                                      </td>
                                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                        {log.completedSteps}
                                      </td>
                                    </tr>
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

                if (viewTab === 'chat' && user?.role !== 'OWNER') {
                  return (
                    <div style={{ paddingTop: '0.25rem' }}>
                      <WorkOrderChat workOrderId={selectedWO.id} />
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
                {t('common.close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

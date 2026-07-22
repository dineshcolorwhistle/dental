import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  Search,
  X,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Trash2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Clock,
  PlayCircle,
  ShieldCheck,
  CircleDot,
  FileText,
  PlusCircle,
  ShieldPlus,
  Eye,
  Pencil,
  Lock,
  QrCode,
  MessageCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  workOrderService,
  doctorService,
  messagingService,
  prosthesisTypeService,
  technicianService,
  branchService,
  processService,
  adminService,
  type WorkOrderListItem,
  type CreateWorkOrderPayload,
  type CreateWorkOrderProcessPayload,
  type DoctorListItem,
  type ProsthesisTypeListItem,
  type TechnicianListItem,
  type BranchListItem,
  type ProcessListItem,
  type AdminListItem,
} from '../services';
import { useTranslation } from 'react-i18next';
import { useAuth, useSocket } from '../context';
import { Pagination, SearchableSelect, ViewWorkOrderModal, QRLabelModal } from '../components';

type StatusFilter = 'ALL' | 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  CREATED: { label: 'Created', color: '#6B7280', bg: '#F3F4F6', icon: <CircleDot size={12} /> },
  ASSIGNED: { label: 'Assigned', color: '#3B82F6', bg: '#EFF6FF', icon: <Clock size={12} /> },
  IN_PROGRESS: { label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB', icon: <PlayCircle size={12} /> },
  INTERNAL_VERIFICATION: { label: 'Internal Verification', color: '#8B5CF6', bg: '#F5F3FF', icon: <ShieldCheck size={12} /> },
  EXTERNAL_VERIFICATION: { label: 'External Verification', color: '#6366F1', bg: '#EEF2FF', icon: <ShieldCheck size={12} /> },
  COMPLETED: { label: 'Completed', color: '#10B981', bg: '#ECFDF5', icon: <CheckCircle2 size={12} /> },
  FAILED: { label: 'Failed', color: '#EF4444', bg: '#FEF2F2', icon: <AlertCircle size={12} /> },
  CANCELLED: { label: 'Cancelled', color: '#F97316', bg: '#FFF3E0', icon: <X size={12} /> },
};

interface PaymentHistoryItem {
  amount: number;
  notes: string;
  date: string;
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

interface ProcessFormItem {
  tempId: string;
  processName: string;
  technicianId: string;
  sequence: number;
  isVerification: boolean;
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  rework?: boolean;
  reworkCount?: number;
  reworkActive?: boolean;
}

import { NoteHistoryThread } from '../components/NoteHistoryThread';

export function WorkOrdersPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const canDelete = isOwner;
  const canCreate = isAdmin;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(i18n.language?.startsWith('es') ? 'es-MX' : 'en-IN', {
      style: 'currency',
      currency: i18n.language?.startsWith('es') ? 'MXN' : 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };
  const [workOrders, setWorkOrders] = useState<WorkOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilter>('ALL');
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [unreadChatCounts, setUnreadChatCounts] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => { setCurrentPage(0); }, [search, selectedBranchFilter, selectedStatusFilter]);

  const [sortField, setSortField] = useState<'folioNumber' | 'patient' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [woToDelete, setWoToDelete] = useState<WorkOrderListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrderListItem | null>(null);

  useEffect(() => {
    const selectWoId = searchParams.get('selectWo');
    if (selectWoId && !showViewModal) {
      const found = workOrders.find((w) => w.id === selectWoId);
      if (found) {
        setSelectedWO(found);
        setShowViewModal(true);
        setSearchParams(
          (params) => {
            const next = new URLSearchParams(params);
            next.delete('selectWo');
            return next;
          },
          { replace: true }
        );
      } else if (!loading) {
        workOrderService
          .getById(selectWoId)
          .then((wo) => {
            if (wo) {
              setSelectedWO(wo);
              setShowViewModal(true);
              setSearchParams(
                (params) => {
                  const next = new URLSearchParams(params);
                  next.delete('selectWo');
                  return next;
                },
                { replace: true }
              );
            }
          })
          .catch(() => {
            // Ignore if not found
          });
      }
    }
  }, [searchParams, setSearchParams, workOrders, loading, showViewModal]);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWO, setEditingWO] = useState<WorkOrderListItem | null>(null);

  // QR modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrWO, setQrWO] = useState<WorkOrderListItem | null>(null);

  // Reference data for create form
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [prosthesisTypes, setProsthesisTypes] = useState<ProsthesisTypeListItem[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianListItem[]>([]);
  const [availableProcesses, setAvailableProcesses] = useState<ProcessListItem[]>([]);
  const [admins, setAdmins] = useState<AdminListItem[]>([]);

  // Form state
  const [form, setForm] = useState({
    doctorId: '',
    patient: '',
    boxNumber: '',
    fileNumber: '',
    prosthesisTypeId: '',
    specification: '',
    color: '',
    notes: '',
    totalQuote: '',
    initialPayment: '',
    paymentReferenceNumber: '',
    branchId: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [processList, setProcessList] = useState<ProcessFormItem[]>([]);
  const [generatedFolio, setGeneratedFolio] = useState('');

  // Tab Wizard States
  const [modalTab, setModalTab] = useState<'details' | 'processes' | 'payments'>('details');
  const [formStatus, setFormStatus] = useState<string>('CREATED');
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [pendingAction, setPendingAction] = useState<'CREATE_ASSIGN' | 'EDIT_ASSIGN' | null>(null);

  const handleAddNote = async (content: string) => {
    if (!editingWO) return;
    const newNote = await workOrderService.addNote(editingWO.id, content);
    setEditingWO((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notesList: [...(prev.notesList || []), newNote],
      };
    });
    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === editingWO.id
          ? { ...wo, notesList: [...(wo.notesList || []), newNote] }
          : wo
      )
    );
  };

  const handleUpdateNote = async (noteId: string, content: string) => {
    if (!editingWO) return;
    const updatedNote = await workOrderService.updateNote(editingWO.id, noteId, content);
    setEditingWO((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notesList: (prev.notesList || []).map((n) => (n.id === noteId ? updatedNote : n)),
      };
    });
    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === editingWO.id
          ? {
              ...wo,
              notesList: (wo.notesList || []).map((n) => (n.id === noteId ? updatedNote : n)),
            }
          : wo
      )
    );
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!editingWO) return;
    await workOrderService.deleteNote(editingWO.id, noteId);
    setEditingWO((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notesList: (prev.notesList || []).filter((n) => n.id !== noteId),
      };
    });
    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === editingWO.id
          ? {
              ...wo,
              notesList: (wo.notesList || []).filter((n) => n.id !== noteId),
            }
          : wo
      )
    );
  };

  // Add process inline
  const [showAddProcess, setShowAddProcess] = useState(false);
  const [newProcessId, setNewProcessId] = useState('');
  const [newProcessName, setNewProcessName] = useState('');
  const [newProcessTechnicianId, setNewProcessTechnicianId] = useState('');

  // Add verification inline
  const [showAddVerificationForm, setShowAddVerificationForm] = useState(false);
  const [verificationType, setVerificationType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [verificationTechnicianId, setVerificationTechnicianId] = useState('');

  // ─── Data Fetching ───────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;
      const [woData, branchData, chatCounts] = await Promise.all([
        workOrderService.getAll(branchScope),
        isAdmin ? Promise.resolve([]) : branchService.getAll(),
        messagingService.getWorkOrderUnreadCounts(),
      ]);
      setWorkOrders(woData);
      setBranches(branchData.filter((b) => b.isActive));
      setUnreadChatCounts(chatCounts);
    } catch (err) {
      toast.error(t('workOrders.failedLoad', { defaultValue: 'Failed to load work orders' }));
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAdmin, user?.branchId, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!socket) return;

    const handleSocketUpdate = () => {
      fetchData(true);
    };

    const handleMessageReceived = (msg: any) => {
      if (msg.conversation?.workOrderId) {
        setUnreadChatCounts((prev) => ({
          ...prev,
          [msg.conversation.workOrderId]: (prev[msg.conversation.workOrderId] || 0) + 1,
        }));
      }
    };

    socket.on('work_order_created', handleSocketUpdate);
    socket.on('work_order_updated', handleSocketUpdate);
    socket.on('message_received', handleMessageReceived);

    return () => {
      socket.off('work_order_created', handleSocketUpdate);
      socket.off('work_order_updated', handleSocketUpdate);
      socket.off('message_received', handleMessageReceived);
    };
  }, [socket, fetchData]);

  useEffect(() => {
    if (isConnected) {
      fetchData(true);
    }
  }, [isConnected, fetchData]);

  useEffect(() => {
    if (location.state?.editWorkOrderId) {
      const targetWoId = location.state.editWorkOrderId;
      const targetTab = location.state.activeTab || 'details';
      
      const openEditFromState = async () => {
        try {
          const wo = await workOrderService.getById(targetWoId);
          if (wo) {
            await handleEditOpen(wo);
            if (targetTab === 'processes') {
              setModalTab('processes');
            }
          }
        } catch (e) {
          console.error('Failed to auto-open edit modal from state', e);
        }
        // Clear state so it doesn't trigger on reload
        navigate(location.pathname, { replace: true, state: {} });
      };

      openEditFromState();
    }
  }, [location.state, navigate]);



  const loadReferenceData = useCallback(async () => {
    try {
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;
      const [doctorData, ptData, techData, processData, adminData] = await Promise.all([
        doctorService.getAll(branchScope),
        prosthesisTypeService.getAll(),
        technicianService.getAll(branchScope),
        processService.getAll(branchScope),
        adminService.getAll(branchScope),
      ]);
      setDoctors(doctorData.filter((d) => d.isActive));
      setProsthesisTypes(ptData);
      setTechnicians(techData.filter((t) => t.status === 'ACTIVE'));
      setAvailableProcesses(processData);
      setAdmins(adminData.filter((a) => a.status === 'ACTIVE'));
    } catch (err) {
      toast.error(t('common.failedLoadReference', { defaultValue: 'Failed to load reference data' }));
      console.error(err);
    }
  }, [isAdmin, user?.branchId, t]);

  // ─── Filtering & Sorting ───────────────────────
  const filtered = workOrders
    .filter((wo) => {
      if (!isAdmin && selectedBranchFilter !== 'ALL' && wo.branchId !== selectedBranchFilter) return false;
      if (selectedStatusFilter !== 'ALL' && wo.status !== selectedStatusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          wo.folioNumber.toLowerCase().includes(q) ||
          wo.patient.toLowerCase().includes(q) ||
          (wo.doctor?.name && wo.doctor.name.toLowerCase().includes(q)) ||
          (wo.prosthesisType?.name && wo.prosthesisType.name.toLowerCase().includes(q)) ||
          (wo.boxNumber && wo.boxNumber.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'folioNumber') return mul * a.folioNumber.localeCompare(b.folioNumber);
      if (sortField === 'patient') return mul * a.patient.localeCompare(b.patient);
      return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // ─── Stats ──────────────────────────
  const stats = {
    total: workOrders.length,
    created: workOrders.filter((wo) => wo.status === 'CREATED').length,
    assigned: workOrders.filter((wo) => wo.status === 'ASSIGNED').length,
    inProgress: workOrders.filter((wo) => wo.status === 'IN_PROGRESS').length,
    completed: workOrders.filter((wo) => wo.status === 'COMPLETED').length,
  };

  const getDefaultAdminId = () => {
    const currentBranchId = form.branchId || user?.branchId;
    if (!currentBranchId) return '';
    if (isOwner) {
      const selectedBranch = branches.find(b => b.id === currentBranchId);
      return selectedBranch?.defaultAdminId || '';
    } else {
      const foundAdmin = admins.find(a => a.branchId === currentBranchId && a.branch?.defaultAdminId === a.id);
      if (foundAdmin) return foundAdmin.id;
      const anyAdminInBranch = admins.find(a => a.branchId === currentBranchId);
      return anyAdminInBranch?.branch?.defaultAdminId || '';
    }
  };

  // ─── Form Handling ──────────────────────────
  const validateTab1Details = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.doctorId) errors.doctorId = t('validation.fieldRequired', { defaultValue: 'Doctor is required' });
    if (!form.patient.trim()) errors.patient = t('validation.fieldRequired', { defaultValue: 'Patient name is required' });
    if (!form.prosthesisTypeId) errors.prosthesisTypeId = t('validation.fieldRequired', { defaultValue: 'Prosthesis type is required' });
    if (!isAdmin && branches.length > 0 && !form.branchId) errors.branchId = t('validation.fieldRequired', { defaultValue: 'Branch is required' });
    if (isAdmin && !form.specification.trim()) errors.specification = t('validation.fieldRequired', { defaultValue: 'Specification is required' });
    if (!form.color.trim()) errors.color = t('validation.fieldRequired', { defaultValue: 'Color is required' });

    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.doctorId;
      delete next.patient;
      delete next.prosthesisTypeId;
      delete next.branchId;
      delete next.specification;
      delete next.color;
      return { ...next, ...errors };
    });
    return Object.keys(errors).length === 0;
  };

  const validateTab2Processes = (): boolean => {
    const errors: Record<string, string> = {};
    if (processList.length === 0) {
      errors.processes = t('workOrders.validationProcessStepRequired', { defaultValue: 'At least one process step is required' });
    } else {
      const hasUnassignedProcess = processList.some((p) => !p.technicianId && !(p.isVerification && !p.technicianId));
      if (hasUnassignedProcess) {
        errors.processes = t('workOrders.validationAllStepsAssigned', { defaultValue: 'All process steps must be assigned to a technician' });
      }
    }
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.processes;
      return { ...next, ...errors };
    });
    return Object.keys(errors).length === 0;
  };

  const validateTab3Payments = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.totalQuote.trim()) {
      errors.totalQuote = t('validation.fieldRequired', { defaultValue: 'Total quote is required' });
    } else if (parseFloat(form.totalQuote) < 0) {
      errors.totalQuote = t('workOrders.validationQuoteNonNegative', { defaultValue: 'Total quote cannot be negative' });
    }
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.totalQuote;
      return { ...next, ...errors };
    });
    return Object.keys(errors).length === 0;
  };

  const validateForm = (checkProcesses = true): boolean => {
    const tab1Valid = validateTab1Details();
    if (!tab1Valid) {
      setModalTab('details');
      return false;
    }
    const tab2Valid = checkProcesses ? validateTab2Processes() : true;
    if (!tab2Valid) {
      setModalTab('processes');
      return false;
    }
    const tab3Valid = validateTab3Payments();
    if (!tab3Valid) {
      setModalTab('payments');
      return false;
    }
    return true;
  };

  const handleCreateOpen = async () => {
    await loadReferenceData();
    const branchId = isAdmin ? user?.branchId || '' : '';
    setForm({
      doctorId: '',
      patient: '',
      boxNumber: '',
      fileNumber: '',
      prosthesisTypeId: '',
      specification: '',
      color: '',
      notes: '',
      totalQuote: '',
      initialPayment: '',
      paymentReferenceNumber: '',
      branchId,
    });
    setProcessList([]);
    setFormErrors({});
    setShowAddProcess(false);
    setNewProcessId('');
    setNewProcessName('');
    setNewProcessTechnicianId('');
    setGeneratedFolio('');
    setModalTab('details');
    setFormStatus('CREATED');
    setShowAddVerificationForm(false);
    setVerificationType('INTERNAL');
    setVerificationTechnicianId('');

    // Fetch the next folio number!
    if (branchId) {
      try {
        const { folioNumber } = await workOrderService.getNextFolioNumber(branchId);
        setGeneratedFolio(folioNumber);
      } catch (err) {
        console.error('Failed to generate folio number:', err);
      }
    }

    setShowCreateModal(true);
  };

  const handleProsthesisTypeChange = async (ptId: string) => {
    const selectedPt = prosthesisTypes.find((p) => p.id === ptId);
    setForm((prev) => ({
      ...prev,
      prosthesisTypeId: ptId,
      totalQuote: prev.totalQuote || ((selectedPt as any)?.basePrice != null ? (selectedPt as any).basePrice.toString() : prev.totalQuote),
    }));
    if (formErrors.prosthesisTypeId) setFormErrors((prev) => ({ ...prev, prosthesisTypeId: '' }));

    try {
      // Load processes for this prosthesis type in sequence order
      const assignments = await prosthesisTypeService.getProcesses(ptId);

      const items: ProcessFormItem[] = assignments.map((assign, idx) => ({
        tempId: `proc-${Date.now()}-${idx}`,
        processName: assign.process.name,
        technicianId: assign.process.defaultTechnicianId || '',
        sequence: assign.sequence,
        isVerification: false,
        status: 'NOT_STARTED',
      }));

      setProcessList(items);
    } catch (err) {
      toast.error(t('workOrders.failedLoadProcesses', { defaultValue: 'Failed to load processes for the selected prosthesis type' }));
      console.error(err);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // ─── Process List Manipulation ──────────────────
  const moveProcess = (index: number, direction: 'up' | 'down') => {
    const newList = [...processList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setProcessList(newList.map((p, i) => ({ ...p, sequence: i })));
  };

  const removeProcess = (index: number) => {
    const newList = processList.filter((_, i) => i !== index);
    setProcessList(newList.map((p, i) => ({ ...p, sequence: i })));
  };

  const updateProcessTechnician = (index: number, techId: string) => {
    setProcessList((prev) =>
      prev.map((p, i) => {
        if (i === index) {
          const updated = { ...p, technicianId: techId };
          if (p.isVerification) {
            updated.processName = techId ? 'Verification (Internal)' : 'Verification (External)';
          }
          return updated;
        }
        return p;
      }),
    );
  };

  const handleAvailableProcessChange = (procId: string) => {
    setNewProcessId(procId);
    const proc = availableProcesses.find((p) => p.id === procId);
    if (proc) {
      setNewProcessName(proc.name);
      setNewProcessTechnicianId(proc.defaultTechnicianId || '');
    }
  };

  const updateProcessStatus = (index: number, status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED') => {
    setProcessList((prev) =>
      prev.map((p, i) => (i === index ? { ...p, status } : p)),
    );
  };

  const handleAddProcess = () => {
    if (!newProcessName.trim()) {
      toast.error(t('workOrders.validationProcessRequired', { defaultValue: 'Process selection is required' }));
      return;
    }
    if (!newProcessTechnicianId) {
      toast.error(t('workOrders.validationTechRequired', { defaultValue: 'Technician assignment is required' }));
      return;
    }
    const newItem: ProcessFormItem = {
      tempId: `proc-${Date.now()}`,
      processName: newProcessName.trim(),
      technicianId: newProcessTechnicianId,
      sequence: processList.length,
      isVerification: false,
      status: 'NOT_STARTED',
    };
    setProcessList((prev) => [...prev, newItem]);
    setNewProcessId('');
    setNewProcessName('');
    setNewProcessTechnicianId('');
    setShowAddProcess(false);
  };

  const handleAddVerification = () => {
    if (verificationType === 'INTERNAL' && !verificationTechnicianId) {
      toast.error(t('workOrders.validationInternalVerifyTechRequired', { defaultValue: 'Technician assignment is required for internal verification' }));
      return;
    }

    const newItem: ProcessFormItem = {
      tempId: `ver-${Date.now()}`,
      processName: verificationType === 'INTERNAL' ? 'Verification (Internal)' : 'Verification (External)',
      technicianId: verificationType === 'INTERNAL' ? verificationTechnicianId : '',
      sequence: processList.length,
      isVerification: true,
      status: 'NOT_STARTED',
    };
    setProcessList((prev) => [...prev, newItem]);
    setShowAddVerificationForm(false);
    setVerificationTechnicianId('');
  };

  // ─── Submit ──────────────────────────
  const handleSubmit = async (action: 'create' | 'createAndAssign', skipConfirm = false) => {
    const isAssign = action === 'createAndAssign';
    if (!validateForm(isAssign)) return;

    if (isAssign && !skipConfirm) {
      setPendingAction('CREATE_ASSIGN');
      setShowConfirmPopup(true);
      return;
    }

    try {
      setSaving(true);
      const processes: CreateWorkOrderProcessPayload[] = processList.map((p) => ({
        processName: p.processName,
        technicianId: p.technicianId || undefined,
        sequence: p.sequence,
        isVerification: p.isVerification,
        status: p.status || 'NOT_STARTED',
      }));

      const payload: CreateWorkOrderPayload = {
        doctorId: form.doctorId,
        patient: form.patient,
        boxNumber: form.boxNumber || undefined,
        prosthesisTypeId: form.prosthesisTypeId,
        specification: isAdmin ? form.specification || undefined : undefined,
        color: form.color,
        notes: form.notes || undefined,
        totalQuote: form.totalQuote ? parseFloat(form.totalQuote) : undefined,
        initialPayment: form.initialPayment ? parseFloat(form.initialPayment) : undefined,
        branchId: form.branchId || undefined,
        action,
        processes,
      };

      await workOrderService.create(payload);
      toast.success(
        action === 'createAndAssign'
          ? t('workOrders.createAndAssignSuccess', { defaultValue: 'Work order created and assigned!' })
          : t('workOrders.createSuccess', { defaultValue: 'Work order created successfully!' }),
      );
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('workOrders.failedCreate', { defaultValue: 'Failed to create work order' });
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  // ─── View ────────────────────────────
  const handleViewOpen = (wo: WorkOrderListItem) => {
    setSelectedWO(wo);
    setShowViewModal(true);
  };

  // ─── Edit ────────────────────────────
  const handleEditOpen = async (wo: WorkOrderListItem) => {
    await loadReferenceData();
    setEditingWO(wo);
    const { userNotes } = parseNotesAndPayments(wo.notes);
    setForm({
      doctorId: wo.doctorId,
      patient: wo.patient,
      boxNumber: wo.boxNumber || '',
      fileNumber: wo.fileNumber || '',
      prosthesisTypeId: wo.prosthesisTypeId,
      specification: wo.specification || '',
      color: wo.color || '',
      notes: userNotes,
      totalQuote: wo.totalQuote != null ? wo.totalQuote.toString() : '',
      initialPayment: wo.initialPayment != null ? wo.initialPayment.toString() : '',
      paymentReferenceNumber: wo.paymentReferenceNumber || '',
      branchId: wo.branchId || '',
    });
    
    setModalTab('details');
    setFormStatus(wo.status);
    setNewProcessId('');
    setShowAddVerificationForm(false);
    setVerificationType('INTERNAL');
    setVerificationTechnicianId('');

    // Populate existing process steps and verification steps
    const items: ProcessFormItem[] = (wo.processes || []).map((p, idx) => {
      let processName = p.processName;
      if (p.isVerification) {
        processName = p.technicianId ? 'Verification (Internal)' : 'Verification (External)';
      }
      return {
        tempId: p.id || `proc-edit-${Date.now()}-${idx}`,
        processName,
        technicianId: p.technicianId || '',
        sequence: p.sequence,
        isVerification: p.isVerification,
        status: p.status,
        rework: (p as any).reworkActive || false,
        reworkCount: (p as any).reworkCount || 0,
        reworkActive: (p as any).reworkActive || false,
      };
    });
    setProcessList(items);
    
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleEditSubmit = async (isAssign = true, skipConfirm = false) => {
    if (!editingWO) return;
    if (!validateForm(isAssign)) return;

    if (isAssign && editingWO.status === 'CREATED' && !skipConfirm) {
      setPendingAction('EDIT_ASSIGN');
      setShowConfirmPopup(true);
      return;
    }

    try {
      setSaving(true);
      const { payments } = parseNotesAndPayments(editingWO.notes);
      const updatedNotes = stringifyNotesAndPayments(form.notes, payments);
      const payload: any = {
        doctorId: form.doctorId,
        patient: form.patient,
        boxNumber: form.boxNumber || undefined,
        fileNumber: form.fileNumber || undefined,
        prosthesisTypeId: form.prosthesisTypeId,
        specification: form.specification || undefined,
        color: form.color || undefined,
        notes: updatedNotes || undefined,
        totalQuote: form.totalQuote !== '' ? parseFloat(form.totalQuote) : 0,
        initialPayment: form.initialPayment ? parseFloat(form.initialPayment) : undefined,
        paymentReferenceNumber: form.paymentReferenceNumber || undefined,
        status: isAssign && editingWO.status === 'CREATED' ? 'ASSIGNED' : formStatus,
      };

      if (isAssign) {
        payload.processes = processList.map((p) => ({
          processName: p.processName,
          technicianId: p.technicianId || undefined,
          sequence: p.sequence,
          isVerification: p.isVerification,
          status: p.status || 'NOT_STARTED',
          rework: p.rework || false,
        }));
      }

      await workOrderService.update(editingWO.id, payload);
      toast.success(isAssign ? t('workOrders.assignSuccess', { defaultValue: 'Work order processes assigned successfully!' }) : t('workOrders.updateSuccess', { defaultValue: 'Work order updated successfully!' }));
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('workOrders.failedUpdate', { defaultValue: 'Failed to update work order' });
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ──────────────────────────
  const confirmDelete = (wo: WorkOrderListItem) => {
    setWoToDelete(wo);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!woToDelete) return;
    try {
      setDeleting(true);
      await workOrderService.delete(woToDelete.id);
      toast.success(t('workOrders.deleteSuccess', { defaultValue: 'Work order deleted successfully' }));
      setDeleteModalOpen(false);
      setWoToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('workOrders.failedDelete', { defaultValue: 'Failed to delete work order' }));
    } finally {
      setDeleting(false);
    }
  };

  const toggleSort = (field: 'folioNumber' | 'patient' | 'createdAt') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('workOrders.title', { defaultValue: 'Work Orders' })}</h1>
          <p className="page-header__subtitle">{t('workOrders.subtitle', { defaultValue: 'Manage dental lab work orders and workflows' })}</p>
        </div>
        {canCreate && (
          <button
            id="btn-add-work-order"
            className="btn btn--primary"
            onClick={handleCreateOpen}
          >
            <Plus size={18} />
            <span>{t('workOrders.newWorkOrder', { defaultValue: 'New Work Order' })}</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <ClipboardList size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">{t('workOrders.totalOrders', { defaultValue: 'Total Orders' })}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
            <Clock size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.assigned}</span>
            <span className="stat-card__label">{t('enums.workOrderStatus.ASSIGNED')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>
            <PlayCircle size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.inProgress}</span>
            <span className="stat-card__label">{t('enums.workOrderStatus.IN_PROGRESS')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--success">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.completed}</span>
            <span className="stat-card__label">{t('enums.workOrderStatus.COMPLETED')}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="table-toolbar" style={{ gap: '1rem' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-wo-search"
            type="text"
            className="form-input search-input"
            placeholder={t('workOrders.searchPlaceholder', { defaultValue: 'Search by folio, patient, doctor...' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-input__clear" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="table-toolbar__filters" style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {/* Branch Filter (Owner only) */}
          {isOwner && branches.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('common.branch')}:</span>
              <select
                className="form-input"
                style={{ width: '160px', height: '36px', padding: '0 0.75rem', borderRadius: '8px', fontSize: '0.8125rem' }}
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
              >
                <option value="ALL">{t('common.allBranches')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Chips */}
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {(['ALL', 'CREATED', 'ASSIGNED', 'IN_PROGRESS', 'INTERNAL_VERIFICATION', 'EXTERNAL_VERIFICATION', 'COMPLETED', 'FAILED', 'CANCELLED'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                className={`filter-chip ${selectedStatusFilter === s ? 'filter-chip--active' : ''}`}
                onClick={() => setSelectedStatusFilter(s)}
              >
                {s === 'ALL' ? t('common.all') : t(`enums.workOrderStatus.${s}`, { defaultValue: s })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>{t('workOrders.loading', { defaultValue: 'Loading work orders...' })}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
            <ClipboardList size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 className="empty-state__title">
            {workOrders.length === 0 ? t('workOrders.noWorkOrders', { defaultValue: 'No work orders yet' }) : t('workOrders.noMatching', { defaultValue: 'No matching work orders' })}
          </h3>
          <p className="empty-state__text">
            {workOrders.length === 0
              ? t('workOrders.createDesc', { defaultValue: 'Create your first work order to start managing lab workflows.' })
              : t('processesPage.adjustFilters', { defaultValue: 'Try adjusting your search or filter criteria.' })}
          </p>
          {workOrders.length === 0 && canCreate && (
            <button className="btn btn--primary" onClick={handleCreateOpen}>
              <Plus size={18} />
              <span>{t('workOrders.newWorkOrder', { defaultValue: 'New Work Order' })}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="work-orders-table">
            <thead>
              <tr>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('folioNumber')}>
                    {t('workOrders.folioNumber', { defaultValue: 'Folio #' })} <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('patient')}>
                    {t('workOrders.patient')} <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>{t('workOrders.doctor', { defaultValue: 'Doctor' })}</th>
                <th>{t('workOrders.prosthesisType')}</th>
                <th>{t('workOrders.color', { defaultValue: 'Color' })}</th>
                {isOwner && <th>{t('common.branch')}</th>}
                <th>{t('finance.quoted')}</th>
                <th>{t('workOrders.createdBy', { defaultValue: 'Created By' })}</th>
                <th>{t('common.status')}</th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('createdAt')}>
                    {t('common.created')} <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((wo) => {
                const sc = STATUS_CONFIG[wo.status] || STATUS_CONFIG.CREATED;
                return (
                  <tr key={wo.id}>
                    <td>
                      <div className="cell-primary">
                        <div className="cell-avatar" style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', fontSize: '0.6rem' }}>
                          <FileText size={14} />
                        </div>
                        <div>
                          <span className="cell-primary__name" style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {wo.folioNumber}
                            <span style={{
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: wo.isExternal ? 'rgba(99, 102, 241, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: wo.isExternal ? '#6366F1' : '#10B981',
                              textTransform: 'uppercase',
                              letterSpacing: '0.02em',
                              display: 'inline-block'
                            }}>
                              {wo.isExternal ? t('workOrders.external') : t('workOrders.internal')}
                            </span>
                          </span>
                          {wo.boxNumber && (
                            <span className="cell-primary__meta">{t('workOrders.boxNumber', { defaultValue: 'Box' })}: {wo.boxNumber}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cell-primary__name">{wo.patient}</span>
                    </td>
                    <td>
                      {wo.doctor ? (
                        <div>
                          <span className="cell-primary__name" style={{ fontSize: '0.8125rem' }}>{wo.doctor.name}</span>
                          {wo.doctor.clinicName && (
                            <span className="cell-primary__meta">{wo.doctor.clinicName}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {wo.prosthesisType ? (
                        <span className="cell-subdomain" style={{ textTransform: 'none', fontWeight: 600 }}>
                          {wo.prosthesisType.name}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{wo.color}</span>
                    </td>
                    {isOwner && (
                      <td>
                        {wo.branch ? (
                          <span className="cell-branch" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                            {wo.branch.name}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    )}
                    <td>
                      {wo.totalQuote != null ? (
                        <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                          {formatCurrency(wo.totalQuote)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {wo.createdBy ? (
                        <div>
                          <span className="cell-primary__name" style={{ fontSize: '0.8125rem' }}>
                            {wo.createdBy.firstName} {wo.createdBy.lastName}
                          </span>
                          <span className="cell-primary__meta" style={{ fontSize: '0.75rem' }}>
                            {t(`enums.userRole.${wo.createdBy.role}`, { defaultValue: wo.createdBy.role })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className="wo-status-badge"
                        style={{
                          color: sc.color,
                          backgroundColor: sc.bg,
                        }}
                      >
                        {sc.icon}
                        {t(`enums.workOrderStatus.${wo.status}`, { defaultValue: sc.label })}
                      </span>
                    </td>
                    <td>
                      <span className="cell-date">
                        {new Date(wo.createdAt).toLocaleDateString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn-action"
                          style={{ color: 'var(--accent-primary, #3B82F6)', backgroundColor: '#EFF6FF' }}
                          onClick={() => handleViewOpen(wo)}
                          title={t('workOrders.viewWorkOrder', { defaultValue: 'View Work Order' })}
                        >
                          <Eye size={15} />
                        </button>
                        {user?.role !== 'OWNER' && (
                        <button
                          className="btn-action"
                          style={{ color: '#8B5CF6', backgroundColor: '#F5F3FF', position: 'relative' }}
                          onClick={() => navigate(`/work-orders/${wo.id}?chatOnly=true`)}
                          title={t('workOrderChat.title')}
                        >
                          <MessageCircle size={15} />
                          {unreadChatCounts[wo.id] > 0 && (
                            <span style={{
                              position: 'absolute',
                              top: '-3px',
                              right: '-3px',
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              backgroundColor: '#EF4444',
                              border: '1.5px solid var(--bg-surface)'
                            }} />
                          )}
                        </button>
                        )}
                        <button
                          className="btn-action"
                          style={{ color: 'var(--text-heading, #1E293B)', backgroundColor: 'var(--bg-overlay, #F1F5F9)' }}
                          onClick={() => {
                            setQrWO(wo);
                            setShowQrModal(true);
                          }}
                          title={t('workOrders.printQRLabel', { defaultValue: 'Print QR Label' })}
                        >
                          <QrCode size={15} />
                        </button>
                        {(isAdmin || isOwner) && (
                          <button
                            className="btn-action"
                            style={{ color: '#D97706', backgroundColor: '#FEF3C7' }}
                            onClick={() => handleEditOpen(wo)}
                            title={t('workOrders.editWorkOrder')}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn-action btn-action--danger"
                            onClick={() => confirmDelete(wo)}
                            title={t('workOrders.deleteConfirm')}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowCreateModal(false)}>
          <div className="modal modal--xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('workOrders.newWorkOrder')}</h2>
                <p className="modal__subtitle">{t('workOrders.createWorkOrderSubtitle', { defaultValue: 'Create a new dental lab work order' })}</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowCreateModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs navigation */}
            <div style={{ padding: '0 1.75rem', marginTop: '1rem' }}>
              <div className="modal-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '1.5rem' }}>
                <button
                  type="button"
                  className={`modal-tab-btn ${modalTab === 'details' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => setModalTab('details')}
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: modalTab === 'details' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: modalTab === 'details' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  {t('workOrders.tabs.basicDetails', { defaultValue: '1. Order Details' })}
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${modalTab === 'processes' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => {
                    if (validateTab1Details()) {
                      setModalTab('processes');
                    }
                  }}
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: modalTab === 'processes' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: modalTab === 'processes' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>{t('workOrders.tabs.processSteps', { defaultValue: '2. Process Steps' })}</span>
                  {processList.length > 0 && (
                    <span style={{
                      fontSize: '0.75rem',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--accent-primary, #3B82F6)',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: 700
                    }}>
                      {processList.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${modalTab === 'payments' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => {
                    if (validateTab1Details()) {
                      setModalTab('payments');
                    }
                  }}
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: modalTab === 'payments' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: modalTab === 'payments' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  {t('workOrders.tabs.payments', { defaultValue: '3. Payments' })}
                </button>
              </div>
            </div>

            <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {modalTab === 'details' ? (
                <>
                  {/* Row 1: Doctor + Patient */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="select-wo-doctor">{t('workOrders.doctor', { defaultValue: 'Doctor' })} *</label>
                      <SearchableSelect
                        id="select-wo-doctor"
                        options={doctors.map((d) => ({
                          value: d.id,
                          label: `${d.name}${d.clinicName ? ` — ${d.clinicName}` : ''}`,
                        }))}
                        value={form.doctorId}
                        onChange={(val) => handleInputChange('doctorId', val)}
                        disabled={saving}
                        placeholder={t('doctors.selectDoctor', { defaultValue: 'Select a doctor' })}
                        error={!!formErrors.doctorId}
                      />
                      {formErrors.doctorId && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.doctorId}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-patient">{t('workOrders.patient')} *</label>
                      <input
                        id="input-wo-patient"
                        className={`form-input ${formErrors.patient ? 'form-input--error' : ''}`}
                        type="text"
                        placeholder={t('workOrders.patientPlaceholder', { defaultValue: 'e.g., John Doe' })}
                        value={form.patient}
                        onChange={(e) => handleInputChange('patient', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.patient && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.patient}</span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Folio Number + File Number + Box Number */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-folio">{t('workOrders.folioNumber', { defaultValue: 'Folio Number' })}</label>
                      <input
                        id="input-wo-folio"
                        className="form-input"
                        type="text"
                        value={generatedFolio || t('workOrders.generating', { defaultValue: 'Generating...' })}
                        disabled
                        style={{ backgroundColor: 'var(--bg-muted, #F3F4F6)', cursor: 'not-allowed', fontStyle: 'italic', fontWeight: 600 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-file">{t('workOrders.fileNumber', { defaultValue: 'File Number' })}</label>
                      <input
                        id="input-wo-file"
                        className="form-input"
                        type="text"
                        placeholder={t('workOrders.fileNumberPlaceholder', { defaultValue: 'e.g., FILE-101' })}
                        value={form.fileNumber}
                        onChange={(e) => handleInputChange('fileNumber', e.target.value)}
                        disabled={saving}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-box">{t('workOrders.boxNumber', { defaultValue: 'Box Number' })}</label>
                      <input
                        id="input-wo-box"
                        className="form-input"
                        type="text"
                        placeholder={t('workOrders.boxNumberPlaceholder', { defaultValue: 'e.g., BOX-42' })}
                        value={form.boxNumber}
                        onChange={(e) => handleInputChange('boxNumber', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Row 3: Prosthesis Type */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="select-wo-prosthesis">{t('workOrders.prosthesisType')} *</label>
                    <SearchableSelect
                      id="select-wo-prosthesis"
                      options={prosthesisTypes.map((pt) => ({
                        value: pt.id,
                        label: pt.name,
                      }))}
                      value={form.prosthesisTypeId}
                      onChange={handleProsthesisTypeChange}
                      disabled={saving}
                      placeholder={t('workOrders.selectProsthesisType', { defaultValue: 'Select prosthesis type' })}
                      error={!!formErrors.prosthesisTypeId}
                    />
                    {formErrors.prosthesisTypeId && (
                      <span className="form-error"><AlertCircle size={12} /> {formErrors.prosthesisTypeId}</span>
                    )}
                  </div>

                  {/* Specification (Admin only) */}
                  {isAdmin && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-spec">{t('workOrders.specification', { defaultValue: 'Specification' })} *</label>
                      <textarea
                        id="input-wo-spec"
                        className={`form-input ${formErrors.specification ? 'form-input--error' : ''}`}
                        style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                        placeholder={t('workOrders.specificationPlaceholder', { defaultValue: 'Color, shade, units, material details...' })}
                        value={form.specification}
                        onChange={(e) => handleInputChange('specification', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.specification && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.specification}</span>
                      )}
                    </div>
                  )}

                  {/* Color (Mandatory) */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-wo-color">{t('workOrders.color', { defaultValue: 'Color' })} *</label>
                    <input
                      id="input-wo-color"
                      className={`form-input ${formErrors.color ? 'form-input--error' : ''}`}
                      type="text"
                      placeholder={t('workOrders.colorPlaceholder', { defaultValue: 'e.g., A1, A2, B1...' })}
                      value={form.color}
                      onChange={(e) => handleInputChange('color', e.target.value)}
                      disabled={saving}
                    />
                    {formErrors.color && (
                      <span className="form-error"><AlertCircle size={12} /> {formErrors.color}</span>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-wo-notes">{t('workOrders.notes', { defaultValue: 'Notes' })}</label>
                    <textarea
                      id="input-wo-notes"
                      className="form-input"
                      style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                      placeholder={t('workOrders.notesPlaceholder', { defaultValue: 'Additional notes or instructions...' })}
                      value={form.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  {/* Branch select (Owner only) */}
                  {isOwner && branches.length > 0 && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="select-wo-branch">{t('common.branch')} *</label>
                      <SearchableSelect
                        id="select-wo-branch"
                        options={branches.map((b) => ({
                          value: b.id,
                          label: `${b.name} (${b.code})`,
                        }))}
                        value={form.branchId}
                        onChange={(val) => handleInputChange('branchId', val)}
                        disabled={saving}
                        placeholder={t('branches.selectBranch', { defaultValue: 'Select a branch' })}
                        error={!!formErrors.branchId}
                      />
                      {formErrors.branchId && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.branchId}</span>
                      )}
                    </div>
                  )}
                </>
              ) : modalTab === 'payments' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Row: Total Quote + Initial Payment */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-quote">{t('workOrders.totalQuote', { defaultValue: 'Total Quote' })} ({i18n.language?.startsWith('es') ? '$' : '₹'}) *</label>
                      <input
                        id="input-wo-quote"
                        className={`form-input ${formErrors.totalQuote ? 'form-input--error' : ''}`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t('workOrders.quotePlaceholder', { defaultValue: 'e.g., 5000' })}
                        value={form.totalQuote}
                        onChange={(e) => handleInputChange('totalQuote', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.totalQuote && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.totalQuote}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-payment">{t('workOrders.initialPayment', { defaultValue: 'Initial Payment' })} ({i18n.language?.startsWith('es') ? '$' : '₹'})</label>
                      <input
                        id="input-wo-payment"
                        className="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t('workOrders.paymentPlaceholder', { defaultValue: 'e.g., 2000' })}
                        value={form.initialPayment}
                        onChange={(e) => handleInputChange('initialPayment', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Payment Reference Number */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-wo-pay-ref">{t('workOrders.paymentReferenceNumber', { defaultValue: 'Payment Reference Number' })}</label>
                    <input
                      id="input-wo-pay-ref"
                      className="form-input"
                      type="text"
                      placeholder={t('workOrders.paymentReferenceNumberPlaceholder', { defaultValue: 'e.g., REF-98765' })}
                      value={form.paymentReferenceNumber}
                      onChange={(e) => handleInputChange('paymentReferenceNumber', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : (
                /* Tab 2: Process assignment only */
                <div className="wo-process-section" style={{ margin: 0, border: 'none', background: 'transparent', padding: 0 }}>
                  <div className="wo-process-section__header" style={{ marginBottom: '1rem' }}>
                    <h3 className="wo-process-section__title">
                      {t('workOrders.processStepsAssignment', { defaultValue: 'Process Steps Assignment' })}
                      {processList.length > 0 && (
                        <span className="wo-process-section__count">{processList.length}</span>
                      )}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          setShowAddProcess(true);
                          setShowAddVerificationForm(false);
                          setNewProcessId('');
                          setNewProcessName('');
                          setNewProcessTechnicianId('');
                        }}
                        disabled={saving || showAddProcess}
                      >
                        <PlusCircle size={14} />
                        <span>{t('workOrders.addProcess', { defaultValue: 'Add Process' })}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          setShowAddVerificationForm(true);
                          setShowAddProcess(false);
                          setVerificationType('INTERNAL');
                          setVerificationTechnicianId(getDefaultAdminId());
                        }}
                        disabled={saving || showAddVerificationForm}
                      >
                        <ShieldPlus size={14} />
                        <span>{t('workOrders.addVerification', { defaultValue: 'Add Verification' })}</span>
                      </button>
                    </div>
                  </div>

                  {formErrors.processes && (
                    <span className="form-error" style={{ marginBottom: '0.75rem', display: 'block' }}>
                      <AlertCircle size={12} /> {formErrors.processes}
                    </span>
                  )}

                  {processList.length === 0 && !showAddProcess && !showAddVerificationForm ? (
                    <div className="wo-process-empty" style={{ border: '1px dashed var(--border)', borderRadius: '8px' }}>
                      <FileText size={24} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                      <span>{t('workOrders.noProcessesLoaded', { defaultValue: 'No processes loaded yet. Choose prosthesis type in details or add processes.' })}</span>
                    </div>
                  ) : (
                    <div className="wo-process-list">
                      {processList.map((proc, idx) => (
                        <div
                          key={proc.tempId}
                          className={`wo-process-item ${proc.isVerification ? 'wo-process-item--verification' : ''}`}
                        >
                          <div className="wo-process-item__order">
                            <span className="wo-process-item__number">{idx + 1}</span>
                          </div>

                          <div className="wo-process-item__name" style={{ flex: '1', minWidth: '120px' }}>
                            <span>
                              {proc.isVerification
                                ? proc.technicianId
                                  ? t('workOrders.internalVerification', { defaultValue: 'Verification (Internal)' })
                                  : t('workOrders.externalVerification', { defaultValue: 'Verification (External)' })
                                : proc.processName}
                            </span>
                            {proc.isVerification && (
                              <span className="wo-process-item__tag" style={{
                                backgroundColor: proc.technicianId ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                color: proc.technicianId ? '#8B5CF6' : '#6366F1'
                              }}>
                                {proc.technicianId ? t('workOrders.internalVerification', { defaultValue: 'Internal Verification' }) : t('workOrders.externalVerification', { defaultValue: 'External Verification' })}
                              </span>
                            )}
                          </div>

                          {/* Technician Assignment */}
                          <div className="wo-process-item__technician" style={{ width: '200px' }}>
                            {proc.isVerification && !proc.technicianId ? (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '32px',
                                fontSize: '0.75rem',
                                color: 'var(--accent-primary)',
                                fontWeight: 700,
                                padding: '0 0.5rem',
                                backgroundColor: 'var(--bg-muted, #F3F4F6)',
                                borderRadius: '6px',
                                border: '1px solid var(--border)'
                              }}>
                                {(() => {
                                  const selectedDoc = doctors.find((d) => d.id === form.doctorId);
                                  return selectedDoc ? selectedDoc.name : t('doctors.selectedDoctor', { defaultValue: 'Selected Doctor' });
                                })()}
                              </div>
                            ) : (
                              <SearchableSelect
                                id={`select-proc-tech-${proc.tempId}`}
                                options={(proc.isVerification ? admins : technicians).map((u) => ({
                                  value: u.id,
                                  label: `${u.firstName} ${u.lastName}`,
                                }))}
                                value={proc.technicianId}
                                onChange={(val) => updateProcessTechnician(idx, val)}
                                disabled={saving}
                                placeholder={proc.isVerification ? t('workOrders.selectAdmin', { defaultValue: 'Select admin' }) : t('workOrders.selectTechnician', { defaultValue: 'Select technician' })}
                              />
                            )}
                          </div>

                          {/* Process Status selection */}
                          <div className="wo-process-item__status" style={{ width: '150px' }}>
                            <SearchableSelect
                              id={`select-proc-status-${proc.tempId}`}
                              options={[
                                { value: 'NOT_STARTED', label: t('enums.processStatus.NOT_STARTED', { defaultValue: 'Not Started' }) },
                                { value: 'IN_PROGRESS', label: t('enums.processStatus.IN_PROGRESS', { defaultValue: 'In Progress' }) },
                                { value: 'PAUSED', label: t('enums.processStatus.PAUSED', { defaultValue: 'Paused' }) },
                                { value: 'COMPLETED', label: t('enums.processStatus.COMPLETED', { defaultValue: 'Completed' }) },
                                { value: 'FAILED', label: t('enums.processStatus.FAILED', { defaultValue: 'Failed' }) },
                                { value: 'CANCELLED', label: t('enums.processStatus.CANCELLED', { defaultValue: 'Cancelled' }) },
                              ]}
                              value={proc.status || 'NOT_STARTED'}
                              onChange={(val) => updateProcessStatus(idx, val as any)}
                              disabled={saving}
                              placeholder={t('common.selectStatus', { defaultValue: 'Select status' })}
                            />
                          </div>

                          <div className="wo-process-item__actions">
                            <button
                              type="button"
                              className="wo-process-item__btn"
                              onClick={() => moveProcess(idx, 'up')}
                              disabled={idx === 0 || saving}
                              title={t('common.moveUp', { defaultValue: 'Move up' })}
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="wo-process-item__btn"
                              onClick={() => moveProcess(idx, 'down')}
                              disabled={idx === processList.length - 1 || saving}
                              title={t('common.moveDown', { defaultValue: 'Move down' })}
                            >
                              <ChevronDown size={14} />
                            </button>
                            <button
                              type="button"
                              className="wo-process-item__btn wo-process-item__btn--danger"
                              onClick={() => removeProcess(idx)}
                              disabled={saving}
                              title={t('common.remove')}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline Add Process Form */}
                  {showAddProcess && (
                    <div className="wo-process-add" style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-muted, #F3F4F6)' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <SearchableSelect
                            id="select-add-process-master"
                            options={availableProcesses.map((p) => ({
                              value: p.id,
                              label: `${p.name} (${p.processArea})`,
                            }))}
                            value={newProcessId}
                            onChange={handleAvailableProcessChange}
                            disabled={saving}
                            placeholder={t('processesPage.selectProcess', { defaultValue: 'Select process...' })}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                          <SearchableSelect
                            id="select-add-process-tech"
                            options={technicians.map((t) => ({
                              value: t.id,
                              label: `${t.firstName} ${t.lastName}`,
                            }))}
                            value={newProcessTechnicianId}
                            onChange={setNewProcessTechnicianId}
                            disabled={saving}
                            placeholder={t('workOrders.selectTechnician', { defaultValue: 'Select technician' })}
                          />
                        </div>
                        <button type="button" className="btn btn--primary btn--sm" onClick={handleAddProcess}>
                          {t('common.add')}
                        </button>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setShowAddProcess(false); setNewProcessId(''); setNewProcessName(''); setNewProcessTechnicianId(''); }}>
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Add Verification Form */}
                  {showAddVerificationForm && (
                    <div className="wo-process-add" style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-muted, #F3F4F6)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('workOrders.addVerificationStep', { defaultValue: 'Add Verification Step' })}</span>
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', flexWrap: 'wrap', alignItems: 'center' }}>
                          <select
                            className="form-input form-input--sm"
                            value={verificationType}
                            onChange={(e) => {
                              const val = e.target.value as 'INTERNAL' | 'EXTERNAL';
                              setVerificationType(val);
                              if (val === 'INTERNAL') {
                                setVerificationTechnicianId(getDefaultAdminId());
                              } else {
                                setVerificationTechnicianId('');
                              }
                            }}
                            style={{ flex: 1, minWidth: '120px' }}
                          >
                            <option value="INTERNAL">{t('workOrders.internalVerification', { defaultValue: 'Internal Verification' })}</option>
                            <option value="EXTERNAL">{t('workOrders.externalVerification', { defaultValue: 'External Verification' })}</option>
                          </select>

                          {verificationType === 'INTERNAL' ? (
                            <div style={{ flex: 1, minWidth: '180px' }}>
                              <SearchableSelect
                                id="select-add-verification-admin"
                                options={admins.map((a) => ({
                                  value: a.id,
                                  label: `${a.firstName} ${a.lastName}`,
                                }))}
                                value={verificationTechnicianId}
                                onChange={setVerificationTechnicianId}
                                disabled={saving}
                                placeholder={t('workOrders.selectAdmin', { defaultValue: 'Select admin' })}
                              />
                            </div>
                          ) : (
                            <div style={{
                              flex: 1,
                              minWidth: '120px',
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              padding: '0 0.5rem',
                              fontStyle: 'italic'
                            }}>
                              {t('common.assigned', { defaultValue: 'Assigned' })}: {(() => {
                                const selectedDoc = doctors.find((d) => d.id === form.doctorId);
                                return selectedDoc ? `${selectedDoc.name} (${t('common.doctor')})` : t('doctors.selectedDoctor', { defaultValue: 'Selected Doctor' });
                              })()}
                            </div>
                          )}

                          <button type="button" className="btn btn--primary btn--sm" onClick={handleAddVerification}>
                            {t('common.add')}
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setShowAddVerificationForm(false); setVerificationTechnicianId(''); }}>
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons depending on Active Tab */}
            <div className="modal__footer" style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {modalTab === 'details' ? (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowCreateModal(false)}
                    disabled={saving}
                  >
                    {t('common.cancel')}
                  </button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      id="btn-wo-create"
                      type="button"
                      className="btn btn--outline"
                      onClick={() => handleSubmit('create')}
                      disabled={saving}
                    >
                      {saving ? (
                        <><Loader2 size={16} className="spinner" /><span>{t('common.saving', { defaultValue: 'Saving...' })}</span></>
                      ) : (
                        <span>Save</span>
                      )}
                    </button>
                    <button
                      id="btn-wo-create-assign"
                      type="button"
                      className="btn btn--primary"
                      onClick={() => {
                        if (validateTab1Details()) {
                          setModalTab('processes');
                        }
                      }}
                      disabled={saving}
                    >
                      <span>Save &amp; Assign</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setModalTab('details')}
                    disabled={saving}
                  >
                    {t('common.back', { defaultValue: 'Back' })}
                  </button>
                  <button
                    id="btn-wo-confirm"
                    type="button"
                    className="btn btn--primary"
                    onClick={() => handleSubmit('createAndAssign')}
                    disabled={saving}
                  >
                    {saving ? (
                      <><Loader2 size={16} className="spinner" /><span>{t('common.saving', { defaultValue: 'Saving...' })}</span></>
                    ) : (
                      <span>{t('common.confirm', { defaultValue: 'Confirm' })}</span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && woToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('workOrders.deleteTitle', { defaultValue: 'Delete Work Order' })}</h2>
                <p className="modal__subtitle">
                  {t('workOrders.deleteConfirmText', { folio: woToDelete.folioNumber, defaultValue: `Are you sure you want to delete work order ${woToDelete.folioNumber}?` })}
                </p>
              </div>
              <button
                className="modal__close"
                onClick={() => !deleting && setDeleteModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal__body">
              <div style={{
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--danger-light, #FEF2F2)',
                border: '1px solid var(--danger, #EF4444)',
                fontSize: '0.875rem',
                color: 'var(--danger, #EF4444)',
              }}>
                <strong>{t('common.warning', { defaultValue: 'Warning' })}:</strong> {t('workOrders.deleteWarningText', { defaultValue: 'This action cannot be undone. All process steps and data associated with this work order will be permanently removed.' })}
              </div>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <><Loader2 size={16} className="spinner" /><span>{t('common.deleting', { defaultValue: 'Deleting...' })}</span></>
                ) : (
                  <><Trash2 size={16} /><span>{t('common.delete')}</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      <ViewWorkOrderModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        workOrderId={selectedWO?.id || null}
        onUpdate={(updatedWO) => {
          if (updatedWO) {
            setWorkOrders((prev) =>
              prev.map((wo) =>
                wo.id === updatedWO.id
                  ? {
                       ...wo,
                       initialPayment: updatedWO.initialPayment,
                       notes: updatedWO.notes,
                       status: updatedWO.status,
                     }
                  : wo
              )
            );
          }
          fetchData();
        }}
      />

      {/* Edit Modal */}
      {showEditModal && editingWO && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal modal--xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('workOrders.editTitle', { defaultValue: 'Edit Work Order' })}</h2>
                <p className="modal__subtitle">{t('workOrders.editSubtitle', { folio: editingWO.folioNumber, defaultValue: `Edit work order ${editingWO.folioNumber}` })}</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowEditModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs navigation */}
            <div style={{ padding: '0 1.75rem', marginTop: '1rem' }}>
              <div className="modal-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '1.5rem' }}>
                <button
                  type="button"
                  className={`modal-tab-btn ${modalTab === 'details' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => setModalTab('details')}
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: modalTab === 'details' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: modalTab === 'details' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  {t('workOrders.tabs.basicDetails', { defaultValue: '1. Order Details' })}
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${modalTab === 'processes' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => {
                    if (validateTab1Details()) {
                      setModalTab('processes');
                    }
                  }}
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: modalTab === 'processes' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: modalTab === 'processes' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>{t('workOrders.tabs.processSteps', { defaultValue: '2. Process Steps' })}</span>
                  {processList.length > 0 && (
                    <span style={{
                      fontSize: '0.75rem',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--accent-primary, #3B82F6)',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontWeight: 700
                    }}>
                      {processList.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${modalTab === 'payments' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => {
                    if (validateTab1Details()) {
                      setModalTab('payments');
                    }
                  }}
                  style={{
                    padding: '0.75rem 0.5rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: modalTab === 'payments' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: modalTab === 'payments' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  {t('workOrders.tabs.payments', { defaultValue: '3. Payments' })}
                </button>
              </div>
            </div>

            <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {modalTab === 'details' ? (
                <>
                  {/* Row 1: Doctor + Patient */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-doctor">{t('workOrders.doctor', { defaultValue: 'Doctor' })} *</label>
                      <SearchableSelect
                        id="edit-wo-doctor"
                        options={doctors.map((d) => ({
                          value: d.id,
                          label: `${d.name}${d.clinicName ? ` — ${d.clinicName}` : ''}`,
                        }))}
                        value={form.doctorId}
                        onChange={(val) => handleInputChange('doctorId', val)}
                        disabled={saving}
                        placeholder={t('doctors.selectDoctor', { defaultValue: 'Select a doctor' })}
                        error={!!formErrors.doctorId}
                      />
                      {formErrors.doctorId && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.doctorId}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-patient">{t('workOrders.patient')} *</label>
                      <input
                        id="edit-wo-patient"
                        className={`form-input ${formErrors.patient ? 'form-input--error' : ''}`}
                        type="text"
                        placeholder={t('workOrders.patientPlaceholder', { defaultValue: 'e.g., John Doe' })}
                        value={form.patient}
                        onChange={(e) => handleInputChange('patient', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.patient && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.patient}</span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Folio Number + File Number + Box Number */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-folio">{t('workOrders.folioNumber', { defaultValue: 'Folio Number' })}</label>
                      <input
                        id="edit-wo-folio"
                        className="form-input"
                        type="text"
                        value={editingWO.folioNumber}
                        disabled
                        style={{ backgroundColor: 'var(--bg-muted, #F3F4F6)', cursor: 'not-allowed', fontStyle: 'italic', fontWeight: 600 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-file">{t('workOrders.fileNumber', { defaultValue: 'File Number' })}</label>
                      <input
                        id="edit-wo-file"
                        className="form-input"
                        type="text"
                        placeholder={t('workOrders.fileNumberPlaceholder', { defaultValue: 'e.g., FILE-101' })}
                        value={form.fileNumber}
                        onChange={(e) => handleInputChange('fileNumber', e.target.value)}
                        disabled={saving}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-box">{t('workOrders.boxNumber', { defaultValue: 'Box Number' })}</label>
                      <input
                        id="edit-wo-box"
                        className="form-input"
                        type="text"
                        placeholder={t('workOrders.boxNumberPlaceholder', { defaultValue: 'e.g., BOX-42' })}
                        value={form.boxNumber}
                        onChange={(e) => handleInputChange('boxNumber', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Row 3: Status Dropdown Selection */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-wo-status">{t('workOrders.status', { defaultValue: 'Work Order Status' })}</label>
                    <select
                      id="edit-wo-status"
                      className="form-input"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      disabled={saving}
                      style={{ fontWeight: 600 }}
                    >
                      <option value="CREATED">{t('enums.workOrderStatus.CREATED')}</option>
                      <option value="ASSIGNED">{t('enums.workOrderStatus.ASSIGNED')}</option>
                      <option value="IN_PROGRESS">{t('enums.workOrderStatus.IN_PROGRESS')}</option>
                      <option value="INTERNAL_VERIFICATION">{t('enums.workOrderStatus.INTERNAL_VERIFICATION')}</option>
                      <option value="EXTERNAL_VERIFICATION">{t('enums.workOrderStatus.EXTERNAL_VERIFICATION')}</option>
                      <option value="COMPLETED">{t('enums.workOrderStatus.COMPLETED')}</option>
                      <option value="FAILED">{t('enums.workOrderStatus.FAILED')}</option>
                      <option value="CANCELLED">{t('enums.workOrderStatus.CANCELLED')}</option>
                    </select>
                  </div>

                  {/* Row 4: Prosthesis Type */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-wo-prosthesis">{t('workOrders.prosthesisType')} *</label>
                    <SearchableSelect
                      id="edit-wo-prosthesis"
                      options={prosthesisTypes.map((pt) => ({
                        value: pt.id,
                        label: pt.name,
                      }))}
                      value={form.prosthesisTypeId}
                      onChange={handleProsthesisTypeChange}
                      disabled={saving}
                      placeholder={t('workOrders.selectProsthesisType', { defaultValue: 'Select prosthesis type' })}
                      error={!!formErrors.prosthesisTypeId}
                    />
                    {formErrors.prosthesisTypeId && (
                      <span className="form-error"><AlertCircle size={12} /> {formErrors.prosthesisTypeId}</span>
                    )}
                  </div>

                  {/* Specification (Admin only) */}
                  {isAdmin && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-spec">{t('workOrders.specification', { defaultValue: 'Specification' })} *</label>
                      <textarea
                        id="edit-wo-spec"
                        className={`form-input ${formErrors.specification ? 'form-input--error' : ''}`}
                        style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                        placeholder={t('workOrders.specificationPlaceholder', { defaultValue: 'Color, shade, units, material details...' })}
                        value={form.specification}
                        onChange={(e) => handleInputChange('specification', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.specification && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.specification}</span>
                      )}
                    </div>
                  )}

                  {/* Color (Mandatory) */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-wo-color">{t('workOrders.color', { defaultValue: 'Color' })} *</label>
                    <input
                      id="edit-wo-color"
                      className={`form-input ${formErrors.color ? 'form-input--error' : ''}`}
                      type="text"
                      placeholder={t('workOrders.colorPlaceholder', { defaultValue: 'e.g., A1, A2, B1...' })}
                      value={form.color}
                      onChange={(e) => handleInputChange('color', e.target.value)}
                      disabled={saving}
                    />
                    {formErrors.color && (
                      <span className="form-error"><AlertCircle size={12} /> {formErrors.color}</span>
                    )}
                  </div>

                  {/* Note History Thread */}
                  <NoteHistoryThread
                    notesList={editingWO.notesList || []}
                    currentUserId={user?.id || ''}
                    userRole={user?.role || ''}
                    onAddNote={handleAddNote}
                    onUpdateNote={handleUpdateNote}
                    onDeleteNote={handleDeleteNote}
                  />

                  {/* Branch select (Owner only) */}
                  {isOwner && branches.length > 0 && (
                    <div className="form-group" style={{ marginTop: '0.75rem' }}>
                      <label className="form-label" htmlFor="edit-wo-branch">{t('common.branch')} *</label>
                      <SearchableSelect
                        id="edit-wo-branch"
                        options={branches.map((b) => ({
                          value: b.id,
                          label: `${b.name} (${b.code})`,
                        }))}
                        value={form.branchId}
                        onChange={(val) => handleInputChange('branchId', val)}
                        disabled={saving}
                        placeholder={t('branches.selectBranch', { defaultValue: 'Select a branch' })}
                        error={!!formErrors.branchId}
                      />
                      {formErrors.branchId && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.branchId}</span>
                      )}
                    </div>
                  )}
                </>
              ) : modalTab === 'payments' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Row: Total Quote + Initial Payment */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-quote">{t('workOrders.totalQuote', { defaultValue: 'Total Quote' })} ({i18n.language?.startsWith('es') ? '$' : '₹'}) *</label>
                      <input
                        id="edit-wo-quote"
                        className={`form-input ${formErrors.totalQuote ? 'form-input--error' : ''}`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t('workOrders.quotePlaceholder', { defaultValue: 'e.g., 5000' })}
                        value={form.totalQuote}
                        onChange={(e) => handleInputChange('totalQuote', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.totalQuote && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.totalQuote}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-payment">{t('workOrders.initialPayment', { defaultValue: 'Initial Payment' })} ({i18n.language?.startsWith('es') ? '$' : '₹'})</label>
                      <input
                        id="edit-wo-payment"
                        className="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t('workOrders.paymentPlaceholder', { defaultValue: 'e.g., 2000' })}
                        value={form.initialPayment}
                        onChange={(e) => handleInputChange('initialPayment', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Payment Reference Number */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-wo-pay-ref">{t('workOrders.paymentReferenceNumber', { defaultValue: 'Payment Reference Number' })}</label>
                    <input
                      id="edit-wo-pay-ref"
                      className="form-input"
                      type="text"
                      placeholder={t('workOrders.paymentReferenceNumberPlaceholder', { defaultValue: 'e.g., REF-98765' })}
                      value={form.paymentReferenceNumber}
                      onChange={(e) => handleInputChange('paymentReferenceNumber', e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : (
                /* Tab 2: Process Steps Assignment */
                <div className="wo-process-section" style={{ margin: 0, border: 'none', background: 'transparent', padding: 0 }}>
                  {(() => {
                    const hasStartedSteps = processList.some((p) => p.status && p.status !== 'NOT_STARTED');
                    return (
                      <>
                        {hasStartedSteps && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            fontSize: '0.8125rem',
                            color: 'var(--accent-primary, #3B82F6)',
                            marginBottom: '1rem'
                          }}>
                            <Lock size={15} />
                            <span><strong>{t('workOrders.workflowStepsLockedTitle', { defaultValue: 'Workflow Steps Locked:' })}</strong> {t('workOrders.workflowStepsLockedDesc', { defaultValue: 'Some steps have already started. You cannot modify, reorder, or delete started steps, but you can still manage, reorder, delete, or assign unstarted steps, and add new ones.' })}</span>
                          </div>
                        )}
                        <div className="wo-process-section__header" style={{ marginBottom: '1rem' }}>
                          <h3 className="wo-process-section__title">
                            {t('workOrders.processStepsAssignment', { defaultValue: 'Process Steps Assignment' })}
                            {processList.length > 0 && (
                              <span className="wo-process-section__count">{processList.length}</span>
                            )}
                          </h3>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => {
                                setShowAddProcess(true);
                                setShowAddVerificationForm(false);
                                setNewProcessId('');
                                setNewProcessName('');
                                setNewProcessTechnicianId('');
                              }}
                              disabled={saving || showAddProcess}
                            >
                              <PlusCircle size={14} />
                              <span>{t('workOrders.addProcess', { defaultValue: 'Add Process' })}</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => {
                                setShowAddVerificationForm(true);
                                setShowAddProcess(false);
                                setVerificationType('INTERNAL');
                                setVerificationTechnicianId(getDefaultAdminId());
                              }}
                              disabled={saving || showAddVerificationForm}
                            >
                              <ShieldPlus size={14} />
                              <span>{t('workOrders.addVerification', { defaultValue: 'Add Verification' })}</span>
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {formErrors.processes && (
                    <span className="form-error" style={{ marginBottom: '0.75rem', display: 'block' }}>
                      <AlertCircle size={12} /> {formErrors.processes}
                    </span>
                  )}

                  {processList.length === 0 && !showAddProcess && !showAddVerificationForm ? (
                    <div className="wo-process-empty" style={{ border: '1px dashed var(--border)', borderRadius: '8px' }}>
                      <FileText size={24} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                      <span>{t('workOrders.noProcessesLoaded', { defaultValue: 'No processes loaded yet. Choose prosthesis type in details or add processes.' })}</span>
                    </div>
                  ) : (
                    <div className="wo-process-list">
                      {processList.map((proc, idx) => {
                        const isStepStarted = proc.status && proc.status !== 'NOT_STARTED';
                        const canMoveUp = idx > 0 && !isStepStarted && !(processList[idx - 1].status && processList[idx - 1].status !== 'NOT_STARTED');
                        const canMoveDown = idx < processList.length - 1 && !isStepStarted && !(processList[idx + 1].status && processList[idx + 1].status !== 'NOT_STARTED');
                        const canRemove = !isStepStarted;
                        return (
                          <div
                            key={proc.tempId}
                            className={`wo-process-item ${proc.isVerification ? 'wo-process-item--verification' : ''}`}
                          >
                            <div className="wo-process-item__order">
                              <span className="wo-process-item__number">{idx + 1}</span>
                            </div>

                            <div className="wo-process-item__name" style={{ flex: '1', minWidth: '120px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span>
                              {proc.isVerification
                                ? proc.technicianId
                                  ? t('workOrders.internalVerification', { defaultValue: 'Verification (Internal)' })
                                  : t('workOrders.externalVerification', { defaultValue: 'Verification (External)' })
                                : proc.processName}
                            </span>
                              {proc.isVerification && (
                                <span className="wo-process-item__tag" style={{
                                  backgroundColor: proc.technicianId ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                  color: proc.technicianId ? '#8B5CF6' : '#6366F1'
                                }}>
                                  {proc.technicianId ? t('workOrders.internalVerification', { defaultValue: 'Internal Verification' }) : t('workOrders.externalVerification', { defaultValue: 'External Verification' })}
                                </span>
                              )}
                              {formStatus !== 'COMPLETED' && (proc.status === 'COMPLETED' || proc.reworkActive) && !proc.isVerification && (
                                <label style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.375rem',
                                  fontSize: '0.75rem',
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(239, 68, 68, 0.15)',
                                  marginLeft: 'auto',
                                  fontWeight: 700
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={!!proc.rework}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setProcessList((prev) =>
                                        prev.map((p, i) => (i === idx ? { ...p, rework: checked } : p))
                                      );
                                    }}
                                    style={{
                                      width: '13px',
                                      height: '13px',
                                      cursor: 'pointer',
                                      accentColor: '#EF4444'
                                    }}
                                  />
                                  <span>{t('workOrders.rework', { defaultValue: 'Rework' })}</span>
                                </label>
                              )}
                            </div>

                            {/* Technician Assignment */}
                            <div className="wo-process-item__technician" style={{ width: '200px' }}>
                              {proc.isVerification && !proc.technicianId ? (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  height: '32px',
                                  fontSize: '0.75rem',
                                  color: 'var(--accent-primary)',
                                  fontWeight: 700,
                                  padding: '0 0.5rem',
                                  backgroundColor: 'var(--bg-muted, #F3F4F6)',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)'
                                }}>
                                  {(() => {
                                    const selectedDoc = doctors.find((d) => d.id === form.doctorId);
                                    return selectedDoc ? selectedDoc.name : t('doctors.selectedDoctor', { defaultValue: 'Selected Doctor' });
                                  })()}
                                </div>
                              ) : (
                                <SearchableSelect
                                  id={`select-edit-proc-tech-${proc.tempId}`}
                                  options={(proc.isVerification ? admins : technicians).map((u) => ({
                                    value: u.id,
                                    label: `${u.firstName} ${u.lastName}`,
                                  }))}
                                  value={proc.technicianId}
                                  onChange={(val) => updateProcessTechnician(idx, val)}
                                  disabled={saving || isStepStarted}
                                  placeholder={proc.isVerification ? t('workOrders.selectAdmin', { defaultValue: 'Select admin' }) : t('workOrders.selectTechnician', { defaultValue: 'Select technician' })}
                                />
                              )}
                            </div>

                            {/* Process Status selection */}
                            <div className="wo-process-item__status" style={{ width: '150px' }}>
                              <SearchableSelect
                                id={`select-edit-proc-status-${proc.tempId}`}
                                options={[
                                  { value: 'NOT_STARTED', label: t('enums.processStatus.NOT_STARTED', { defaultValue: 'Not Started' }) },
                                  { value: 'IN_PROGRESS', label: t('enums.processStatus.IN_PROGRESS', { defaultValue: 'In Progress' }) },
                                  { value: 'PAUSED', label: t('enums.processStatus.PAUSED', { defaultValue: 'Paused' }) },
                                  { value: 'COMPLETED', label: t('enums.processStatus.COMPLETED', { defaultValue: 'Completed' }) },
                                  { value: 'FAILED', label: t('enums.processStatus.FAILED', { defaultValue: 'Failed' }) },
                                  { value: 'CANCELLED', label: t('enums.processStatus.CANCELLED', { defaultValue: 'Cancelled' }) },
                                ]}
                                value={proc.status || 'NOT_STARTED'}
                                onChange={(val) => updateProcessStatus(idx, val as any)}
                                disabled={saving || isStepStarted}
                                placeholder={t('common.selectStatus', { defaultValue: 'Select status' })}
                              />
                            </div>

                            <div className="wo-process-item__actions">
                              <button
                                type="button"
                                className="wo-process-item__btn"
                                onClick={() => moveProcess(idx, 'up')}
                                disabled={saving || !canMoveUp}
                                title="Move up"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                className="wo-process-item__btn"
                                onClick={() => moveProcess(idx, 'down')}
                                disabled={saving || !canMoveDown}
                                title="Move down"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                type="button"
                                className="wo-process-item__btn wo-process-item__btn--danger"
                                onClick={() => removeProcess(idx)}
                                disabled={saving || !canRemove}
                                title="Remove"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline Add Process Form */}
                  {showAddProcess && (
                    <div className="wo-process-add" style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-muted, #F3F4F6)' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <SearchableSelect
                            id="select-edit-add-process-master"
                            options={availableProcesses.map((p) => ({
                              value: p.id,
                              label: `${p.name} (${p.processArea})`,
                            }))}
                            value={newProcessId}
                            onChange={handleAvailableProcessChange}
                            disabled={saving}
                            placeholder="Select process..."
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: '180px' }}>
                          <SearchableSelect
                            id="select-edit-add-process-tech"
                            options={technicians.map((t) => ({
                              value: t.id,
                              label: `${t.firstName} ${t.lastName}`,
                            }))}
                            value={newProcessTechnicianId}
                            onChange={setNewProcessTechnicianId}
                            disabled={saving}
                            placeholder="Select technician"
                          />
                        </div>
                        <button type="button" className="btn btn--primary btn--sm" onClick={handleAddProcess}>
                          Add
                        </button>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setShowAddProcess(false); setNewProcessId(''); setNewProcessName(''); setNewProcessTechnicianId(''); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Add Verification Form */}
                  {showAddVerificationForm && (
                    <div className="wo-process-add" style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-muted, #F3F4F6)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Add Verification Step</span>
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', flexWrap: 'wrap', alignItems: 'center' }}>
                          <select
                            className="form-input form-input--sm"
                            value={verificationType}
                            onChange={(e) => {
                              const val = e.target.value as 'INTERNAL' | 'EXTERNAL';
                              setVerificationType(val);
                              if (val === 'INTERNAL') {
                                setVerificationTechnicianId(getDefaultAdminId());
                              } else {
                                setVerificationTechnicianId('');
                              }
                            }}
                            style={{ flex: 1, minWidth: '120px' }}
                          >
                            <option value="INTERNAL">Internal Verification</option>
                            <option value="EXTERNAL">External Verification</option>
                          </select>

                          {verificationType === 'INTERNAL' ? (
                            <div style={{ flex: 1, minWidth: '180px' }}>
                              <SearchableSelect
                                id="select-edit-add-verification-admin"
                                options={admins.map((a) => ({
                                  value: a.id,
                                  label: `${a.firstName} ${a.lastName}`,
                                }))}
                                value={verificationTechnicianId}
                                onChange={setVerificationTechnicianId}
                                disabled={saving}
                                placeholder="Select admin"
                              />
                            </div>
                          ) : (
                            <div style={{
                              flex: 1,
                              minWidth: '120px',
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              padding: '0 0.5rem',
                              fontStyle: 'italic'
                            }}>
                              Assigned: {(() => {
                                const selectedDoc = doctors.find((d) => d.id === form.doctorId);
                                return selectedDoc ? `${selectedDoc.name} (Doctor)` : 'Selected Doctor';
                              })()}
                            </div>
                          )}

                          <button type="button" className="btn btn--primary btn--sm" onClick={handleAddVerification}>
                            Add
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setShowAddVerificationForm(false); setVerificationTechnicianId(''); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Footer Buttons depending on Active Tab */}
            <div className="modal__footer" style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {modalTab === 'details' ? (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setShowEditModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      id="btn-wo-edit-save"
                      type="button"
                      className="btn btn--outline"
                      onClick={() => handleEditSubmit(false)}
                      disabled={saving}
                    >
                      {saving ? (
                        <><Loader2 size={16} className="spinner" /><span>Saving...</span></>
                      ) : (
                        <span>Save</span>
                      )}
                    </button>
                    {editingWO.status === 'CREATED' && (
                      <button
                        id="btn-wo-edit-save-assign"
                        type="button"
                        className="btn btn--primary"
                        onClick={() => {
                          if (validateForm(false)) {
                            setModalTab('processes');
                          }
                        }}
                        disabled={saving}
                      >
                        <span>Save &amp; Assign</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setModalTab('details')}
                    disabled={saving}
                  >
                    Back
                  </button>
                  <button
                    id="btn-wo-edit-confirm"
                    type="button"
                    className="btn btn--primary"
                    onClick={() => handleEditSubmit(true)}
                    disabled={saving}
                  >
                    {saving ? (
                      <><Loader2 size={16} className="spinner" /><span>Saving...</span></>
                    ) : (
                      <span>Save</span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visual Confirmation Dialog for Assignment */}
      {showConfirmPopup && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setShowConfirmPopup(false)}>
          <div className="modal" style={{ maxWidth: '480px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary, #3B82F6)' }}>
                  <ShieldCheck size={20} />
                  <span>Confirm Assignment</span>
                </h2>
                <p className="modal__subtitle">Activate workflow and lock structure</p>
              </div>
              <button
                className="modal__close"
                onClick={() => setShowConfirmPopup(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1.5rem' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                Are you sure you want to assign these processes and activate this Work Order?
              </p>
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                fontSize: '0.75rem',
                color: '#D97706',
                lineHeight: '1.4'
              }}>
                <strong>Warning:</strong> Activating this Work Order locks the process sequence structure. You will not be able to add, delete, or reorder steps afterwards. The first technician in the sequence will receive an instant notification.
              </div>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowConfirmPopup(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={async () => {
                  setShowConfirmPopup(false);
                  if (pendingAction === 'CREATE_ASSIGN') {
                    await handleSubmit('createAndAssign', true);
                  } else if (pendingAction === 'EDIT_ASSIGN') {
                    await handleEditSubmit(true, true);
                  }
                  setPendingAction(null);
                }}
              >
                Confirm &amp; Activate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable QR Modal */}
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

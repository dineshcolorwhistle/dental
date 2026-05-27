import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  workOrderService,
  doctorService,
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
import { useAuth } from '../context';
import { Pagination, SearchableSelect } from '../components';

type StatusFilter = 'ALL' | 'CREATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'INTERNAL_VERIFICATION' | 'EXTERNAL_VERIFICATION' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  CREATED: { label: 'Created', color: '#6B7280', bg: '#F3F4F6', icon: <CircleDot size={12} /> },
  ASSIGNED: { label: 'Assigned', color: '#3B82F6', bg: '#EFF6FF', icon: <Clock size={12} /> },
  IN_PROGRESS: { label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB', icon: <PlayCircle size={12} /> },
  INTERNAL_VERIFICATION: { label: 'Internal Verification', color: '#8B5CF6', bg: '#F5F3FF', icon: <ShieldCheck size={12} /> },
  EXTERNAL_VERIFICATION: { label: 'External Verification', color: '#6366F1', bg: '#EEF2FF', icon: <ShieldCheck size={12} /> },
  COMPLETED: { label: 'Completed', color: '#10B981', bg: '#ECFDF5', icon: <CheckCircle2 size={12} /> },
  FAILED: { label: 'Failed', color: '#EF4444', bg: '#FEF2F2', icon: <AlertCircle size={12} /> },
  CANCELLED: { label: 'Cancelled', color: '#94A3B8', bg: '#F8FAFC', icon: <X size={12} /> },
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
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

export function WorkOrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER';
  const isLabAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';
  const canCreate = isAdmin;

  // List state
  const [workOrders, setWorkOrders] = useState<WorkOrderListItem[]>([]);
  const [viewTab, setViewTab] = useState<'general' | 'process' | 'payment'>('general');
  const [showAddFundForm, setShowAddFundForm] = useState(false);
  const [addFundAmount, setAddFundAmount] = useState('');
  const [addFundNotes, setAddFundNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilter>('ALL');
  const [branches, setBranches] = useState<BranchListItem[]>([]);

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

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWO, setEditingWO] = useState<WorkOrderListItem | null>(null);

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
    prosthesisTypeId: '',
    specification: '',
    notes: '',
    totalQuote: '',
    initialPayment: '',
    branchId: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [processList, setProcessList] = useState<ProcessFormItem[]>([]);
  const [generatedFolio, setGeneratedFolio] = useState('');

  // Tab Wizard States
  const [modalTab, setModalTab] = useState<'details' | 'processes'>('details');
  const [formStatus, setFormStatus] = useState<string>('CREATED');

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
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;
      const [woData, branchData] = await Promise.all([
        workOrderService.getAll(branchScope),
        isAdmin ? Promise.resolve([]) : branchService.getAll(),
      ]);
      setWorkOrders(woData);
      setBranches(branchData.filter((b) => b.isActive));
    } catch (err) {
      toast.error('Failed to load work orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.branchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      toast.error('Failed to load reference data');
      console.error(err);
    }
  }, [isAdmin, user?.branchId]);

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

  // ─── Form Handling ──────────────────────────
  const validateForm = (checkProcesses = true): boolean => {
    const errors: Record<string, string> = {};
    if (!form.doctorId) errors.doctorId = 'Doctor is required';
    if (!form.patient.trim()) errors.patient = 'Patient name is required';
    if (!form.prosthesisTypeId) errors.prosthesisTypeId = 'Prosthesis type is required';
    if (!isAdmin && branches.length > 0 && !form.branchId) errors.branchId = 'Branch is required';
    if (!form.specification.trim()) errors.specification = 'Specification is required';
    if (!form.totalQuote.trim()) {
      errors.totalQuote = 'Total quote is required';
    } else if (parseFloat(form.totalQuote) <= 0) {
      errors.totalQuote = 'Total quote must be greater than 0';
    }
    if (checkProcesses) {
      if (processList.length === 0) {
        errors.processes = 'At least one process step is required';
      } else {
        const hasUnassignedProcess = processList.some((p) => !p.technicianId && !(p.isVerification && !p.technicianId));
        if (hasUnassignedProcess) {
          errors.processes = 'All process steps must be assigned to a technician';
        }
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOpen = async () => {
    await loadReferenceData();
    const branchId = isAdmin ? user?.branchId || '' : '';
    setForm({
      doctorId: '',
      patient: '',
      boxNumber: '',
      prosthesisTypeId: '',
      specification: '',
      notes: '',
      totalQuote: '',
      initialPayment: '',
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
    setForm((prev) => ({ ...prev, prosthesisTypeId: ptId }));
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
      toast.error('Failed to load processes for the selected prosthesis type');
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
      prev.map((p, i) => (i === index ? { ...p, technicianId: techId } : p)),
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

  const updateProcessStatus = (index: number, status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED') => {
    setProcessList((prev) =>
      prev.map((p, i) => (i === index ? { ...p, status } : p)),
    );
  };

  const handleAddProcess = () => {
    if (!newProcessName.trim()) {
      toast.error('Process selection is required');
      return;
    }
    if (!newProcessTechnicianId) {
      toast.error('Technician assignment is required');
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
      toast.error('Technician assignment is required for internal verification');
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
  const handleSubmit = async (action: 'create' | 'createAndAssign') => {
    const isAssign = action === 'createAndAssign';
    if (!validateForm(isAssign)) return;

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
          ? 'Work order created and assigned!'
          : 'Work order created successfully!',
      );
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to create work order';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  // ─── View ────────────────────────────
  const handleViewOpen = async (wo: WorkOrderListItem) => {
    try {
      setViewTab('general');
      setShowAddFundForm(false);
      setAddFundAmount('');
      setAddFundNotes('');
      setSelectedWO(wo);
      setShowViewModal(true);
      const detailedWo = await workOrderService.getById(wo.id);
      setSelectedWO(detailedWo);
    } catch (err) {
      toast.error('Failed to load work order details');
      console.error(err);
    }
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
      prosthesisTypeId: wo.prosthesisTypeId,
      specification: wo.specification || '',
      notes: userNotes,
      totalQuote: wo.totalQuote != null ? wo.totalQuote.toString() : '',
      initialPayment: wo.initialPayment != null ? wo.initialPayment.toString() : '',
      branchId: wo.branchId || '',
    });
    
    setModalTab('details');
    setFormStatus(wo.status);
    setNewProcessId('');
    setShowAddVerificationForm(false);
    setVerificationType('INTERNAL');
    setVerificationTechnicianId('');

    // Populate existing process steps and verification steps
    const items: ProcessFormItem[] = (wo.processes || []).map((p, idx) => ({
      tempId: p.id || `proc-edit-${Date.now()}-${idx}`,
      processName: p.processName,
      technicianId: p.technicianId || '',
      sequence: p.sequence,
      isVerification: p.isVerification,
      status: p.status,
    }));
    setProcessList(items);
    
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleEditSubmit = async (isAssign = true) => {
    if (!editingWO) return;
    const errors: Record<string, string> = {};
    if (!form.doctorId) errors.doctorId = 'Doctor is required';
    if (!form.patient.trim()) errors.patient = 'Patient name is required';
    if (!form.prosthesisTypeId) errors.prosthesisTypeId = 'Prosthesis type is required';
    if (!form.specification.trim()) errors.specification = 'Specification is required';
    if (!form.totalQuote.trim()) {
      errors.totalQuote = 'Total quote is required';
    } else if (parseFloat(form.totalQuote) <= 0) {
      errors.totalQuote = 'Total quote must be greater than 0';
    }
    
    if (isAssign) {
      if (processList.length === 0) {
        errors.processes = 'At least one process step is required';
      } else {
        const hasUnassignedProcess = processList.some((p) => !p.technicianId && !(p.isVerification && !p.technicianId));
        if (hasUnassignedProcess) {
          errors.processes = 'All process steps must be assigned to a technician';
        }
      }
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSaving(true);
      const { payments } = parseNotesAndPayments(editingWO.notes);
      const updatedNotes = stringifyNotesAndPayments(form.notes, payments);
      const payload: any = {
        doctorId: form.doctorId,
        patient: form.patient,
        boxNumber: form.boxNumber || undefined,
        prosthesisTypeId: form.prosthesisTypeId,
        specification: form.specification || undefined,
        notes: updatedNotes || undefined,
        totalQuote: form.totalQuote ? parseFloat(form.totalQuote) : undefined,
        initialPayment: form.initialPayment ? parseFloat(form.initialPayment) : undefined,
        status: isAssign && editingWO.status === 'CREATED' ? 'ASSIGNED' : formStatus,
      };

      if (isAssign) {
        payload.processes = processList.map((p) => ({
          processName: p.processName,
          technicianId: p.technicianId || undefined,
          sequence: p.sequence,
          isVerification: p.isVerification,
          status: p.status || 'NOT_STARTED',
        }));
      }

      await workOrderService.update(editingWO.id, payload);
      toast.success(isAssign ? 'Work order processes assigned successfully!' : 'Work order updated successfully!');
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to update work order';
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
      toast.success('Work order deleted successfully');
      setDeleteModalOpen(false);
      setWoToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete work order');
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
          <h1 className="page-header__title">Work Orders</h1>
          <p className="page-header__subtitle">Manage dental lab work orders and workflows</p>
        </div>
        {canCreate && (
          <button
            id="btn-add-work-order"
            className="btn btn--primary"
            onClick={handleCreateOpen}
          >
            <Plus size={18} />
            <span>New Work Order</span>
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
            <span className="stat-card__label">Total Orders</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
            <Clock size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.assigned}</span>
            <span className="stat-card__label">Assigned</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon" style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>
            <PlayCircle size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.inProgress}</span>
            <span className="stat-card__label">In Progress</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--success">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.completed}</span>
            <span className="stat-card__label">Completed</span>
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
            placeholder="Search by folio, patient, doctor..."
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
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>Branch:</span>
              <select
                className="form-input"
                style={{ width: '160px', height: '36px', padding: '0 0.75rem', borderRadius: '8px', fontSize: '0.8125rem' }}
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
              >
                <option value="ALL">All Branches</option>
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
                {s === 'ALL' ? 'All' : STATUS_CONFIG[s]?.label || s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>Loading work orders...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
            <ClipboardList size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 className="empty-state__title">
            {workOrders.length === 0 ? 'No work orders yet' : 'No matching work orders'}
          </h3>
          <p className="empty-state__text">
            {workOrders.length === 0
              ? 'Create your first work order to start managing lab workflows.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {workOrders.length === 0 && canCreate && (
            <button className="btn btn--primary" onClick={handleCreateOpen}>
              <Plus size={18} />
              <span>New Work Order</span>
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
                    Folio # <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('patient')}>
                    Patient <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>Doctor</th>
                <th>Prosthesis Type</th>
                {isOwner && <th>Branch</th>}
                <th>Quote</th>
                <th>Status</th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('createdAt')}>
                    Created <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>Actions</th>
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
                          <span className="cell-primary__name" style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.03em' }}>
                            {wo.folioNumber}
                          </span>
                          {wo.boxNumber && (
                            <span className="cell-primary__meta">Box: {wo.boxNumber}</span>
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
                          ₹{wo.totalQuote.toLocaleString('en-IN')}
                        </span>
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
                        {sc.label}
                      </span>
                    </td>
                    <td>
                      <span className="cell-date">
                        {new Date(wo.createdAt).toLocaleDateString('en-IN', {
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
                          title="View Work Order"
                        >
                          <Eye size={15} />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              className="btn-action"
                              style={{ color: '#D97706', backgroundColor: '#FEF3C7' }}
                              onClick={() => handleEditOpen(wo)}
                              title="Edit Work Order"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="btn-action btn-action--danger"
                              onClick={() => confirmDelete(wo)}
                              title="Delete Work Order"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
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
                <h2 className="modal__title">New Work Order</h2>
                <p className="modal__subtitle">Create a new dental lab work order</p>
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
                  1. Basic Details
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${modalTab === 'processes' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => {
                    if (validateForm(false)) {
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
                  <span>2. Process Steps</span>
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
              </div>
            </div>

            <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {modalTab === 'details' ? (
                <>
                  {/* Row 1: Doctor + Patient */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="select-wo-doctor">Doctor *</label>
                      <SearchableSelect
                        id="select-wo-doctor"
                        options={doctors.map((d) => ({
                          value: d.id,
                          label: `${d.name}${d.clinicName ? ` — ${d.clinicName}` : ''}`,
                        }))}
                        value={form.doctorId}
                        onChange={(val) => handleInputChange('doctorId', val)}
                        disabled={saving}
                        placeholder="Select a doctor"
                        error={!!formErrors.doctorId}
                      />
                      {formErrors.doctorId && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.doctorId}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-patient">Patient *</label>
                      <input
                        id="input-wo-patient"
                        className={`form-input ${formErrors.patient ? 'form-input--error' : ''}`}
                        type="text"
                        placeholder="e.g., John Doe"
                        value={form.patient}
                        onChange={(e) => handleInputChange('patient', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.patient && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.patient}</span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Folio Number + Box Number */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-folio">Folio Number</label>
                      <input
                        id="input-wo-folio"
                        className="form-input"
                        type="text"
                        value={generatedFolio || 'Generating...'}
                        disabled
                        style={{ backgroundColor: 'var(--bg-muted, #F3F4F6)', cursor: 'not-allowed', fontStyle: 'italic', fontWeight: 600 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-box">Box Number</label>
                      <input
                        id="input-wo-box"
                        className="form-input"
                        type="text"
                        placeholder="e.g., BOX-42"
                        value={form.boxNumber}
                        onChange={(e) => handleInputChange('boxNumber', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Row 3: Prosthesis Type */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="select-wo-prosthesis">Prosthesis Type *</label>
                    <SearchableSelect
                      id="select-wo-prosthesis"
                      options={prosthesisTypes.map((pt) => ({
                        value: pt.id,
                        label: pt.name,
                      }))}
                      value={form.prosthesisTypeId}
                      onChange={handleProsthesisTypeChange}
                      disabled={saving}
                      placeholder="Select prosthesis type"
                      error={!!formErrors.prosthesisTypeId}
                    />
                    {formErrors.prosthesisTypeId && (
                      <span className="form-error"><AlertCircle size={12} /> {formErrors.prosthesisTypeId}</span>
                    )}
                  </div>

                  {/* Specification (Admin only) */}
                  {isAdmin && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-spec">Specification *</label>
                      <textarea
                        id="input-wo-spec"
                        className={`form-input ${formErrors.specification ? 'form-input--error' : ''}`}
                        style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                        placeholder="Color, shade, units, material details..."
                        value={form.specification}
                        onChange={(e) => handleInputChange('specification', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.specification && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.specification}</span>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-wo-notes">Notes</label>
                    <textarea
                      id="input-wo-notes"
                      className="form-input"
                      style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                      placeholder="Additional notes or instructions..."
                      value={form.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  {/* Row: Total Quote + Initial Payment */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-quote">Total Quote (₹) *</label>
                      <input
                        id="input-wo-quote"
                        className={`form-input ${formErrors.totalQuote ? 'form-input--error' : ''}`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g., 5000"
                        value={form.totalQuote}
                        onChange={(e) => handleInputChange('totalQuote', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.totalQuote && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.totalQuote}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="input-wo-payment">Initial Payment (₹)</label>
                      <input
                        id="input-wo-payment"
                        className="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g., 2000"
                        value={form.initialPayment}
                        onChange={(e) => handleInputChange('initialPayment', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Branch select (Owner only) */}
                  {isOwner && branches.length > 0 && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="select-wo-branch">Branch *</label>
                      <SearchableSelect
                        id="select-wo-branch"
                        options={branches.map((b) => ({
                          value: b.id,
                          label: `${b.name} (${b.code})`,
                        }))}
                        value={form.branchId}
                        onChange={(val) => handleInputChange('branchId', val)}
                        disabled={saving}
                        placeholder="Select a branch"
                        error={!!formErrors.branchId}
                      />
                      {formErrors.branchId && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.branchId}</span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Tab 2: Process assignment only */
                <div className="wo-process-section" style={{ margin: 0, border: 'none', background: 'transparent', padding: 0 }}>
                  <div className="wo-process-section__header" style={{ marginBottom: '1rem' }}>
                    <h3 className="wo-process-section__title">
                      Process Steps Assignment
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
                        <span>Add Process</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          setShowAddVerificationForm(true);
                          setShowAddProcess(false);
                          setVerificationType('INTERNAL');
                          setVerificationTechnicianId('');
                        }}
                        disabled={saving || showAddVerificationForm}
                      >
                        <ShieldPlus size={14} />
                        <span>Add Verification</span>
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
                      <span>No processes loaded yet. Choose prosthesis type in details or add processes.</span>
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
                            <span>{proc.processName}</span>
                            {proc.isVerification && (
                              <span className="wo-process-item__tag" style={{
                                backgroundColor: proc.technicianId ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                color: proc.technicianId ? '#8B5CF6' : '#6366F1'
                              }}>
                                {proc.technicianId ? 'Internal' : 'External'} Verification
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
                                  return selectedDoc ? selectedDoc.name : 'Selected Doctor';
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
                                placeholder={`Select ${proc.isVerification ? 'admin' : 'technician'}`}
                              />
                            )}
                          </div>

                          {/* Process Status selection */}
                          <div className="wo-process-item__status" style={{ width: '150px' }}>
                            <SearchableSelect
                              id={`select-proc-status-${proc.tempId}`}
                              options={[
                                { value: 'NOT_STARTED', label: 'Not Started' },
                                { value: 'IN_PROGRESS', label: 'In Progress' },
                                { value: 'COMPLETED', label: 'Completed' },
                                { value: 'FAILED', label: 'Failed' },
                                { value: 'CANCELLED', label: 'Cancelled' },
                              ]}
                              value={proc.status || 'NOT_STARTED'}
                              onChange={(val) => updateProcessStatus(idx, val as any)}
                              disabled={saving}
                              placeholder="Select status"
                            />
                          </div>

                          <div className="wo-process-item__actions">
                            <button
                              type="button"
                              className="wo-process-item__btn"
                              onClick={() => moveProcess(idx, 'up')}
                              disabled={idx === 0 || saving}
                              title="Move up"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="wo-process-item__btn"
                              onClick={() => moveProcess(idx, 'down')}
                              disabled={idx === processList.length - 1 || saving}
                              title="Move down"
                            >
                              <ChevronDown size={14} />
                            </button>
                            <button
                              type="button"
                              className="wo-process-item__btn wo-process-item__btn--danger"
                              onClick={() => removeProcess(idx)}
                              disabled={saving}
                              title="Remove"
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
                            placeholder="Select process..."
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
                            onChange={(e) => setVerificationType(e.target.value as any)}
                            style={{ flex: 1, minWidth: '120px' }}
                          >
                            <option value="INTERNAL">Internal Verification</option>
                            <option value="EXTERNAL">External Verification</option>
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
                    onClick={() => setShowCreateModal(false)}
                    disabled={saving}
                  >
                    Cancel
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
                        <><Loader2 size={16} className="spinner" /><span>Saving...</span></>
                      ) : (
                        <span>Save</span>
                      )}
                    </button>
                    <button
                      id="btn-wo-create-assign"
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
                    id="btn-wo-confirm"
                    type="button"
                    className="btn btn--primary"
                    onClick={() => handleSubmit('createAndAssign')}
                    disabled={saving}
                  >
                    {saving ? (
                      <><Loader2 size={16} className="spinner" /><span>Saving...</span></>
                    ) : (
                      <span>Confirm</span>
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
                <h2 className="modal__title">Delete Work Order</h2>
                <p className="modal__subtitle">
                  Are you sure you want to delete work order <strong>{woToDelete.folioNumber}</strong>?
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
                <strong>Warning:</strong> This action cannot be undone. All process steps and data associated with this work order will be permanently removed.
              </div>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <><Loader2 size={16} className="spinner" /><span>Deleting...</span></>
                ) : (
                  <><Trash2 size={16} /><span>Delete</span></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedWO && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal" style={{ maxWidth: '1020px', width: '95%', height: 'auto', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
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
                onClick={() => setShowViewModal(false)}
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
                  const ivIdx = processes.findIndex(p => p.isVerification && p.technicianId);
                  activeIndex = ivIdx !== -1 ? ivIdx : processes.length - 1;
                } else if (selectedWO.status === 'EXTERNAL_VERIFICATION') {
                  const evIdx = processes.findIndex(p => p.isVerification && !p.technicianId);
                  activeIndex = evIdx !== -1 ? evIdx : processes.length - 1;
                } else if (selectedWO.status === 'IN_PROGRESS') {
                  const ipIdx = processes.findIndex(p => p.status === 'IN_PROGRESS');
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
                                  <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {processes.map((proc, idx) => {
                                  const stepStatus = proc.status || 'NOT_STARTED';

                                  const formatDate = (dateStr: string | Date) => {
                                    return new Date(dateStr).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    });
                                  };

                                  const baseDate = new Date(selectedWO.createdAt);
                                  let startTimeStr = '—';
                                  let endTimeStr = '—';

                                  if (stepStatus === 'COMPLETED') {
                                    const start = new Date(baseDate.getTime() + idx * 2 * 60 * 60 * 1000);
                                    const end = new Date(start.getTime() + 1.5 * 60 * 60 * 1000);
                                    startTimeStr = formatDate(start);
                                    endTimeStr = formatDate(end);
                                  } else if (stepStatus === 'IN_PROGRESS') {
                                    const start = new Date(baseDate.getTime() + idx * 2 * 60 * 60 * 1000);
                                    startTimeStr = formatDate(start);
                                    endTimeStr = 'Running...';
                                  }
                                  
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
                                  } else if (stepStatus === 'FAILED') {
                                    badgeColor = '#EF4444';
                                    badgeBg = 'rgba(239, 68, 68, 0.08)';
                                    statusLabel = 'Failed';
                                  } else if (stepStatus === 'CANCELLED') {
                                    badgeColor = '#94A3B8';
                                    badgeBg = 'rgba(148, 163, 184, 0.08)';
                                    statusLabel = 'Cancelled';
                                  }

                                  return (
                                    <tr key={proc.id} style={{
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

                  const handleAddFund = async () => {
                    const amount = parseFloat(addFundAmount);
                    if (isNaN(amount) || amount <= 0) {
                      toast.error('Please enter a valid amount greater than 0');
                      return;
                    }
                    if (amount > balance) {
                      toast.error(`Amount cannot exceed the remaining balance of ₹${balance.toLocaleString('en-IN')}`);
                      return;
                    }

                    try {
                      setSubmittingPayment(true);
                      const { userNotes, payments: existingPayments } = parseNotesAndPayments(selectedWO.notes);
                      const newPayments: PaymentHistoryItem[] = [
                        ...existingPayments,
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
                      setWorkOrders(prev => prev.map(wo => wo.id === updatedWO.id ? { ...wo, initialPayment: updatedWO.initialPayment, notes: updatedWO.notes } : wo));
                      
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
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>₹{quote.toLocaleString('en-IN')}</span>
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
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success, #10B981)' }}>₹{initialPay.toLocaleString('en-IN')}</span>
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
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: balance > 0 ? '#EF4444' : 'var(--text-muted)' }}>₹{balance.toLocaleString('en-IN')}</span>
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
                                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Amount (₹) *</label>
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
                                  ₹{((selectedWO.initialPayment || 0) - payments.reduce((acc, curr) => acc + curr.amount, 0)).toLocaleString('en-IN')}
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
                              {payments.map((payment, pidx) => (
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
                                    ₹{payment.amount.toLocaleString('en-IN')}
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
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingWO && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal modal--xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Edit Work Order</h2>
                <p className="modal__subtitle">Edit work order <strong>{editingWO.folioNumber}</strong></p>
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
                  1. Basic Details
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${modalTab === 'processes' ? 'modal-tab-btn--active' : ''}`}
                  onClick={() => {
                    if (validateForm(false)) {
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
                  <span>2. Process Steps</span>
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
              </div>
            </div>

            <div className="modal__body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {modalTab === 'details' ? (
                <>
                  {/* Row 1: Doctor + Patient */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-doctor">Doctor *</label>
                      <SearchableSelect
                        id="edit-wo-doctor"
                        options={doctors.map((d) => ({
                          value: d.id,
                          label: `${d.name}${d.clinicName ? ` — ${d.clinicName}` : ''}`,
                        }))}
                        value={form.doctorId}
                        onChange={(val) => handleInputChange('doctorId', val)}
                        disabled={saving}
                        placeholder="Select a doctor"
                        error={!!formErrors.doctorId}
                      />
                      {formErrors.doctorId && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.doctorId}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-patient">Patient *</label>
                      <input
                        id="edit-wo-patient"
                        className={`form-input ${formErrors.patient ? 'form-input--error' : ''}`}
                        type="text"
                        placeholder="e.g., John Doe"
                        value={form.patient}
                        onChange={(e) => handleInputChange('patient', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.patient && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.patient}</span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Folio Number + Box Number */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-folio">Folio Number</label>
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
                      <label className="form-label" htmlFor="edit-wo-box">Box Number</label>
                      <input
                        id="edit-wo-box"
                        className="form-input"
                        type="text"
                        placeholder="e.g., BOX-42"
                        value={form.boxNumber}
                        onChange={(e) => handleInputChange('boxNumber', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Row 3: Status Dropdown Selection */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-wo-status">Work Order Status</label>
                    <select
                      id="edit-wo-status"
                      className="form-input"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      disabled={saving}
                      style={{ fontWeight: 600 }}
                    >
                      <option value="CREATED">Created</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="INTERNAL_VERIFICATION">Internal Verification</option>
                      <option value="EXTERNAL_VERIFICATION">External Verification</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="FAILED">Failed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>

                  {/* Row 4: Prosthesis Type */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-wo-prosthesis">Prosthesis Type *</label>
                    <SearchableSelect
                      id="edit-wo-prosthesis"
                      options={prosthesisTypes.map((pt) => ({
                        value: pt.id,
                        label: pt.name,
                      }))}
                      value={form.prosthesisTypeId}
                      onChange={handleProsthesisTypeChange}
                      disabled={saving}
                      placeholder="Select prosthesis type"
                      error={!!formErrors.prosthesisTypeId}
                    />
                    {formErrors.prosthesisTypeId && (
                      <span className="form-error"><AlertCircle size={12} /> {formErrors.prosthesisTypeId}</span>
                    )}
                  </div>

                  {/* Specification (Admin only) */}
                  {isAdmin && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-spec">Specification *</label>
                      <textarea
                        id="edit-wo-spec"
                        className={`form-input ${formErrors.specification ? 'form-input--error' : ''}`}
                        style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                        placeholder="Color, shade, units, material details..."
                        value={form.specification}
                        onChange={(e) => handleInputChange('specification', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.specification && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.specification}</span>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-wo-notes">Notes</label>
                    <textarea
                      id="edit-wo-notes"
                      className="form-input"
                      style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                      placeholder="Additional notes or instructions..."
                      value={form.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  {/* Row: Total Quote + Initial Payment */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-quote">Total Quote (₹) *</label>
                      <input
                        id="edit-wo-quote"
                        className={`form-input ${formErrors.totalQuote ? 'form-input--error' : ''}`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g., 5000"
                        value={form.totalQuote}
                        onChange={(e) => handleInputChange('totalQuote', e.target.value)}
                        disabled={saving}
                      />
                      {formErrors.totalQuote && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.totalQuote}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-payment">Initial Payment (₹)</label>
                      <input
                        id="edit-wo-payment"
                        className="form-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="e.g., 2000"
                        value={form.initialPayment}
                        onChange={(e) => handleInputChange('initialPayment', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* Branch select (Owner only) */}
                  {isOwner && branches.length > 0 && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-wo-branch">Branch *</label>
                      <SearchableSelect
                        id="edit-wo-branch"
                        options={branches.map((b) => ({
                          value: b.id,
                          label: `${b.name} (${b.code})`,
                        }))}
                        value={form.branchId}
                        onChange={(val) => handleInputChange('branchId', val)}
                        disabled={saving}
                        placeholder="Select a branch"
                        error={!!formErrors.branchId}
                      />
                      {formErrors.branchId && (
                        <span className="form-error"><AlertCircle size={12} /> {formErrors.branchId}</span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Tab 2: Process Steps Assignment */
                <div className="wo-process-section" style={{ margin: 0, border: 'none', background: 'transparent', padding: 0 }}>
                  <div className="wo-process-section__header" style={{ marginBottom: '1rem' }}>
                    <h3 className="wo-process-section__title">
                      Process Steps Assignment
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
                        <span>Add Process</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          setShowAddVerificationForm(true);
                          setShowAddProcess(false);
                          setVerificationType('INTERNAL');
                          setVerificationTechnicianId('');
                        }}
                        disabled={saving || showAddVerificationForm}
                      >
                        <ShieldPlus size={14} />
                        <span>Add Verification</span>
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
                      <span>No processes loaded yet. Choose prosthesis type in details or add processes.</span>
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
                            <span>{proc.processName}</span>
                            {proc.isVerification && (
                              <span className="wo-process-item__tag" style={{
                                backgroundColor: proc.technicianId ? 'rgba(139, 92, 246, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                color: proc.technicianId ? '#8B5CF6' : '#6366F1'
                              }}>
                                {proc.technicianId ? 'Internal' : 'External'} Verification
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
                                  return selectedDoc ? selectedDoc.name : 'Selected Doctor';
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
                                disabled={saving}
                                placeholder={`Select ${proc.isVerification ? 'admin' : 'technician'}`}
                              />
                            )}
                          </div>

                          {/* Process Status selection */}
                          <div className="wo-process-item__status" style={{ width: '150px' }}>
                            <SearchableSelect
                              id={`select-edit-proc-status-${proc.tempId}`}
                              options={[
                                { value: 'NOT_STARTED', label: 'Not Started' },
                                { value: 'IN_PROGRESS', label: 'In Progress' },
                                { value: 'COMPLETED', label: 'Completed' },
                                { value: 'FAILED', label: 'Failed' },
                                { value: 'CANCELLED', label: 'Cancelled' },
                              ]}
                              value={proc.status || 'NOT_STARTED'}
                              onChange={(val) => updateProcessStatus(idx, val as any)}
                              disabled={saving}
                              placeholder="Select status"
                            />
                          </div>

                          <div className="wo-process-item__actions">
                            <button
                              type="button"
                              className="wo-process-item__btn"
                              onClick={() => moveProcess(idx, 'up')}
                              disabled={idx === 0 || saving}
                              title="Move up"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              className="wo-process-item__btn"
                              onClick={() => moveProcess(idx, 'down')}
                              disabled={idx === processList.length - 1 || saving}
                              title="Move down"
                            >
                              <ChevronDown size={14} />
                            </button>
                            <button
                              type="button"
                              className="wo-process-item__btn wo-process-item__btn--danger"
                              onClick={() => removeProcess(idx)}
                              disabled={saving}
                              title="Remove"
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
                            onChange={(e) => setVerificationType(e.target.value as any)}
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
    </div>
  );
}

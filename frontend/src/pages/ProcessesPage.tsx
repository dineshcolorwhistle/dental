import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  X,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Trash2,
  Building2,
  GitMerge,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  processService,
  prosthesisTypeService,
  technicianService,
  branchService,
  type ProcessListItem,
  type ProsthesisTypeListItem,
  type TechnicianListItem,
  type BranchListItem,
  type CreateProcessPayload,
} from '../services';
import { useAuth } from '../context';

export function ProcessesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [processes, setProcesses] = useState<ProcessListItem[]>([]);
  const [prosthesisTypes, setProsthesisTypes] = useState<ProsthesisTypeListItem[]>([]);
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [selectedProsthesisTypeFilter, setSelectedProsthesisTypeFilter] = useState<string>('ALL');

  // Reorder Modal State
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderProsthesisTypeId, setReorderProsthesisTypeId] = useState('');
  const [reorderProcesses, setReorderProcesses] = useState<ProcessListItem[]>([]);
  const [savingReorder, setSavingReorder] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<ProcessListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'processArea' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Form dropdown data
  const [formTechnicians, setFormTechnicians] = useState<TechnicianListItem[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<ProcessListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [form, setForm] = useState<CreateProcessPayload>({
    name: '',
    processArea: '',
    defaultTechnicianId: '',
    prosthesisTypeId: '',
    branchId: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateProcessPayload, string>>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;
      const [processData, typeData, branchData] = await Promise.all([
        processService.getAll(branchScope),
        prosthesisTypeService.getAll(),
        isAdmin ? Promise.resolve([]) : branchService.getAll(),
      ]);
      setProcesses(processData);
      setProsthesisTypes(typeData);
      setBranches(branchData.filter((b) => b.isActive));
    } catch (err) {
      toast.error('Failed to load processes or related data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.branchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Dynamic Technician Fetching ────────────────────

  const fetchTechniciansForBranch = useCallback(async (branchId: string) => {
    if (!branchId) {
      setFormTechnicians([]);
      return;
    }
    try {
      setLoadingTechs(true);
      const techs = await technicianService.getAll(branchId);
      setFormTechnicians(techs.filter((t) => t.status === 'ACTIVE'));
    } catch (err) {
      toast.error('Failed to load branch technicians');
      console.error(err);
    } finally {
      setLoadingTechs(false);
    }
  }, []);

  // Sync technicians dropdown when form branchId changes
  useEffect(() => {
    if (showCreateModal || showEditModal) {
      const activeBranchId = isAdmin ? user?.branchId : form.branchId;
      if (activeBranchId) {
        fetchTechniciansForBranch(activeBranchId);
      } else {
        setFormTechnicians([]);
      }
    }
  }, [form.branchId, showCreateModal, showEditModal, isAdmin, user, fetchTechniciansForBranch]);

  // ─── Filtering & Sorting ────────────────────────────

  const filtered = processes
    .filter((p) => {
      if (!isAdmin && selectedBranchFilter !== 'ALL' && p.branchId !== selectedBranchFilter) return false;
      if (selectedProsthesisTypeFilter !== 'ALL' && p.prosthesisTypeId !== selectedProsthesisTypeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.processArea.toLowerCase().includes(q) ||
          p.prosthesisType.name.toLowerCase().includes(q) ||
          (p.defaultTechnician && `${p.defaultTechnician.firstName} ${p.defaultTechnician.lastName}`.toLowerCase().includes(q)) ||
          (p.branch && p.branch.name.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      // Default to sequence sorting when a specific prosthesis type is selected and sortField is default (name)
      if (selectedProsthesisTypeFilter !== 'ALL' && sortField === 'name') {
        return mul * ((a.sequence || 0) - (b.sequence || 0));
      }
      if (sortField === 'name') return mul * a.name.localeCompare(b.name);
      if (sortField === 'processArea') return mul * a.processArea.localeCompare(b.processArea);
      return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateProcessPayload, string>> = {};

    if (!form.name.trim()) errors.name = 'Process name is required';
    if (!form.processArea.trim()) errors.processArea = 'Process area is required';
    if (!form.prosthesisTypeId) errors.prosthesisTypeId = 'Prosthesis type is mandatory';
    if (!form.defaultTechnicianId) errors.defaultTechnicianId = 'Default technician is mandatory';
    if (!isAdmin && !form.branchId) {
      errors.branchId = 'Assigned branch is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOpen = () => {
    const defaultBranchId = isAdmin ? user?.branchId || '' : branches[0]?.id || '';
    setForm({
      name: '',
      processArea: '',
      defaultTechnicianId: '',
      prosthesisTypeId: prosthesisTypes[0]?.id || '',
      branchId: defaultBranchId,
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditOpen = (proc: ProcessListItem) => {
    setSelectedProcess(proc);
    setForm({
      name: proc.name,
      processArea: proc.processArea,
      defaultTechnicianId: proc.defaultTechnicianId,
      prosthesisTypeId: proc.prosthesisTypeId,
      branchId: proc.branchId || '',
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload: CreateProcessPayload = {
        name: form.name,
        processArea: form.processArea,
        defaultTechnicianId: form.defaultTechnicianId,
        prosthesisTypeId: form.prosthesisTypeId,
        branchId: isAdmin ? user?.branchId || undefined : form.branchId,
      };
      await processService.create(payload);
      toast.success('Workflow process created successfully!');
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to create process';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcess || !validateForm()) return;

    try {
      setSaving(true);
      const payload: Partial<CreateProcessPayload> = {
        name: form.name,
        processArea: form.processArea,
        defaultTechnicianId: form.defaultTechnicianId,
        prosthesisTypeId: form.prosthesisTypeId,
        branchId: isAdmin ? user?.branchId || undefined : form.branchId || undefined,
      };
      await processService.update(selectedProcess.id, payload);
      toast.success('Workflow process updated successfully!');
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to update process';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof CreateProcessPayload, value: string) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Clear technician field if branch changes
      if (field === 'branchId') {
        updated.defaultTechnicianId = '';
      }
      return updated;
    });

    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const toggleSort = (field: 'name' | 'processArea' | 'createdAt') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const confirmDelete = (proc: ProcessListItem) => {
    setProcessToDelete(proc);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!processToDelete) return;
    try {
      setDeleting(true);
      await processService.delete(processToDelete.id);
      toast.success('Process deleted successfully');
      setDeleteModalOpen(false);
      setProcessToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete process');
    } finally {
      setDeleting(false);
    }
  };

  const handleReorderOpen = () => {
    const defaultTypeId = selectedProsthesisTypeFilter !== 'ALL' ? selectedProsthesisTypeFilter : (prosthesisTypes[0]?.id || '');
    setReorderProsthesisTypeId(defaultTypeId);
    
    const typeProcs = processes
      .filter((p) => p.prosthesisTypeId === defaultTypeId)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      
    setReorderProcesses(typeProcs);
    setShowReorderModal(true);
  };

  const handleReorderTypeChange = (typeId: string) => {
    setReorderProsthesisTypeId(typeId);
    const typeProcs = processes
      .filter((p) => p.prosthesisTypeId === typeId)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    setReorderProcesses(typeProcs);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= reorderProcesses.length) return;
    
    const updated = [...reorderProcesses];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    setReorderProcesses(updated);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const updated = [...reorderProcesses];
    const temp = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, temp);
    setDraggedIndex(index);
    setReorderProcesses(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSaveReorder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reorderProsthesisTypeId) return;
    
    try {
      setSavingReorder(true);
      const processIds = reorderProcesses.map((p) => p.id);
      await processService.reorder(reorderProsthesisTypeId, processIds);
      toast.success('Workflow sequence updated successfully!');
      setShowReorderModal(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update workflow sequence');
    } finally {
      setSavingReorder(false);
    }
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">Processes</h1>
          <p className="page-header__subtitle">Manage workflow stages and customize production handoffs</p>
        </div>
        <button
          id="btn-add-process"
          className="btn btn--primary"
          onClick={handleCreateOpen}
          disabled={prosthesisTypes.length === 0}
          title={prosthesisTypes.length === 0 ? 'Create a Prosthesis Type first' : 'Add Process'}
        >
          <Plus size={18} />
          <span>Add Process</span>
        </button>
      </div>

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <GitMerge size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{processes.length}</span>
            <span className="stat-card__label">Total Workflow Stages</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="table-toolbar" style={{ gap: '1rem' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-process-search"
            type="text"
            className="form-input search-input"
            placeholder="Search processes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-input__clear" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="table-toolbar__filters" style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Prosthesis Type Filter dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>Prosthesis Type:</span>
            <select
              className="form-input"
              style={{ width: '180px', height: '36px', padding: '0 0.75rem', borderRadius: '8px', fontSize: '0.8125rem' }}
              value={selectedProsthesisTypeFilter}
              onChange={(e) => setSelectedProsthesisTypeFilter(e.target.value)}
            >
              <option value="ALL">All Types</option>
              {prosthesisTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reorder Button */}
          {selectedProsthesisTypeFilter !== 'ALL' && (
            <button
              className="btn btn--secondary"
              style={{ height: '36px', padding: '0 0.75rem', borderRadius: '8px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              onClick={handleReorderOpen}
              disabled={filtered.length === 0}
              title={filtered.length === 0 ? 'No processes to reorder' : 'Reorder workflow sequence'}
            >
              <ArrowUpDown size={14} />
              <span>Reorder Sequence</span>
            </button>
          )}

          {/* Branch Filter dropdown (Only for OWNER, since ADMIN is auto-scoped) */}
          {!isAdmin && (
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
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>Loading processes...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
            <GitMerge size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 className="empty-state__title">
            {processes.length === 0 ? 'No workflow processes created' : 'No matching records'}
          </h3>
          <p className="empty-state__text">
            {processes.length === 0
              ? 'Configure processes to define operational workflow stages like scanning, designing, and QC.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {processes.length === 0 && prosthesisTypes.length > 0 && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
            >
              <Plus size={18} />
              <span>Add Process</span>
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="processes-table">
            <thead>
              <tr>
                {selectedProsthesisTypeFilter !== 'ALL' && <th style={{ width: '100px' }}>Step Order</th>}
                <th>
                  <button className="th-sort" onClick={() => toggleSort('name')}>
                    Process Name
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('processArea')}>
                    Process Area
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>Prosthesis Type</th>
                <th>Default Technician</th>
                {!isAdmin && <th>Branch</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((proc) => (
                <tr key={proc.id}>
                  {selectedProsthesisTypeFilter !== 'ALL' && (
                    <td>
                      <span className="badge" style={{ backgroundColor: 'var(--accent-primary-light)', color: 'var(--accent-primary)', fontWeight: 600, padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                        Step {filtered.indexOf(proc) + 1}
                      </span>
                    </td>
                  )}
                  <td>
                    <div className="cell-primary">
                      <div className="cell-avatar" style={{ background: 'linear-gradient(135deg, #FFECD2, #FCB69F)' }}>
                        P
                      </div>
                      <div>
                        <span className="cell-primary__name">{proc.name}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge--primary" style={{ textTransform: 'capitalize' }}>
                      {proc.processArea}
                    </span>
                  </td>
                  <td>
                    <span className="cell-subdomain" style={{ fontWeight: 600 }}>
                      {proc.prosthesisType.name}
                    </span>
                  </td>
                  <td>
                    {proc.defaultTechnician ? (
                      <div className="cell-user">
                        <span className="cell-user__name">
                          {proc.defaultTechnician.firstName} {proc.defaultTechnician.lastName}
                        </span>
                        <span className="cell-user__email">
                          {proc.defaultTechnician.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  {!isAdmin && (
                    <td>
                      {proc.branch ? (
                        <div className="cell-primary" style={{ gap: '0.25rem' }}>
                          <Building2 size={12} style={{ color: 'var(--accent-primary)' }} />
                          <span className="cell-branch" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{proc.branch.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn-action"
                        onClick={() => handleEditOpen(proc)}
                        title="Edit Process"
                      >
                        <span>Edit</span>
                      </button>
                      <button
                        className="btn-action btn-action--danger"
                        onClick={() => confirmDelete(proc)}
                        title="Delete Process"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Add Process</h2>
                <p className="modal__subtitle">Define a manufacturing step and link a default technician</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowCreateModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form className="modal__body" onSubmit={handleCreate}>
              {/* Branch Select dropdown — only shown for Owner, forced on backend for Admin */}
              {!isAdmin && branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-process-branch">
                    Assigned Branch *
                  </label>
                  <select
                    id="select-process-branch"
                    className={`form-input ${formErrors.branchId ? 'form-input--error' : ''}`}
                    value={form.branchId}
                    onChange={(e) => handleInputChange('branchId', e.target.value)}
                    disabled={saving}
                  >
                    <option value="" disabled>Select a branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                  {formErrors.branchId && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.branchId}
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-process-name">
                    Process Name *
                  </label>
                  <input
                    id="input-process-name"
                    className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder="e.g., CAD Design Stage"
                    value={form.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={saving}
                    autoFocus
                  />
                  {formErrors.name && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="input-process-area">
                    Process Area *
                  </label>
                  <input
                    id="input-process-area"
                    className={`form-input ${formErrors.processArea ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder="e.g., Design"
                    value={form.processArea}
                    onChange={(e) => handleInputChange('processArea', e.target.value)}
                    disabled={saving}
                  />
                  {formErrors.processArea && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.processArea}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-process-type">
                  Prosthesis Type *
                </label>
                <select
                  id="select-process-type"
                  className={`form-input ${formErrors.prosthesisTypeId ? 'form-input--error' : ''}`}
                  value={form.prosthesisTypeId}
                  onChange={(e) => handleInputChange('prosthesisTypeId', e.target.value)}
                  disabled={saving}
                >
                  <option value="" disabled>Select prosthesis type</option>
                  {prosthesisTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {formErrors.prosthesisTypeId && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.prosthesisTypeId}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-process-technician">
                  Default Technician *
                </label>
                <select
                  id="select-process-technician"
                  className={`form-input ${formErrors.defaultTechnicianId ? 'form-input--error' : ''}`}
                  value={form.defaultTechnicianId}
                  onChange={(e) => handleInputChange('defaultTechnicianId', e.target.value)}
                  disabled={saving || loadingTechs || (!isAdmin && !form.branchId)}
                >
                  <option value="" disabled>
                    {loadingTechs
                      ? 'Loading technicians...'
                      : !isAdmin && !form.branchId
                      ? 'Select a branch first'
                      : formTechnicians.length === 0
                      ? 'No technicians in this branch'
                      : 'Select pre-assigned default technician'}
                  </option>
                  {formTechnicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.email})
                    </option>
                  ))}
                </select>
                {formErrors.defaultTechnicianId && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.defaultTechnicianId}
                  </span>
                )}
              </div>

              <div className="modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowCreateModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-process"
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Add Process</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedProcess && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Edit Process</h2>
                <p className="modal__subtitle">Update details for process stage <strong>{selectedProcess.name}</strong></p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowEditModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form className="modal__body" onSubmit={handleUpdate}>
              {/* Branch Select dropdown — only shown for Owner, forced on backend for Admin */}
              {!isAdmin && branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-edit-process-branch">
                    Assigned Branch *
                  </label>
                  <select
                    id="select-edit-process-branch"
                    className={`form-input ${formErrors.branchId ? 'form-input--error' : ''}`}
                    value={form.branchId}
                    onChange={(e) => handleInputChange('branchId', e.target.value)}
                    disabled={saving}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                  {formErrors.branchId && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.branchId}
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-process-name">
                    Process Name *
                  </label>
                  <input
                    id="input-edit-process-name"
                    className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                    type="text"
                    value={form.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={saving}
                    autoFocus
                  />
                  {formErrors.name && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-process-area">
                    Process Area *
                  </label>
                  <input
                    id="input-edit-process-area"
                    className={`form-input ${formErrors.processArea ? 'form-input--error' : ''}`}
                    type="text"
                    value={form.processArea}
                    onChange={(e) => handleInputChange('processArea', e.target.value)}
                    disabled={saving}
                  />
                  {formErrors.processArea && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.processArea}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-process-type">
                  Prosthesis Type *
                </label>
                <select
                  id="select-edit-process-type"
                  className={`form-input ${formErrors.prosthesisTypeId ? 'form-input--error' : ''}`}
                  value={form.prosthesisTypeId}
                  onChange={(e) => handleInputChange('prosthesisTypeId', e.target.value)}
                  disabled={saving}
                >
                  {prosthesisTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {formErrors.prosthesisTypeId && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.prosthesisTypeId}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-process-technician">
                  Default Technician *
                </label>
                <select
                  id="select-edit-process-technician"
                  className={`form-input ${formErrors.defaultTechnicianId ? 'form-input--error' : ''}`}
                  value={form.defaultTechnicianId}
                  onChange={(e) => handleInputChange('defaultTechnicianId', e.target.value)}
                  disabled={saving || loadingTechs}
                >
                  <option value="" disabled>
                    {loadingTechs ? 'Loading technicians...' : 'Select pre-assigned default technician'}
                  </option>
                  {formTechnicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.email})
                    </option>
                  ))}
                </select>
                {formErrors.defaultTechnicianId && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.defaultTechnicianId}
                  </span>
                )}
              </div>

              <div className="modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-edit-process"
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Update Process</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && processToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Delete Process</h2>
              </div>
              <button
                className="modal__close"
                onClick={() => !deleting && setDeleteModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="modal__body" style={{ padding: '1rem 1.75rem' }}>
              <p style={{ margin: 0, color: 'var(--text-body)' }}>
                Are you sure you want to delete process stage <strong>{processToDelete.name}</strong>?
              </p>
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
                className="btn btn--primary"
                style={{ backgroundColor: 'var(--danger)' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reorder Sequence Modal */}
      {showReorderModal && (
        <div className="modal-overlay" onClick={() => !savingReorder && setShowReorderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Reorder Workflow Sequence</h2>
                <p className="modal__subtitle">Define the production step sequence for the selected prosthesis type.</p>
              </div>
              <button
                className="modal__close"
                onClick={() => !savingReorder && setShowReorderModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form className="modal__body" onSubmit={handleSaveReorder}>
              {/* Type Select Dropdown inside Modal */}
              <div className="form-group">
                <label className="form-label" htmlFor="reorder-select-type">
                  Prosthesis Type
                </label>
                <select
                  id="reorder-select-type"
                  className="form-input"
                  value={reorderProsthesisTypeId}
                  onChange={(e) => handleReorderTypeChange(e.target.value)}
                  disabled={savingReorder}
                >
                  {prosthesisTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort instructions alert */}
              {reorderProcesses.length > 1 && (
                <div style={{
                  padding: '0.625rem 0.875rem',
                  backgroundColor: 'var(--bg-body)',
                  borderLeft: '4px solid var(--accent-primary)',
                  borderRadius: '4px',
                  marginBottom: '1rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span>Drag and drop items or use the <strong>Up/Down arrows</strong> to define the step-by-step sequence.</span>
                </div>
              )}

              {/* Processes list */}
              {reorderProcesses.length === 0 ? (
                <div style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-body)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-color)',
                  color: 'var(--text-muted)'
                }}>
                  <GitMerge size={32} style={{ margin: '0 auto 0.75rem', color: 'var(--text-muted)', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '0.8125rem' }}>No process stages configured for this prosthesis type.</p>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '350px',
                  overflowY: 'auto',
                  paddingRight: '0.25rem',
                  paddingBottom: '0.25rem'
                }}>
                  {reorderProcesses.map((proc, index) => {
                    const isDragged = draggedIndex === index;
                    return (
                      <div
                        key={proc.id}
                        draggable={!savingReorder}
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          backgroundColor: isDragged ? 'var(--accent-primary-light)' : 'var(--bg-card)',
                          border: isDragged ? '1.5px dashed var(--accent-primary)' : '1px solid var(--border-color)',
                          borderRadius: '8px',
                          cursor: savingReorder ? 'not-allowed' : 'grab',
                          opacity: isDragged ? 0.6 : 1,
                          transition: 'background-color 0.15s, border-color 0.15s, opacity 0.15s',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexGrow: 1, minWidth: 0 }}>
                          <GripVertical size={16} style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'var(--accent-primary-light)',
                            color: 'var(--accent-primary)',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {index + 1}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: 'var(--text-title)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>{proc.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                              {proc.processArea}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn-action"
                            style={{ padding: '4px 8px', height: '28px', minHeight: 'auto' }}
                            onClick={() => moveStep(index, 'up')}
                            disabled={index === 0 || savingReorder}
                            title="Move Up"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-action"
                            style={{ padding: '4px 8px', height: '28px', minHeight: 'auto' }}
                            onClick={() => moveStep(index, 'down')}
                            disabled={index === reorderProcesses.length - 1 || savingReorder}
                            title="Move Down"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="modal__footer" style={{ marginTop: '1.5rem', padding: 0 }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowReorderModal(false)}
                  disabled={savingReorder}
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-reorder-sequence"
                  type="submit"
                  className="btn btn--primary"
                  disabled={savingReorder || reorderProcesses.length === 0}
                >
                  {savingReorder ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Sequence</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

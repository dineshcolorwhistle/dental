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
  }, [isAdmin, user]);

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

        <div className="table-toolbar__filters" style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
    </div>
  );
}

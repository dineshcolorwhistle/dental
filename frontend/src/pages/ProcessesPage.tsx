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
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  processService,
  technicianService,
  branchService,
  processAreaService,
  type ProcessListItem,
  type TechnicianListItem,
  type BranchListItem,
  type CreateProcessPayload,
  type ProcessAreaListItem,
} from '../services';
import { useAuth } from '../context';
import { Pagination, SearchableSelect } from '../components';

export function ProcessesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const canEdit = isAdmin || isOwner;
  const canDelete = isOwner;

  const [processes, setProcesses] = useState<ProcessListItem[]>([]);
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');

  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Reset pagination when filters or search change
  useEffect(() => {
    setCurrentPage(0);
  }, [search, selectedBranchFilter]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<ProcessListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'processArea' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Form dropdown data
  const [formTechnicians, setFormTechnicians] = useState<TechnicianListItem[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [processAreas, setProcessAreas] = useState<ProcessAreaListItem[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<ProcessListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [form, setForm] = useState<CreateProcessPayload>({
    name: '',
    processAreaId: '',
    defaultTechnicianId: '',
    branchId: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateProcessPayload, string>>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;
      const [processData, branchData] = await Promise.all([
        processService.getAll(branchScope),
        isAdmin ? Promise.resolve([]) : branchService.getAll(),
      ]);
      setProcesses(processData);
      setBranches(branchData.filter((b) => b.isActive));
    } catch (err) {
      toast.error(t('processesPage.failedLoad'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.branchId, t]);

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
      toast.error(t('technicians.failedLoad'));
      console.error(err);
    } finally {
      setLoadingTechs(false);
    }
  }, []);

  // Sync technicians and process areas dropdowns when form branchId changes
  const fetchProcessAreasForBranch = useCallback(async (branchId: string) => {
    if (!branchId) {
      setProcessAreas([]);
      return;
    }
    try {
      setLoadingAreas(true);
      const areas = await processAreaService.getAll(branchId);
      setProcessAreas(areas);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAreas(false);
    }
  }, []);

  useEffect(() => {
    if (showCreateModal || showEditModal) {
      const activeBranchId = isAdmin ? user?.branchId : form.branchId;
      if (activeBranchId) {
        fetchTechniciansForBranch(activeBranchId);
        fetchProcessAreasForBranch(activeBranchId);
      } else {
        setFormTechnicians([]);
        setProcessAreas([]);
      }
    }
  }, [form.branchId, showCreateModal, showEditModal, isAdmin, user, fetchTechniciansForBranch, fetchProcessAreasForBranch]);

  // ─── Filtering & Sorting ────────────────────────────

  const filtered = processes
    .filter((p) => {
      if (!isAdmin && selectedBranchFilter !== 'ALL' && p.branchId !== selectedBranchFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.processArea.toLowerCase().includes(q) ||
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

  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateProcessPayload, string>> = {};

    if (!form.name.trim()) errors.name = t('validation.fieldRequired');
    if (!form.processAreaId) errors.processAreaId = t('validation.fieldRequired');
    if (!form.defaultTechnicianId) errors.defaultTechnicianId = t('validation.fieldRequired');
    if (!isAdmin && !form.branchId) {
      errors.branchId = t('validation.fieldRequired');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOpen = () => {
    const defaultBranchId = isAdmin ? user?.branchId || '' : branches[0]?.id || '';
    setForm({
      name: '',
      processAreaId: '',
      defaultTechnicianId: '',
      branchId: defaultBranchId,
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditOpen = (proc: ProcessListItem) => {
    setSelectedProcess(proc);
    setForm({
      name: proc.name,
      processAreaId: (proc as any).processAreaId || '',
      defaultTechnicianId: proc.defaultTechnicianId,
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
        processAreaId: form.processAreaId,
        defaultTechnicianId: form.defaultTechnicianId,
        branchId: isAdmin ? user?.branchId || undefined : form.branchId,
      };
      await processService.create(payload);
      toast.success(t('processesPage.createSuccess'));
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('processesPage.failedCreate');
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
        processAreaId: form.processAreaId,
        defaultTechnicianId: form.defaultTechnicianId,
        branchId: isAdmin ? user?.branchId || undefined : form.branchId || undefined,
      };
      await processService.update(selectedProcess.id, payload);
      toast.success(t('processesPage.updateSuccess'));
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('processesPage.failedUpdate');
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
      toast.success(t('processesPage.deleteSuccess'));
      setDeleteModalOpen(false);
      setProcessToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('processesPage.failedDelete'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('processesPage.title')}</h1>
          <p className="page-header__subtitle">{t('processesPage.subtitle', { defaultValue: 'Manage workflow stages and customize production handoffs' })}</p>
        </div>
        {canEdit && (
          <button
            id="btn-add-process"
            className="btn btn--primary"
            onClick={handleCreateOpen}
          >
            <Plus size={18} />
            <span>{t('processesPage.createProcess')}</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <GitMerge size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{processes.length}</span>
            <span className="stat-card__label">{t('processesPage.totalStages', { defaultValue: 'Total Workflow Stages' })}</span>
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
            placeholder={t('processesPage.searchPlaceholder')}
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
          {/* Branch Filter dropdown (Only for OWNER, since ADMIN is auto-scoped) */}
          {!isAdmin && (
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
          <span>{t('processesPage.loading', { defaultValue: 'Loading processes...' })}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
            <GitMerge size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 className="empty-state__title">
            {processes.length === 0 ? t('processesPage.noProcesses') : t('processesPage.noMatching', { defaultValue: 'No matching records' })}
          </h3>
          <p className="empty-state__text">
            {processes.length === 0
              ? t('processesPage.createDesc', { defaultValue: 'Configure processes to define operational workflow stages like scanning, designing, and QC.' })
              : t('processesPage.adjustFilters', { defaultValue: 'Try adjusting your search or filter criteria.' })}
          </p>
          {processes.length === 0 && canEdit && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
            >
              <Plus size={18} />
              <span>{t('processesPage.createProcess')}</span>
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
                    {t('processesPage.processName')}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('processArea')}>
                    {t('processesPage.processArea', { defaultValue: 'Process Area' })}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>{t('processesPage.defaultTechnician')}</th>
                {!isAdmin && <th>{t('common.branch')}</th>}
                <th>{t('processesPage.assignedTo', { defaultValue: 'Assigned To' })}</th>
                {canEdit && <th>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((proc) => (
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
                    {proc.prosthesisTypeAssignments && proc.prosthesisTypeAssignments.length > 0 ? (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {proc.prosthesisTypeAssignments.map((a) => (
                          <span
                            key={a.id}
                            className="badge"
                            style={{
                              backgroundColor: 'var(--accent-primary-light)',
                              color: 'var(--accent-primary)',
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              padding: '0.125rem 0.5rem',
                              borderRadius: '4px',
                            }}
                          >
                            {a.prosthesisType.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{t('processesPage.notAssigned', { defaultValue: 'Not assigned' })}</span>
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn-action"
                          onClick={() => handleEditOpen(proc)}
                          title={t('processesPage.editProcess')}
                        >
                          <span>{t('common.edit')}</span>
                        </button>
                        {canDelete && (
                          <button
                            className="btn-action btn-action--danger"
                            onClick={() => confirmDelete(proc)}
                            title={t('processesPage.deleteConfirm')}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('processesPage.createProcess')}</h2>
                <p className="modal__subtitle">{t('processesPage.createProcessSubtitle', { defaultValue: 'Define a manufacturing step and link a default technician' })}</p>
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
                    {t('admins.assignedBranch')} *
                  </label>
                  <SearchableSelect
                    id="select-process-branch"
                    options={branches.map((b) => ({
                      value: b.id,
                      label: `${b.name} (${b.code})`,
                    }))}
                    value={form.branchId || ''}
                    onChange={(val) => handleInputChange('branchId', val)}
                    disabled={saving}
                    placeholder={t('branches.selectBranch')}
                    error={!!formErrors.branchId}
                  />
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
                    {t('processesPage.processName')} *
                  </label>
                  <input
                    id="input-process-name"
                    className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder={t('processesPage.enterProcessNamePlaceholder', { defaultValue: 'e.g., CAD Design Stage' })}
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
                  <label className="form-label" htmlFor="select-process-area">
                    {t('processesPage.processArea', { defaultValue: 'Process Area' })} *
                  </label>
                  <SearchableSelect
                    id="select-process-area"
                    options={processAreas.map((area) => ({
                      value: area.id,
                      label: area.name,
                    }))}
                    value={form.processAreaId}
                    onChange={(val) => handleInputChange('processAreaId', val)}
                    disabled={saving || loadingAreas || (!isAdmin && !form.branchId)}
                    placeholder={
                      loadingAreas
                        ? t('processesPage.loadingAreas', { defaultValue: 'Loading areas...' })
                        : !isAdmin && !form.branchId
                        ? t('processesPage.selectBranchFirst', { defaultValue: 'Select a branch first' })
                        : processAreas.length === 0
                        ? t('processesPage.noAreasBranch', { defaultValue: 'No process areas in this branch' })
                        : t('processesPage.selectArea', { defaultValue: 'Select Process Area' })
                    }
                    error={!!formErrors.processAreaId}
                  />
                  {formErrors.processAreaId && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.processAreaId}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-process-technician">
                  {t('processesPage.defaultTechnician')} *
                </label>
                <SearchableSelect
                  id="select-process-technician"
                  options={formTechnicians.map((t) => ({
                    value: t.id,
                    label: `${t.firstName} ${t.lastName} (${t.email})`,
                  }))}
                  value={form.defaultTechnicianId}
                  onChange={(val) => handleInputChange('defaultTechnicianId', val)}
                  disabled={saving || loadingTechs || (!isAdmin && !form.branchId)}
                  placeholder={
                    loadingTechs
                      ? t('technicians.loading', { defaultValue: 'Loading technicians...' })
                      : !isAdmin && !form.branchId
                      ? t('processesPage.selectBranchFirst', { defaultValue: 'Select a branch first' })
                      : formTechnicians.length === 0
                      ? t('processesPage.noTechniciansBranch', { defaultValue: 'No technicians in this branch' })
                      : t('processesPage.selectDefaultTechnician', { defaultValue: 'Select pre-assigned default technician' })
                  }
                  error={!!formErrors.defaultTechnicianId}
                />
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
                  {t('common.cancel')}
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
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <span>{t('processesPage.createProcess')}</span>
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
                <h2 className="modal__title">{t('processesPage.editProcess')}</h2>
                <p className="modal__subtitle">{t('processesPage.updateDetails', { defaultValue: 'Update details for process stage' })} <strong>{selectedProcess.name}</strong></p>
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
                    {t('admins.assignedBranch')} *
                  </label>
                  <SearchableSelect
                    id="select-edit-process-branch"
                    options={branches.map((b) => ({
                      value: b.id,
                      label: `${b.name} (${b.code})`,
                    }))}
                    value={form.branchId || ''}
                    onChange={(val) => handleInputChange('branchId', val)}
                    disabled={saving}
                    placeholder={t('branches.selectBranch')}
                    error={!!formErrors.branchId}
                  />
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
                    {t('processesPage.processName')} *
                  </label>
                  <input
                    id="input-edit-process-name"
                    className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder={t('processesPage.enterProcessNamePlaceholder', { defaultValue: 'e.g., CAD Design Stage' })}
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
                  <label className="form-label" htmlFor="select-edit-process-area">
                    {t('processesPage.processArea', { defaultValue: 'Process Area' })} *
                  </label>
                  <SearchableSelect
                    id="select-edit-process-area"
                    options={processAreas.map((area) => ({
                      value: area.id,
                      label: area.name,
                    }))}
                    value={form.processAreaId}
                    onChange={(val) => handleInputChange('processAreaId', val)}
                    disabled={saving || loadingAreas}
                    placeholder={
                      loadingAreas
                        ? t('processesPage.loadingAreas', { defaultValue: 'Loading areas...' })
                        : processAreas.length === 0
                        ? t('processesPage.noAreasBranch', { defaultValue: 'No process areas in this branch' })
                        : t('processesPage.selectArea', { defaultValue: 'Select Process Area' })
                    }
                    error={!!formErrors.processAreaId}
                  />
                  {formErrors.processAreaId && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.processAreaId}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-process-technician">
                  {t('processesPage.defaultTechnician')} *
                </label>
                <SearchableSelect
                  id="select-edit-process-technician"
                  options={formTechnicians.map((t) => ({
                    value: t.id,
                    label: `${t.firstName} ${t.lastName} (${t.email})`,
                  }))}
                  value={form.defaultTechnicianId}
                  onChange={(val) => handleInputChange('defaultTechnicianId', val)}
                  disabled={saving || loadingTechs}
                  placeholder={loadingTechs ? t('technicians.loading', { defaultValue: 'Loading technicians...' }) : t('processesPage.selectDefaultTechnician', { defaultValue: 'Select pre-assigned default technician' })}
                  error={!!formErrors.defaultTechnicianId}
                />
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
                  {t('common.cancel')}
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
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <span>{t('common.save')}</span>
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
                <h2 className="modal__title">{t('common.delete')}</h2>
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
                {t('processesPage.deleteConfirmText', { name: processToDelete.name, defaultValue: `Are you sure you want to delete process stage ${processToDelete.name}?` })}
              </p>
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
                className="btn btn--primary"
                style={{ backgroundColor: 'var(--danger)' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>{t('common.saving')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>{t('common.delete')}</span>
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

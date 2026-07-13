import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  X,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Trash2,
  Building2,
  GitMerge,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  prosthesisTypeService,
  branchService,
  processService,
  type ProsthesisTypeListItem,
  type CreateProsthesisTypePayload,
  type BranchListItem,
  type ProcessListItem,
  type ProsthesisTypeProcessAssignment,
} from '../services';
import { useAuth } from '../context';
import { Pagination, SearchableSelect } from '../components';

export function ProsthesisTypesPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canEdit = user?.role === 'ADMIN';

  const [types, setTypes] = useState<ProsthesisTypeListItem[]>([]);
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [allBranchProcesses, setAllBranchProcesses] = useState<ProcessListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');

  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Reset pagination when search or branch filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [search, selectedBranchFilter]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ProsthesisTypeListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Reorder sequence modal state
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderTarget, setReorderTarget] = useState<ProsthesisTypeListItem | null>(null);
  const [reorderProcessesList, setReorderProcessesList] = useState<ProsthesisTypeProcessAssignment[]>([]);
  const [reordering, setReordering] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<ProsthesisTypeListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [form, setForm] = useState<CreateProsthesisTypePayload>({
    name: '',
    description: '',
    branchId: '',
    processIds: [],
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateProsthesisTypePayload, string>>>({});
  const [processSearch, setProcessSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;
      const [typesData, branchData, processData] = await Promise.all([
        prosthesisTypeService.getAll(branchScope),
        isAdmin ? Promise.resolve([]) : branchService.getAll(),
        processService.getAll(branchScope),
      ]);
      setTypes(typesData);
      setBranches(branchData.filter((b) => b.isActive));
      setAllBranchProcesses(processData);
    } catch (err) {
      toast.error(t('prosthesisTypes.failedLoad', { defaultValue: 'Failed to load prosthesis types or related data' }));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.branchId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Filtering & Sorting ────────────────────────────

  const filtered = types
    .filter((t) => {
      if (!isAdmin && selectedBranchFilter !== 'ALL' && t.branchId !== selectedBranchFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.branch && t.branch.name.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'name') return mul * a.name.localeCompare(b.name);
      return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateProsthesisTypePayload, string>> = {};
    if (!form.name.trim()) {
      errors.name = t('validation.fieldRequired');
    }
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
      description: '',
      branchId: defaultBranchId,
      processIds: [],
    });
    setFormErrors({});
    setProcessSearch('');
    setShowCreateModal(true);
  };

  const handleEditOpen = (item: ProsthesisTypeListItem) => {
    setSelectedType(item);
    setForm({
      name: item.name,
      description: item.description || '',
      branchId: item.branchId || '',
      processIds: (item.processAssignments || []).map((a) => a.process.id),
    });
    setFormErrors({});
    setProcessSearch('');
    setShowEditModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload: CreateProsthesisTypePayload = {
        name: form.name,
        description: form.description,
        branchId: isAdmin ? user?.branchId || undefined : form.branchId,
        processIds: form.processIds,
      };
      await prosthesisTypeService.create(payload);
      toast.success(t('prosthesisTypes.createSuccess', { defaultValue: 'Prosthesis type created successfully!' }));
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('prosthesisTypes.failedCreate', { defaultValue: 'Failed to create prosthesis type' });
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !validateForm()) return;

    try {
      setSaving(true);
      const payload: Partial<CreateProsthesisTypePayload> = {
        name: form.name,
        description: form.description,
        branchId: isAdmin ? user?.branchId || undefined : form.branchId || undefined,
        processIds: form.processIds,
      };
      await prosthesisTypeService.update(selectedType.id, payload);
      toast.success(t('prosthesisTypes.updateSuccess', { defaultValue: 'Prosthesis type updated successfully!' }));
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('prosthesisTypes.failedUpdate', { defaultValue: 'Failed to update prosthesis type' });
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof CreateProsthesisTypePayload, value: any) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Reset process IDs if branch changes
      if (field === 'branchId') {
        updated.processIds = [];
      }
      return updated;
    });
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // ─── Inline Process Sequence Builders ────────────────

  const addProcessToForm = (processId: string) => {
    const currentIds = form.processIds || [];
    if (currentIds.includes(processId)) return;
    handleInputChange('processIds', [...currentIds, processId]);
  };

  const removeProcessFromForm = (index: number) => {
    const currentIds = form.processIds || [];
    const newIds = currentIds.filter((_, i) => i !== index);
    handleInputChange('processIds', newIds);
  };

  const moveProcessInForm = (index: number, direction: 'up' | 'down') => {
    const currentIds = [...(form.processIds || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentIds.length) return;
    [currentIds[index], currentIds[targetIndex]] = [currentIds[targetIndex], currentIds[index]];
    handleInputChange('processIds', currentIds);
  };

  // ─── Reordering Modal Action Handlers ─────────────────

  const handleReorderOpen = async (item: ProsthesisTypeListItem) => {
    setReorderTarget(item);
    setReordering(true);
    try {
      const data = await prosthesisTypeService.getProcesses(item.id);
      setReorderProcessesList(data);
      setShowReorderModal(true);
    } catch (err) {
      toast.error(t('prosthesisTypes.failedLoadProcesses', { defaultValue: 'Failed to load processes for reordering' }));
      console.error(err);
    } finally {
      setReordering(false);
    }
  };

  const moveProcessInModalList = (index: number, direction: 'up' | 'down') => {
    const newList = [...reorderProcessesList];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setReorderProcessesList(newList.map((item, idx) => ({ ...item, sequence: idx })));
  };

  const handleReorderSave = async () => {
    if (!reorderTarget) return;
    try {
      setSaving(true);
      const processIds = reorderProcessesList.map((a) => a.process.id);
      await prosthesisTypeService.reorderProcesses(reorderTarget.id, processIds);
      toast.success(t('prosthesisTypes.reorderSuccess', { defaultValue: 'Workflow sequence reordered successfully!' }));
      setShowReorderModal(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('prosthesisTypes.failedReorder', { defaultValue: 'Failed to reorder sequence' }));
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────

  const confirmDelete = (item: ProsthesisTypeListItem) => {
    setTypeToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      setDeleting(true);
      await prosthesisTypeService.delete(typeToDelete.id);
      toast.success(t('prosthesisTypes.deleteSuccess', { defaultValue: 'Prosthesis type deleted successfully' }));
      setDeleteModalOpen(false);
      setTypeToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('prosthesisTypes.failedDelete', { defaultValue: 'Failed to delete prosthesis type' }));
    } finally {
      setDeleting(false);
    }
  };

  const toggleSort = (field: 'name' | 'createdAt') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Computed values
  const activeBranchId = isAdmin ? user?.branchId : form.branchId;
  const branchProcesses = allBranchProcesses.filter((p) => p.branchId === activeBranchId);
  const filteredBranchProcesses = branchProcesses.filter((p) => {
    if (!processSearch.trim()) return true;
    const query = processSearch.toLowerCase();
    return p.name.toLowerCase().includes(query) || (p.processArea && p.processArea.toLowerCase().includes(query));
  });

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('prosthesisTypes.title', { defaultValue: 'Prosthesis Types' })}</h1>
          <p className="page-header__subtitle">{t('prosthesisTypes.subtitle', { defaultValue: 'Manage dental laboratory work types and custom workflows' })}</p>
        </div>
        {canEdit && (
          <button
            id="btn-add-prosthesis-type"
            className="btn btn--primary"
            onClick={handleCreateOpen}
          >
            <Plus size={18} />
            <span>{t('prosthesisTypes.createProsthesis', { defaultValue: 'Add Prosthesis Type' })}</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{types.length}</span>
            <span className="stat-card__label">{t('prosthesisTypes.totalItems', { defaultValue: 'Total Catalog Items' })}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="table-toolbar" style={{ gap: '1rem' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-prosthesis-search"
            type="text"
            className="form-input search-input"
            placeholder={t('prosthesisTypes.searchPlaceholder', { defaultValue: 'Search prosthesis types...' })}
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
          {/* Branch Filter dropdown (Only for OWNER) */}
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
          <span>{t('prosthesisTypes.loading', { defaultValue: 'Loading prosthesis types...' })}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
            <Sparkles size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 className="empty-state__title">
            {types.length === 0 ? t('prosthesisTypes.noProsthesis', { defaultValue: 'No prosthesis types registered' }) : t('prosthesisTypes.noMatching', { defaultValue: 'No matching records' })}
          </h3>
          <p className="empty-state__text">
            {types.length === 0
              ? t('prosthesisTypes.createDesc', { defaultValue: 'Add prosthesis types to define work items and build custom manufacturing workflow sequences.' })
              : t('processesPage.adjustFilters', { defaultValue: 'Try adjusting your search or filter criteria.' })}
          </p>
          {types.length === 0 && canEdit && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
            >
              <Plus size={18} />
              <span>{t('prosthesisTypes.createProsthesis', { defaultValue: 'Add Prosthesis Type' })}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="prosthesis-table">
            <thead>
              <tr>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('name')}>
                    {t('prosthesisTypes.prosthesisName', { defaultValue: 'Prosthesis Name' })}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>{t('common.description')}</th>
                <th>{t('prosthesisTypes.assignedSequence', { defaultValue: 'Assigned Workflow Sequence' })}</th>
                {!isAdmin && <th>{t('common.branch')}</th>}
                <th>
                  <button className="th-sort" onClick={() => toggleSort('createdAt')}>
                    {t('common.createdOn', { defaultValue: 'Created On' })}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                {canEdit && <th>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="cell-primary">
                      <div className="cell-avatar" style={{ background: 'linear-gradient(135deg, #E0C3FC, #8EC5FC)' }}>
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="cell-primary__name">{item.name}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {item.description ? (
                      <span className="cell-date" style={{ maxWidth: '250px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.4' }}>
                        {item.description}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {item.processAssignments && item.processAssignments.length > 0 ? (
                      <div 
                        style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', cursor: 'help' }}
                        title={item.processAssignments.map((a, idx) => `${idx + 1}. ${a.process.name}`).join('\n')}
                      >
                        {item.processAssignments.slice(0, 4).map((a, idx) => (
                          <span
                            key={a.id}
                            className="badge"
                            style={{
                              backgroundColor: 'var(--success-light, #ECFDF5)',
                              color: 'var(--success, #10B981)',
                              border: '1px solid var(--success-glow, #A7F3D0)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '0.125rem 0.5rem',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ opacity: 0.7, marginRight: '4px', fontWeight: 800 }}>{idx + 1}.</span>
                            {a.process.name}
                          </span>
                        ))}
                        {item.processAssignments.length > 4 && (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: 'var(--accent-primary-glow, #EFF6FF)',
                              color: 'var(--accent-primary, #3B82F6)',
                              border: '1px dashed var(--accent-primary, #3B82F6)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.125rem 0.5rem',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            + {t('prosthesisTypes.moreCount', { count: item.processAssignments.length - 4, defaultValue: `${item.processAssignments.length - 4} more` })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{t('prosthesisTypes.noProcesses', { defaultValue: 'No processes assigned' })}</span>
                    )}
                  </td>
                  {!isAdmin && (
                    <td>
                      {item.branch ? (
                        <div className="cell-primary" style={{ gap: '0.25rem' }}>
                          <Building2 size={12} style={{ color: 'var(--accent-primary)' }} />
                          <span className="cell-branch" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{item.branch.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  <td>
                    <span className="cell-date">
                      {new Date(item.createdAt).toLocaleDateString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn-action"
                          onClick={() => handleEditOpen(item)}
                          title={t('prosthesisTypes.editProsthesis')}
                        >
                          <span>{t('common.edit')}</span>
                        </button>
                        <button
                          className="btn-action"
                          style={{
                            borderColor: 'var(--accent-primary)',
                            color: 'var(--accent-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          onClick={() => handleReorderOpen(item)}
                          title={t('prosthesisTypes.manageSequence', { defaultValue: 'Manage Sequence' })}
                        >
                          <ListOrdered size={13} />
                          <span>{t('prosthesisTypes.sequence', { defaultValue: 'Sequence' })}</span>
                        </button>
                        <button
                          className="btn-action btn-action--danger"
                          onClick={() => confirmDelete(item)}
                          title={t('prosthesisTypes.deleteConfirm')}
                        >
                          <Trash2 size={15} />
                        </button>
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
          <div className="modal" style={{ maxWidth: '750px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('prosthesisTypes.createProsthesis')}</h2>
                <p className="modal__subtitle">{t('prosthesisTypes.createProsthesisSubtitle', { defaultValue: 'Register a new work type and build its manufacturing workflow' })}</p>
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
              <div style={{ display: 'grid', gridTemplateColumns: !isAdmin ? '1fr 1fr' : '1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-prosthesis-name">
                    {t('prosthesisTypes.prosthesisName')} *
                  </label>
                  <input
                    id="input-prosthesis-name"
                    className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder="e.g., Zirconia Crown"
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

                {!isAdmin && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-prosthesis-branch">
                      {t('common.branch')} *
                    </label>
                    <SearchableSelect
                      id="input-prosthesis-branch"
                      options={branches.map((b) => ({
                        value: b.id,
                        label: b.name,
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
              </div>

              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" htmlFor="input-prosthesis-desc">
                  {t('common.description')}
                </label>
                <textarea
                  id="input-prosthesis-desc"
                  className="form-input"
                  style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                  placeholder="e.g., Premium custom zirconia crown for molar restoration."
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Workflow builder sequence section */}
              <div className="form-group" style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
                  {t('prosthesisTypes.sequenceBuilder', { defaultValue: 'Workflow Sequence Builder' })}
                </label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
                  {t('prosthesisTypes.sequenceBuilderDesc', { defaultValue: 'Assign processes and arrange them in the sequence they should be executed for this prosthesis type.' })}
                </p>

                {!activeBranchId ? (
                  <div className="empty-state" style={{ padding: '2rem', minHeight: 'auto', border: '1px dashed var(--border)', borderRadius: '12px', backgroundColor: 'var(--bg-overlay, #F8FAFC)' }}>
                    <AlertCircle size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {t('prosthesisTypes.selectBranchFirstDesc', { defaultValue: 'Please select a branch first to load available workflow processes.' })}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '1.25rem', minHeight: '220px' }}>
                    {/* Left Column: Available Processes */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', backgroundColor: 'var(--bg-overlay, #F8FAFC)', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                        {t('prosthesisTypes.availableProcesses', { defaultValue: 'Available Processes' })} ({filteredBranchProcesses.length})
                      </span>
                      
                      {/* Search Bar */}
                      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem' }}>
                        <div className="search-input-wrap" style={{ flexGrow: 1, height: '32px' }}>
                          <Search size={14} className="search-input__icon" style={{ left: '8px' }} />
                          <input
                            type="text"
                            className="form-input search-input"
                            style={{ height: '32px', fontSize: '0.75rem', paddingLeft: '28px', paddingRight: '24px', borderRadius: '6px', width: '100%' }}
                            placeholder={t('prosthesisTypes.searchProcessesPlaceholder', { defaultValue: 'Search processes...' })}
                            value={processSearch}
                            onChange={(e) => setProcessSearch(e.target.value)}
                          />
                          {processSearch && (
                            <button
                              type="button"
                              className="search-input__clear"
                              style={{ right: '8px' }}
                              onClick={() => setProcessSearch('')}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn--primary"
                          style={{ height: '32px', padding: '0 0.5rem', fontSize: '0.75rem', minWidth: 'auto', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Search size={12} />
                          <span>{t('prosthesisTypes.searchProcesses', { defaultValue: 'Search' })}</span>
                        </button>
                      </div>

                      {filteredBranchProcesses.length === 0 ? (
                        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {processSearch ? t('common.noResults') : t('prosthesisTypes.noProcessesBranch', { defaultValue: 'No processes found for this branch. Create them in the Processes Page first.' })}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                          {filteredBranchProcesses.map((p) => {
                            const isSelected = (form.processIds || []).includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                disabled={isSelected || saving}
                                onClick={() => addProcessToForm(p.id)}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  textAlign: 'left',
                                  width: '100%',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  backgroundColor: isSelected ? 'rgba(0,0,0,0.02)' : '#FFFFFF',
                                  cursor: isSelected ? 'default' : 'pointer',
                                  transition: 'all 0.2s',
                                  opacity: isSelected ? 0.5 : 1,
                                }}
                              >
                                <div style={{ flexGrow: 1, minWidth: 0 }}>
                                  <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{p.processArea}</span>
                                </div>
                                {!isSelected && (
                                  <span style={{
                                    fontSize: '0.6875rem',
                                    color: 'var(--accent-primary)',
                                    fontWeight: 700,
                                    backgroundColor: 'var(--accent-primary-glow)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    flexShrink: 0
                                  }}>+ {t('common.add', { defaultValue: 'Add' })}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Sequence Order */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                        {t('prosthesisTypes.selectedSequence', { defaultValue: 'Selected Workflow Sequence' })} ({(form.processIds || []).length})
                      </span>
                      {(form.processIds || []).length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', border: '1px dashed var(--border)', borderRadius: '6px', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {t('prosthesisTypes.noProcessesAddedDesc', { defaultValue: 'No processes added yet. Click available processes on the left to build the sequence.' })}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                          {(form.processIds || []).map((id, index) => {
                            const p = branchProcesses.find((bp) => bp.id === id);
                            if (!p) return null;
                            return (
                              <div
                                key={id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  backgroundColor: '#FFFFFF',
                                }}
                              >
                                <span style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--accent-primary)',
                                  color: '#FFFFFF',
                                  fontSize: '0.6875rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  marginRight: '0.5rem',
                                  flexShrink: 0
                                }}>
                                  {index + 1}
                                </span>
                                <div style={{ flexGrow: 1, minWidth: 0 }}>
                                  <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{p.processArea}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', marginLeft: '0.25rem', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    disabled={index === 0 || saving}
                                    onClick={() => moveProcessInForm(index, 'up')}
                                    style={{ padding: '4px', border: 'none', background: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1, display: 'inline-flex' }}
                                    title={t('common.moveUp', { defaultValue: 'Move Up' })}
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === (form.processIds || []).length - 1 || saving}
                                    onClick={() => moveProcessInForm(index, 'down')}
                                    style={{ padding: '4px', border: 'none', background: 'none', cursor: index === (form.processIds || []).length - 1 ? 'default' : 'pointer', opacity: index === (form.processIds || []).length - 1 ? 0.3 : 1, display: 'inline-flex' }}
                                    title={t('common.moveDown', { defaultValue: 'Move Down' })}
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => removeProcessFromForm(index)}
                                    style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', marginLeft: '4px' }}
                                    title={t('common.remove')}
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal__footer" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowCreateModal(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button
                  id="btn-submit-prosthesis"
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
                    <span>{t('prosthesisTypes.createProsthesis')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedType && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: '750px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('prosthesisTypes.editProsthesis')}</h2>
                <p className="modal__subtitle">{t('prosthesisTypes.updateDetails', { defaultValue: 'Update details and workflow sequences for' })} <strong>{selectedType.name}</strong></p>
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
              <div style={{ display: 'grid', gridTemplateColumns: !isAdmin ? '1fr 1fr' : '1fr', gap: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-prosthesis-name">
                    {t('prosthesisTypes.prosthesisName')} *
                  </label>
                  <input
                    id="input-edit-prosthesis-name"
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

                {!isAdmin && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="input-edit-prosthesis-branch">
                      {t('common.branch')} *
                    </label>
                    <SearchableSelect
                      id="input-edit-prosthesis-branch"
                      options={branches.map((b) => ({
                        value: b.id,
                        label: b.name,
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
              </div>

              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" htmlFor="input-edit-prosthesis-desc">
                  {t('common.description')}
                </label>
                <textarea
                  id="input-edit-prosthesis-desc"
                  className="form-input"
                  style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Workflow builder sequence section */}
              <div className="form-group" style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
                  {t('prosthesisTypes.sequenceBuilder', { defaultValue: 'Workflow Sequence Builder' })}
                </label>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
                  {t('prosthesisTypes.sequenceBuilderDesc', { defaultValue: 'Assign processes and arrange them in the sequence they should be executed for this prosthesis type.' })}
                </p>

                {!activeBranchId ? (
                  <div className="empty-state" style={{ padding: '2rem', minHeight: 'auto', border: '1px dashed var(--border)', borderRadius: '12px', backgroundColor: 'var(--bg-overlay, #F8FAFC)' }}>
                    <AlertCircle size={24} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {t('prosthesisTypes.selectBranchFirstDesc', { defaultValue: 'Please select a branch first to load available workflow processes.' })}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '1.25rem', minHeight: '220px' }}>
                    {/* Left Column: Available Processes */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', backgroundColor: 'var(--bg-overlay, #F8FAFC)', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                        {t('prosthesisTypes.availableProcesses', { defaultValue: 'Available Processes' })} ({filteredBranchProcesses.length})
                      </span>
                      
                      {/* Search Bar */}
                      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem' }}>
                        <div className="search-input-wrap" style={{ flexGrow: 1, height: '32px' }}>
                          <Search size={14} className="search-input__icon" style={{ left: '8px' }} />
                          <input
                            type="text"
                            className="form-input search-input"
                            style={{ height: '32px', fontSize: '0.75rem', paddingLeft: '28px', paddingRight: '24px', borderRadius: '6px', width: '100%' }}
                            placeholder={t('prosthesisTypes.searchProcessesPlaceholder', { defaultValue: 'Search processes...' })}
                            value={processSearch}
                            onChange={(e) => setProcessSearch(e.target.value)}
                          />
                          {processSearch && (
                            <button
                              type="button"
                              className="search-input__clear"
                              style={{ right: '8px' }}
                              onClick={() => setProcessSearch('')}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn--primary"
                          style={{ height: '32px', padding: '0 0.5rem', fontSize: '0.75rem', minWidth: 'auto', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Search size={12} />
                          <span>{t('prosthesisTypes.searchProcesses', { defaultValue: 'Search' })}</span>
                        </button>
                      </div>

                      {filteredBranchProcesses.length === 0 ? (
                        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {processSearch ? t('common.noResults') : t('prosthesisTypes.noProcessesBranch', { defaultValue: 'No processes found for this branch. Create them in the Processes Page first.' })}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                          {filteredBranchProcesses.map((p) => {
                            const isSelected = (form.processIds || []).includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                disabled={isSelected || saving}
                                onClick={() => addProcessToForm(p.id)}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  textAlign: 'left',
                                  width: '100%',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  backgroundColor: isSelected ? 'rgba(0,0,0,0.02)' : '#FFFFFF',
                                  cursor: isSelected ? 'default' : 'pointer',
                                  transition: 'all 0.2s',
                                  opacity: isSelected ? 0.5 : 1,
                                }}
                              >
                                <div style={{ flexGrow: 1, minWidth: 0 }}>
                                  <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{p.processArea}</span>
                                </div>
                                {!isSelected && (
                                  <span style={{
                                    fontSize: '0.6875rem',
                                    color: 'var(--accent-primary)',
                                    fontWeight: 700,
                                    backgroundColor: 'var(--accent-primary-glow)',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    flexShrink: 0
                                  }}>+ {t('common.add', { defaultValue: 'Add' })}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Sequence Order */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                        {t('prosthesisTypes.selectedSequence', { defaultValue: 'Selected Workflow Sequence' })} ({(form.processIds || []).length})
                      </span>
                      {(form.processIds || []).length === 0 ? (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', border: '1px dashed var(--border)', borderRadius: '6px', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {t('prosthesisTypes.noProcessesAddedDesc', { defaultValue: 'No processes added yet. Click available processes on the left to build the sequence.' })}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                          {(form.processIds || []).map((id, index) => {
                            const p = branchProcesses.find((bp) => bp.id === id);
                            if (!p) return null;
                            return (
                              <div
                                key={id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  backgroundColor: '#FFFFFF',
                                }}
                              >
                                <span style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--accent-primary)',
                                  color: '#FFFFFF',
                                  fontSize: '0.6875rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  marginRight: '0.5rem',
                                  flexShrink: 0
                                }}>
                                  {index + 1}
                                </span>
                                <div style={{ flexGrow: 1, minWidth: 0 }}>
                                  <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{p.processArea}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', marginLeft: '0.25rem', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    disabled={index === 0 || saving}
                                    onClick={() => moveProcessInForm(index, 'up')}
                                    style={{ padding: '4px', border: 'none', background: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1, display: 'inline-flex' }}
                                    title={t('common.moveUp', { defaultValue: 'Move Up' })}
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === (form.processIds || []).length - 1 || saving}
                                    onClick={() => moveProcessInForm(index, 'down')}
                                    style={{ padding: '4px', border: 'none', background: 'none', cursor: index === (form.processIds || []).length - 1 ? 'default' : 'pointer', opacity: index === (form.processIds || []).length - 1 ? 0.3 : 1, display: 'inline-flex' }}
                                    title={t('common.moveDown', { defaultValue: 'Move Down' })}
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => removeProcessFromForm(index)}
                                    style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'inline-flex', marginLeft: '4px' }}
                                    title={t('common.remove')}
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal__footer" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button
                  id="btn-submit-edit-prosthesis"
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
                    <span>{t('prosthesisTypes.editProsthesis')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reorder/Sequence Management Modal */}
      {showReorderModal && reorderTarget && (
        <div className="modal-overlay" onClick={() => !saving && setShowReorderModal(false)}>
          <div className="modal" style={{ maxWidth: '550px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ListOrdered size={20} style={{ color: 'var(--accent-primary)' }} />
                  {t('prosthesisTypes.assignedSequence', { defaultValue: 'Workflow Sequence' })}
                </h2>
                <p className="modal__subtitle">
                  {t('prosthesisTypes.configureSequenceFor', { defaultValue: 'Configure sequence order for' })} <strong>{reorderTarget.name}</strong>
                </p>
              </div>
              <button
                className="modal__close"
                onClick={() => !saving && setShowReorderModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal__body">
              {reordering ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 0', gap: '1rem' }}>
                  <Loader2 size={36} className="spinner" style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t('prosthesisTypes.loadingWorkflowDetails', { defaultValue: 'Loading workflow details...' })}</span>
                </div>
              ) : reorderProcessesList.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                  <GitMerge size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: 600 }}>{t('prosthesisTypes.noProcesses', { defaultValue: 'No processes assigned' })}</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '280px' }}>
                    {t('prosthesisTypes.noProcessesAssignedDesc', { defaultValue: "This prosthesis type doesn't have any workflow stages assigned. Edit this type to assign stages first." })}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '0.5rem 0' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
                    {t('prosthesisTypes.moveProcessesDesc', { defaultValue: 'Move processes up or down to set the correct manufacturing step order. Sequence starts at 1.' })}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                    {reorderProcessesList.map((item, index) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.625rem 0.875rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-card)',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      >
                        <span style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-primary)',
                          color: '#FFFFFF',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          marginRight: '0.75rem',
                          flexShrink: 0
                        }}>
                          {index + 1}
                        </span>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.process.name}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {item.process.processArea}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', marginLeft: '0.5rem' }}>
                          <button
                            type="button"
                            disabled={index === 0 || saving}
                            onClick={() => moveProcessInModalList(index, 'up')}
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: '#FFFFFF',
                              cursor: index === 0 ? 'default' : 'pointer',
                              opacity: index === 0 ? 0.3 : 1,
                              display: 'inline-flex',
                            }}
                            title={t('common.moveUp', { defaultValue: 'Move Up' })}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={index === reorderProcessesList.length - 1 || saving}
                            onClick={() => moveProcessInModalList(index, 'down')}
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: '#FFFFFF',
                              cursor: index === reorderProcessesList.length - 1 ? 'default' : 'pointer',
                              opacity: index === reorderProcessesList.length - 1 ? 0.3 : 1,
                              display: 'inline-flex',
                            }}
                            title={t('common.moveDown', { defaultValue: 'Move Down' })}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal__footer" style={{ 
              borderTop: '1px solid var(--border)', 
              padding: '1.25rem 1.75rem', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              backgroundColor: 'var(--bg-overlay, #F8FAFC)',
              borderBottomLeftRadius: 'var(--radius-xl, 20px)',
              borderBottomRightRadius: 'var(--radius-xl, 20px)',
              gap: '0.75rem',
              marginTop: '0'
            }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowReorderModal(false)}
                disabled={saving}
              >
                {t('common.close', { defaultValue: 'Close' })}
              </button>
              {reorderProcessesList.length > 0 && (
                <button
                   type="button"
                   className="btn btn--primary"
                   onClick={handleReorderSave}
                   disabled={saving || reordering}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <span>{t('prosthesisTypes.saveSequence', { defaultValue: 'Save Sequence' })}</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && typeToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('prosthesisTypes.deleteConfirm')}</h2>
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
                {t('prosthesisTypes.deleteConfirmLongText', { name: typeToDelete.name, defaultValue: `Are you sure you want to delete ${typeToDelete.name}? This action will permanently remove this work type and delete its assigned workflow step orders. Existing work orders already using this type will remain.` })}
              </p>
            </div>

            <div className="modal__footer" style={{ 
              borderTop: '1px solid var(--border)', 
              padding: '1.25rem 1.75rem', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              backgroundColor: 'var(--bg-overlay, #F8FAFC)',
              borderBottomLeftRadius: 'var(--radius-xl, 20px)',
              borderBottomRightRadius: 'var(--radius-xl, 20px)',
              gap: '0.75rem',
              marginTop: '0'
            }}>
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

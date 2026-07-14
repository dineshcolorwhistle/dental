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
  Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  processAreaService,
  branchService,
  type ProcessAreaListItem,
  type BranchListItem,
  type CreateProcessAreaPayload,
} from '../services';
import { useAuth } from '../context';
import { Pagination } from '../components';

export function ProcessAreasPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canEdit = user?.role === 'ADMIN';

  const [processAreas, setProcessAreas] = useState<ProcessAreaListItem[]>([]);
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
  const [selectedArea, setSelectedArea] = useState<ProcessAreaListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState<ProcessAreaListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [form, setForm] = useState<CreateProcessAreaPayload>({
    name: '',
    description: '',
    branchId: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateProcessAreaPayload, string>>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;
      const [areaData, branchData] = await Promise.all([
        processAreaService.getAll(branchScope),
        isAdmin ? Promise.resolve([]) : branchService.getAll(),
      ]);
      setProcessAreas(areaData);
      setBranches(branchData.filter((b) => b.isActive));
    } catch (err) {
      toast.error(t('processAreasPage.failedLoad'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.branchId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Filtering & Sorting ────────────────────────────

  const filtered = processAreas
    .filter((area) => {
      if (!isAdmin && selectedBranchFilter !== 'ALL' && area.branchId !== selectedBranchFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          area.name.toLowerCase().includes(q) ||
          (area.description && area.description.toLowerCase().includes(q)) ||
          (area.branch && area.branch.name.toLowerCase().includes(q))
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
    const errors: Partial<Record<keyof CreateProcessAreaPayload, string>> = {};

    if (!form.name.trim()) errors.name = t('validation.fieldRequired');
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
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditOpen = (area: ProcessAreaListItem) => {
    setSelectedArea(area);
    setForm({
      name: area.name,
      description: area.description || '',
      branchId: area.branchId || '',
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload: CreateProcessAreaPayload = {
        name: form.name,
        description: form.description,
        branchId: isAdmin ? user?.branchId || undefined : form.branchId,
      };

      await processAreaService.create(payload);
      toast.success(t('processAreasPage.createSuccess'));
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('errors.failedOperation', { defaultValue: 'Operation failed' });
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArea || !validateForm()) return;

    try {
      setSaving(true);
      const payload: Partial<CreateProcessAreaPayload> = {
        name: form.name,
        description: form.description,
        branchId: isAdmin ? user?.branchId || undefined : form.branchId,
      };

      await processAreaService.update(selectedArea.id, payload);
      toast.success(t('processAreasPage.updateSuccess'));
      setShowEditModal(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || t('errors.failedOperation', { defaultValue: 'Operation failed' });
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTrigger = (area: ProcessAreaListItem) => {
    setAreaToDelete(area);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!areaToDelete) return;
    try {
      setDeleting(true);
      await processAreaService.delete(areaToDelete.id);
      toast.success(t('processAreasPage.deleteSuccess'));
      setDeleteModalOpen(false);
      setAreaToDelete(null);
      fetchData();
    } catch (err: any) {
      let errorMsg = err.response?.data?.message;
      if (errorMsg === 'Cannot delete Process Area because it is currently linked to processes.') {
        errorMsg = t('processAreasPage.cannotDeleteAssignedArea', { defaultValue: 'Cannot delete process area because it is assigned to one or more processes.' });
      } else {
        errorMsg = errorMsg || t('errors.failedOperation', { defaultValue: 'Operation failed' });
      }
      toast.error(errorMsg);
    } finally {
      setDeleting(false);
    }
  };

  const handleInputChange = (field: keyof CreateProcessAreaPayload, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const toggleSort = (field: 'name' | 'createdAt') => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('processAreasPage.title')}</h1>
          <p className="page-subtitle">{t('processAreasPage.subtitle')}</p>
        </div>

        {canEdit && (
          <button className="btn btn--primary" onClick={handleCreateOpen}>
            <Plus size={18} />
            <span>{t('processAreasPage.addArea')}</span>
          </button>
        )}
      </div>

      {/* Stats Section to Match Other Pages */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <Layers size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{processAreas.length}</span>
            <span className="stat-card__label">Total Classification Areas</span>
          </div>
        </div>
      </div>

      {/* Reusable Table Toolbar style */}
      <div className="table-toolbar" style={{ gap: '1rem' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-area-search"
            type="text"
            className="form-input search-input"
            placeholder={t('common.search')}
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
          {!isAdmin && branches.length > 0 && (
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

      {/* Main Table using standard classes */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>{t('processesPage.loading', { defaultValue: 'Loading process areas...' })}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
            <Layers size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 className="empty-state__title">
            {t('common.noResults')}
          </h3>
          <p className="empty-state__text">
            {t('common.noResults')}
          </p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="process-areas-table">
            <thead>
              <tr>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('name')}>
                    {t('processAreasPage.areaName')}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>{t('processAreasPage.description')}</th>
                {!isAdmin && <th>{t('processAreasPage.branch')}</th>}
                <th>
                  <button className="th-sort" onClick={() => toggleSort('createdAt')}>
                    {t('common.createdOn')}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                {canEdit && <th>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((area) => (
                <tr key={area.id}>
                  <td>
                    <div className="cell-primary">
                      <div className="cell-avatar" style={{ background: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)' }}>
                        A
                      </div>
                      <div>
                        <span className="cell-primary__name">{area.name}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {area.description || <span className="text-muted">—</span>}
                  </td>
                  {!isAdmin && (
                    <td>
                      {area.branch ? (
                        <div className="cell-primary" style={{ gap: '0.25rem' }}>
                          <Building2 size={12} style={{ color: 'var(--accent-primary)' }} />
                          <span className="cell-branch" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{area.branch.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  <td>
                    {new Date(area.createdAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn-action"
                          onClick={() => handleEditOpen(area)}
                          title={t('common.edit')}
                        >
                          <span>{t('common.edit')}</span>
                        </button>
                        <button
                          className="btn-action btn-action--danger"
                          onClick={() => handleDeleteTrigger(area)}
                          title={t('common.delete')}
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('processAreasPage.addArea')}</h2>
              </div>
              <button className="modal__close" onClick={() => !saving && setShowCreateModal(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <form className="modal__body" onSubmit={handleCreate}>
              {!isAdmin && branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-area-branch">
                    {t('admins.assignedBranch')} *
                  </label>
                  <select
                    id="select-area-branch"
                    className="form-input"
                    value={form.branchId || ''}
                    onChange={(e) => handleInputChange('branchId', e.target.value)}
                    disabled={saving}
                  >
                    <option value="">{t('branches.selectBranch')}</option>
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

              <div className="form-group">
                <label className="form-label" htmlFor="input-area-name">
                  {t('processAreasPage.areaName')} *
                </label>
                <input
                  id="input-area-name"
                  className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., Scanning, Design, Milling, QC"
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
                <label className="form-label" htmlFor="input-area-description">
                  {t('processAreasPage.description')}
                </label>
                <textarea
                  id="input-area-description"
                  className="form-input"
                  rows={3}
                  placeholder="Provide a brief description of what gets done in this area..."
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="modal__footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowCreateModal(false)} disabled={saving}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <span>{t('common.create')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedArea && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('processAreasPage.editArea')}</h2>
              </div>
              <button className="modal__close" onClick={() => !saving && setShowEditModal(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <form className="modal__body" onSubmit={handleUpdate}>
              {!isAdmin && branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-edit-area-branch">
                    {t('admins.assignedBranch')} *
                  </label>
                  <select
                    id="select-edit-area-branch"
                    className="form-input"
                    value={form.branchId || ''}
                    onChange={(e) => handleInputChange('branchId', e.target.value)}
                    disabled={saving}
                  >
                    <option value="">{t('branches.selectBranch')}</option>
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

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-area-name">
                  {t('processAreasPage.areaName')} *
                </label>
                <input
                  id="input-edit-area-name"
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
                <label className="form-label" htmlFor="input-edit-area-description">
                  {t('processAreasPage.description')}
                </label>
                <textarea
                  id="input-edit-area-description"
                  className="form-input"
                  rows={3}
                  value={form.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="modal__footer">
                <button type="button" className="btn btn--ghost" onClick={() => setShowEditModal(false)} disabled={saving}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
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

      {/* Delete Confirmation Modal Overlay */}
      {deleteModalOpen && areaToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('processAreasPage.deleteConfirmTitle')}</h2>
              </div>
              <button className="modal__close" onClick={() => !deleting && setDeleteModalOpen(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1rem 1.75rem' }}>
              <p style={{ margin: 0, color: 'var(--text-body)' }}>
                {t('processAreasPage.deleteConfirmMessage')}
              </p>
              <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                {t('common.name')}: <strong>{areaToDelete.name}</strong>
              </p>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button type="button" className="btn btn--ghost" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ backgroundColor: 'var(--danger)' }}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>{t('common.deleting')}</span>
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

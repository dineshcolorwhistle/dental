import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Search,
  X,
  Users,
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  GitBranch,
  Loader2,
  ArrowUpDown,
  Settings,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { tenantService, type TenantListItem, type CreateTenantPayload } from '../services';
import { Pagination, PhoneInput } from '../components';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export function TenantsPage() {
  const { t, i18n } = useTranslation();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Reset pagination when filters or search change
  useEffect(() => {
    setCurrentPage(0);
  }, [search, statusFilter]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Features modal state
  const [featuresModalOpen, setFeaturesModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantListItem | null>(null);
  const [updatingFeatures, setUpdatingFeatures] = useState(false);
  const [featureForm, setFeatureForm] = useState<Record<string, boolean>>({});

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<TenantListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    maxOwners: 1,
    maxAdmins: 3,
    maxTechnicians: 6,
  });
  const [editFormErrors, setEditFormErrors] = useState<Partial<Record<keyof typeof editForm, string>>>({});

  // Form state
  const [form, setForm] = useState<CreateTenantPayload>({
    tenantName: '',
    ownerName: '',
    ownerEmail: '',
    maxOwners: 1,
    maxAdmins: 3,
    maxTechnicians: 6,
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateTenantPayload, string>>>({});

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tenantService.getAll();
      setTenants(data);
    } catch (err) {
      toast.error(t('tenants.failedLoad', { defaultValue: 'Failed to load tenants' }));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // ─── Filtering & Sorting ────────────────────────────

  const filtered = tenants
    .filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.subdomain.toLowerCase().includes(q) ||
          t.owner?.email?.toLowerCase().includes(q) ||
          t.owner?.firstName?.toLowerCase().includes(q) ||
          t.owner?.lastName?.toLowerCase().includes(q)
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

  // ─── Stats ──────────────────────────────────────────

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === 'ACTIVE').length,
    inactive: tenants.filter((t) => t.status !== 'ACTIVE').length,
  };

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateTenantPayload, string>> = {};

    if (!form.tenantName.trim()) errors.tenantName = t('validation.fieldRequired');
    if (!form.ownerName.trim()) errors.ownerName = t('validation.fieldRequired');
    if (!form.ownerEmail.trim()) {
      errors.ownerEmail = t('validation.fieldRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail)) {
      errors.ownerEmail = t('validation.invalidEmail');
    }
    if (form.maxOwners === undefined || form.maxOwners === null || isNaN(form.maxOwners) || form.maxOwners < 1) {
      errors.maxOwners = t('tenants.validationOwnersLimit', { defaultValue: 'Owner Count must be at least 1' });
    }
    if (form.maxAdmins === undefined || form.maxAdmins === null || isNaN(form.maxAdmins) || form.maxAdmins < 0) {
      errors.maxAdmins = t('tenants.validationAdminsLimit', { defaultValue: 'Lab Admin Count must be >= 0' });
    }
    if (form.maxTechnicians === undefined || form.maxTechnicians === null || isNaN(form.maxTechnicians) || form.maxTechnicians < 0) {
      errors.maxTechnicians = t('tenants.validationTechsLimit', { defaultValue: 'Lab Technician Count must be >= 0' });
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setCreating(true);
      await tenantService.create(form);
      toast.success(t('tenants.createSuccess', { defaultValue: 'Tenant created successfully! Invite email sent.' }));
      setShowCreateModal(false);
      setForm({ tenantName: '', ownerName: '', ownerEmail: '', maxOwners: 1, maxAdmins: 3, maxTechnicians: 6 });
      setFormErrors({});
      await fetchTenants();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('tenants.failedCreate', { defaultValue: 'Failed to create tenant' });
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (field: keyof CreateTenantPayload, value: any) => {
    let finalValue = value;
    if (field === 'maxOwners' || field === 'maxAdmins' || field === 'maxTechnicians') {
      finalValue = parseInt(value, 10);
      if (isNaN(finalValue)) finalValue = 0;
    }
    setForm((prev) => ({ ...prev, [field]: finalValue }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
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

  const handleToggleStatus = async (tenant: TenantListItem) => {
    const newStatus = tenant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await tenantService.updateStatus(tenant.id, newStatus);
      toast.success(t('tenants.statusChanged', { status: newStatus === 'ACTIVE' ? t('common.active') : t('common.inactive'), defaultValue: `Tenant ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}` }));
      await fetchTenants();
    } catch {
      toast.error(t('tenants.failedUpdate', { defaultValue: 'Failed to update tenant status' }));
    }
  };

  const openFeaturesModal = (tenant: TenantListItem) => {
    setSelectedTenant(tenant);
    // Initialize form with tenant's existing features, or defaults
    setFeatureForm({
      qrWorkflow: tenant.settings?.features?.qrWorkflow ?? false,
      deliveryModule: tenant.settings?.features?.deliveryModule ?? false,
      doctorPortal: tenant.settings?.features?.doctorPortal ?? false,
    });
    setFeaturesModalOpen(true);
  };

  const handleToggleFeature = (featureName: string) => {
    setFeatureForm((prev) => ({
      ...prev,
      [featureName]: !prev[featureName],
    }));
  };

  const handleSaveFeatures = async () => {
    if (!selectedTenant) return;
    try {
      setUpdatingFeatures(true);
      await tenantService.update(selectedTenant.id, {
        settings: { features: featureForm },
      });
      toast.success(t('tenants.featuresUpdated', { defaultValue: 'Tenant features updated successfully' }));
      setFeaturesModalOpen(false);
      await fetchTenants();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('tenants.failedUpdateFeatures', { defaultValue: 'Failed to update features' }));
    } finally {
      setUpdatingFeatures(false);
    }
  };

  const confirmDelete = (tenant: TenantListItem) => {
    setTenantToDelete(tenant);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!tenantToDelete) return;
    try {
      setDeleting(true);
      await tenantService.delete(tenantToDelete.id);
      toast.success(t('tenants.deleteSuccess', { defaultValue: 'Tenant deleted successfully' }));
      setDeleteModalOpen(false);
      setTenantToDelete(null);
      await fetchTenants();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('tenants.failedDelete', { defaultValue: 'Failed to delete tenant' }));
    } finally {
      setDeleting(false);
    }
  };

  const handleEditOpen = (tenant: TenantListItem) => {
    setSelectedTenant(tenant);
    setEditForm({
      name: tenant.name,
      contactEmail: tenant.contactEmail || '',
      contactPhone: tenant.contactPhone || '',
      address: tenant.address || '',
      status: tenant.status,
      maxOwners: tenant.maxOwners ?? 1,
      maxAdmins: tenant.maxAdmins ?? 3,
      maxTechnicians: tenant.maxTechnicians ?? 6,
    });
    setEditFormErrors({});
    setShowEditModal(true);
  };

  const handleEditInputChange = (field: keyof typeof editForm, value: any) => {
    let finalValue = value;
    if (field === 'maxOwners' || field === 'maxAdmins' || field === 'maxTechnicians') {
      finalValue = parseInt(value, 10);
      if (isNaN(finalValue)) finalValue = 0;
    }
    setEditForm((prev) => ({ ...prev, [field]: finalValue }));
    if (editFormErrors[field]) {
      setEditFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateEditForm = (): boolean => {
    const errors: Partial<Record<keyof typeof editForm, string>> = {};

    if (!editForm.name.trim()) errors.name = t('validation.fieldRequired');
    if (editForm.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.contactEmail)) {
      errors.contactEmail = t('validation.invalidEmail');
    }
    if (editForm.maxOwners === undefined || editForm.maxOwners === null || isNaN(editForm.maxOwners) || editForm.maxOwners < 1) {
      errors.maxOwners = t('tenants.validationOwnersLimit', { defaultValue: 'Owner Count must be at least 1' });
    }
    if (editForm.maxAdmins === undefined || editForm.maxAdmins === null || isNaN(editForm.maxAdmins) || editForm.maxAdmins < 0) {
      errors.maxAdmins = t('tenants.validationAdminsLimit', { defaultValue: 'Lab Admin Count must be >= 0' });
    }
    if (editForm.maxTechnicians === undefined || editForm.maxTechnicians === null || isNaN(editForm.maxTechnicians) || editForm.maxTechnicians < 0) {
      errors.maxTechnicians = t('tenants.validationTechsLimit', { defaultValue: 'Lab Technician Count must be >= 0' });
    }

    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant || !validateEditForm()) return;

    try {
      setSaving(true);
      await tenantService.update(selectedTenant.id, editForm);
      toast.success(t('tenants.updateSuccess', { defaultValue: 'Tenant updated successfully!' }));
      setShowEditModal(false);
      await fetchTenants();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('tenants.failedUpdate', { defaultValue: 'Failed to update tenant' });
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Status Badge ───────────────────────────────────

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { className: string; icon: React.ReactNode; labelKey: string }> = {
      ACTIVE: { className: 'badge badge--success', icon: <CheckCircle2 size={12} />, labelKey: 'enums.userStatus.ACTIVE' },
      INACTIVE: { className: 'badge badge--warning', icon: <XCircle size={12} />, labelKey: 'enums.userStatus.INACTIVE' },
      SUSPENDED: { className: 'badge badge--danger', icon: <AlertCircle size={12} />, labelKey: 'enums.userStatus.SUSPENDED' },
    };
    const current = config[status] || { className: 'badge badge--warning', icon: <XCircle size={12} />, labelKey: 'enums.userStatus.INACTIVE' };
    return <span className={current.className}>{current.icon} {t(current.labelKey, { defaultValue: status })}</span>;
  };

  // ─── Render ─────────────────────────────────────────

  return (
    <div className="tenants-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('tenants.title', { defaultValue: 'Tenants' })}</h1>
          <p className="page-header__subtitle">{t('tenants.subtitle', { defaultValue: 'Manage dental lab organizations' })}</p>
        </div>
        <button
          id="btn-add-tenant"
          className="btn btn--primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={18} />
          <span>{t('tenants.createTenant', { defaultValue: 'Add Tenant' })}</span>
        </button>
      </div>

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <Building2 size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">{t('tenants.totalTenants', { defaultValue: 'Total Tenants' })}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--success">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.active}</span>
            <span className="stat-card__label">{t('common.active')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--warning">
            <XCircle size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.inactive}</span>
            <span className="stat-card__label">{t('common.inactive')}</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="table-toolbar">
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-tenant-search"
            type="text"
            className="form-input search-input"
            placeholder={t('tenants.searchPlaceholder', { defaultValue: 'Search tenants...' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-input__clear" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="table-toolbar__filters">
          {(['ALL', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              className={`filter-chip ${statusFilter === s ? 'filter-chip--active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'ALL' ? t('common.all') : s === 'ACTIVE' ? t('enums.userStatus.ACTIVE') : s === 'INACTIVE' ? t('enums.userStatus.INACTIVE') : t('enums.userStatus.SUSPENDED', { defaultValue: 'Suspended' })}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>{t('tenants.loading', { defaultValue: 'Loading tenants...' })}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <Building2 size={48} />
          </div>
          <h3 className="empty-state__title">
            {tenants.length === 0 ? t('tenants.noTenants', { defaultValue: 'No tenants yet' }) : t('tenants.noMatching', { defaultValue: 'No matching tenants' })}
          </h3>
          <p className="empty-state__text">
            {tenants.length === 0
              ? t('tenants.createDesc', { defaultValue: 'Create your first tenant to get started with the platform.' })
              : t('processesPage.adjustFilters', { defaultValue: 'Try adjusting your search or filter criteria.' })}
          </p>
          {tenants.length === 0 && (
            <button
              className="btn btn--primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={18} />
              <span>{t('tenants.createTenant', { defaultValue: 'Add Tenant' })}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="tenants-table">
            <thead>
              <tr>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('name')}>
                    {t('tenants.labName', { defaultValue: 'Lab Name' })}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>{t('tenants.owner', { defaultValue: 'Owner' })}</th>
                <th>{t('common.branch')}</th>
                <th>{t('tenants.subdomain', { defaultValue: 'Subdomain' })}</th>
                <th>{t('common.status')}</th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('createdAt')}>
                    {t('common.created', { defaultValue: 'Created' })}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <div className="cell-primary">
                      <div className="cell-avatar">
                        {tenant.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="cell-primary__name">{tenant.name}</span>
                        <span className="cell-primary__meta">
                          <Users size={12} /> {tenant.userCount} {t('tenants.users', { defaultValue: 'users' })} · <GitBranch size={12} /> {tenant.branchCount} {t('tenants.branches', { defaultValue: 'branches' })}
                        </span>
                        <span className="cell-primary__meta" style={{ marginTop: '0.25rem' }}>
                          {t('tenants.limitsSummary', { maxOwners: tenant.maxOwners, maxAdmins: tenant.maxAdmins, maxTechnicians: tenant.maxTechnicians, defaultValue: `Limits: ${tenant.maxOwners} Owner · ${tenant.maxAdmins} Admin(s) · ${tenant.maxTechnicians} Tech(s)` })}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {tenant.owner ? (
                      <div className="cell-user">
                        <span className="cell-user__name">
                          {tenant.owner.firstName} {tenant.owner.lastName}
                        </span>
                        <span className="cell-user__email">
                          <Mail size={11} /> {tenant.owner.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {tenant.primaryBranch ? (
                      <span className="cell-branch">{tenant.primaryBranch.name}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="cell-subdomain">
                      <Globe size={12} />
                      {tenant.subdomain}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={tenant.status} />
                  </td>
                  <td>
                    <span className="cell-date">
                      {new Date(tenant.createdAt).toLocaleDateString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className={`btn-action ${tenant.status === 'ACTIVE' ? 'btn-action--danger' : 'btn-action--success'}`}
                        onClick={() => handleToggleStatus(tenant)}
                        title={tenant.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}
                      >
                        {tenant.status === 'ACTIVE' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                        <span>{tenant.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}</span>
                      </button>
                      <button
                        className="btn-action"
                        onClick={() => handleEditOpen(tenant)}
                        title={t('tenants.editTenant')}
                      >
                        <Pencil size={15} />
                        <span>{t('common.edit')}</span>
                      </button>
                      <button
                        className="btn-action btn-action--danger"
                        onClick={() => confirmDelete(tenant)}
                        title={t('tenants.deleteConfirm')}
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        className="btn-action"
                        onClick={() => openFeaturesModal(tenant)}
                        title={t('tenants.manageFeatures', { defaultValue: 'Manage Features' })}
                      >
                        <Settings size={15} />
                        <span>{t('tenants.features', { defaultValue: 'Features' })}</span>
                      </button>

                    </div>
                  </td>
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
        <div className="modal-overlay" onClick={() => !creating && setShowCreateModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('tenants.createTenant')}</h2>
                <p className="modal__subtitle">
                  {t('tenants.createTenantSubtitle', { defaultValue: 'Create a new dental lab organization' })}
                </p>
              </div>
              <button
                className="modal__close"
                onClick={() => !creating && setShowCreateModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form className="modal__body" onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label" htmlFor="input-tenant-name">
                  {t('tenants.labName', { defaultValue: 'Lab Name' })} *
                </label>
                <input
                  id="input-tenant-name"
                  className={`form-input ${formErrors.tenantName ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder={t('tenants.labNamePlaceholder', { defaultValue: 'e.g., Smile Dental Lab' })}
                  value={form.tenantName}
                  onChange={(e) => handleInputChange('tenantName', e.target.value)}
                  disabled={creating}
                  autoFocus
                />
                {formErrors.tenantName && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.tenantName}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-owner-name">
                  {t('tenants.ownerName', { defaultValue: 'Owner Name' })} *
                </label>
                <input
                  id="input-owner-name"
                  className={`form-input ${formErrors.ownerName ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder={t('tenants.ownerNamePlaceholder', { defaultValue: 'e.g., John Doe' })}
                  value={form.ownerName}
                  onChange={(e) => handleInputChange('ownerName', e.target.value)}
                  disabled={creating}
                />
                {formErrors.ownerName && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.ownerName}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-owner-email">
                  {t('tenants.ownerEmail', { defaultValue: 'Owner Email' })} *
                </label>
                <input
                  id="input-owner-email"
                  className={`form-input ${formErrors.ownerEmail ? 'form-input--error' : ''}`}
                  type="email"
                  placeholder={t('tenants.ownerEmailPlaceholder', { defaultValue: 'e.g., owner@smilelab.com' })}
                  value={form.ownerEmail}
                  onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
                  disabled={creating}
                />
                {formErrors.ownerEmail && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.ownerEmail}
                  </span>
                )}
                <span className="form-hint">
                  <Mail size={12} /> {t('tenants.ownerEmailInviteHint', { defaultValue: 'An invitation email with password reset link will be sent to this address.' })}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-max-owners">
                    {t('tenants.ownerLimit', { defaultValue: 'Owner Limit' })} *
                  </label>
                  <input
                    id="input-max-owners"
                    className="form-input"
                    type="number"
                    value={form.maxOwners}
                    disabled
                  />
                  <span className="form-hint">{t('tenants.fixedDefault', { defaultValue: 'Fixed default' })}</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="input-max-admins">
                    {t('tenants.adminLimit', { defaultValue: 'Lab Admin Limit' })} *
                  </label>
                  <input
                    id="input-max-admins"
                    className={`form-input ${formErrors.maxAdmins ? 'form-input--error' : ''}`}
                    type="number"
                    min="0"
                    placeholder={t('tenants.adminLimitPlaceholder', { defaultValue: 'e.g., 3' })}
                    value={form.maxAdmins}
                    onChange={(e) => handleInputChange('maxAdmins', e.target.value)}
                    disabled={creating}
                  />
                  {formErrors.maxAdmins && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.maxAdmins}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="input-max-technicians">
                    {t('tenants.techLimit', { defaultValue: 'Lab Tech Limit' })} *
                  </label>
                  <input
                    id="input-max-technicians"
                    className={`form-input ${formErrors.maxTechnicians ? 'form-input--error' : ''}`}
                    type="number"
                    min="0"
                    placeholder={t('tenants.techLimitPlaceholder', { defaultValue: 'e.g., 6' })}
                    value={form.maxTechnicians}
                    onChange={(e) => handleInputChange('maxTechnicians', e.target.value)}
                    disabled={creating}
                  />
                  {formErrors.maxTechnicians && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.maxTechnicians}
                    </span>
                  )}
                </div>
              </div>

              <div className="modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  {t('common.cancel')}
                </button>
                <button
                  id="btn-submit-tenant"
                  type="submit"
                  className="btn btn--primary"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>{t('common.creating', { defaultValue: 'Creating...' })}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>{t('tenants.createTenant', { defaultValue: 'Add Tenant' })}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Features Modal */}
      {featuresModalOpen && selectedTenant && (
        <div className="modal-overlay" onClick={() => !updatingFeatures && setFeaturesModalOpen(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px' }}
          >
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('tenants.manageFeatures', { defaultValue: 'Manage Features' })}</h2>
                <p className="modal__subtitle">
                  {t('tenants.configureFeaturesDesc', { defaultValue: 'Configure modules enabled for' })} <strong>{selectedTenant.name}</strong>
                </p>
              </div>
              <button
                className="modal__close"
                onClick={() => !updatingFeatures && setFeaturesModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal__body" style={{ gap: '1.5rem' }}>
              <div className="feature-toggle-list">
                {/* Feature 1 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>{t('tenants.qrWorkflow', { defaultValue: 'QR Workflow' })}</h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('tenants.qrWorkflowDesc', { defaultValue: 'Scan-to-access work orders for technicians' })}</p>
                  </div>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: featureForm.qrWorkflow ? 'var(--success)' : 'var(--text-muted)' }}
                    onClick={() => handleToggleFeature('qrWorkflow')}
                  >
                    {featureForm.qrWorkflow ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>

                {/* Feature 2 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>{t('tenants.deliveryModule', { defaultValue: 'Delivery Module' })}</h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('tenants.deliveryModuleDesc', { defaultValue: 'Manage delivery boys and coordinate pickups/dropoffs' })}</p>
                  </div>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: featureForm.deliveryModule ? 'var(--success)' : 'var(--text-muted)' }}
                    onClick={() => handleToggleFeature('deliveryModule')}
                  >
                    {featureForm.deliveryModule ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>

                {/* Feature 3 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>{t('tenants.doctorPortal', { defaultValue: 'Doctor Portal' })}</h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('tenants.doctorPortalDesc', { defaultValue: 'Allow doctors to log in and submit orders directly' })}</p>
                  </div>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: featureForm.doctorPortal ? 'var(--success)' : 'var(--text-muted)' }}
                    onClick={() => handleToggleFeature('doctorPortal')}
                  >
                    {featureForm.doctorPortal ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setFeaturesModalOpen(false)}
                disabled={updatingFeatures}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSaveFeatures}
                disabled={updatingFeatures}
              >
                {updatingFeatures ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>{t('common.saving')}</span>
                  </>
                ) : (
                  <span>{t('tenants.saveFeatures', { defaultValue: 'Save Features' })}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTenant && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('tenants.editTenant')}</h2>
                <p className="modal__subtitle">
                  {t('tenants.updateDetailsDesc', { defaultValue: 'Update details for' })} <strong>{selectedTenant.name}</strong>
                </p>
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
              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-tenant-name">
                  {t('tenants.labName', { defaultValue: 'Lab Name' })} *
                </label>
                <input
                  id="input-edit-tenant-name"
                  className={`form-input ${editFormErrors.name ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder={t('tenants.labNamePlaceholder', { defaultValue: 'e.g., Smile Dental Lab' })}
                  value={editForm.name}
                  onChange={(e) => handleEditInputChange('name', e.target.value)}
                  disabled={saving}
                  autoFocus
                />
                {editFormErrors.name && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {editFormErrors.name}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-tenant-email">
                    {t('common.email')}
                  </label>
                  <input
                    id="input-edit-tenant-email"
                    className={`form-input ${editFormErrors.contactEmail ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder={t('tenants.contactEmailPlaceholder', { defaultValue: 'e.g., contact@smilelab.com' })}
                    value={editForm.contactEmail}
                    onChange={(e) => handleEditInputChange('contactEmail', e.target.value)}
                    disabled={saving}
                  />
                  {editFormErrors.contactEmail && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {editFormErrors.contactEmail}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-tenant-phone">
                    {t('tenants.contactPhone', { defaultValue: 'Contact Phone' })}
                  </label>
                  <PhoneInput
                    id="input-edit-tenant-phone"
                    value={editForm.contactPhone}
                    onChange={(val) => handleEditInputChange('contactPhone', val)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-tenant-address">
                  {t('tenants.address', { defaultValue: 'Address' })}
                </label>
                <textarea
                  id="input-edit-tenant-address"
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder={t('tenants.addressPlaceholder', { defaultValue: 'e.g., 123 Dental Street, City' })}
                  value={editForm.address}
                  onChange={(e) => handleEditInputChange('address', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-tenant-status">
                  {t('common.status')} *
                </label>
                <select
                  id="select-edit-tenant-status"
                  className="form-input"
                  value={editForm.status}
                  onChange={(e) => handleEditInputChange('status', e.target.value)}
                  disabled={saving}
                >
                  <option value="ACTIVE">{t('enums.userStatus.ACTIVE')}</option>
                  <option value="INACTIVE">{t('enums.userStatus.INACTIVE')}</option>
                  <option value="SUSPENDED">{t('enums.userStatus.SUSPENDED', { defaultValue: 'Suspended' })}</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-max-owners">
                    {t('tenants.ownerLimit', { defaultValue: 'Owner Limit' })} *
                  </label>
                  <input
                    id="input-edit-max-owners"
                    className="form-input"
                    type="number"
                    value={editForm.maxOwners}
                    disabled
                  />
                  <span className="form-hint">{t('tenants.fixedDefault', { defaultValue: 'Fixed default' })}</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-max-admins">
                    {t('tenants.adminLimit', { defaultValue: 'Lab Admin Limit' })} *
                  </label>
                  <input
                    id="input-edit-max-admins"
                    className={`form-input ${editFormErrors.maxAdmins ? 'form-input--error' : ''}`}
                    type="number"
                    min="0"
                    placeholder={t('tenants.adminLimitPlaceholder', { defaultValue: 'e.g., 3' })}
                    value={editForm.maxAdmins}
                    onChange={(e) => handleEditInputChange('maxAdmins', e.target.value)}
                    disabled={saving}
                  />
                  {editFormErrors.maxAdmins && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {editFormErrors.maxAdmins}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-max-technicians">
                    {t('tenants.techLimit', { defaultValue: 'Lab Tech Limit' })} *
                  </label>
                  <input
                    id="input-edit-max-technicians"
                    className={`form-input ${editFormErrors.maxTechnicians ? 'form-input--error' : ''}`}
                    type="number"
                    min="0"
                    placeholder={t('tenants.techLimitPlaceholder', { defaultValue: 'e.g., 6' })}
                    value={editForm.maxTechnicians}
                    onChange={(e) => handleEditInputChange('maxTechnicians', e.target.value)}
                    disabled={saving}
                  />
                  {editFormErrors.maxTechnicians && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {editFormErrors.maxTechnicians}
                    </span>
                  )}
                </div>
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
                  id="btn-edit-submit-tenant"
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
                    <>
                      <Pencil size={16} />
                      <span>{t('common.saveChanges')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && tenantToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px' }}
          >
            <div className="modal__header">
              <div>
                <h2 className="modal__title">{t('tenants.deleteConfirm')}</h2>
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
                {t('tenants.deleteConfirmLongText', { name: tenantToDelete.name, defaultValue: `Are you sure you want to delete ${tenantToDelete.name}? This action will permanently remove the lab, its branches, users, and all associated data.` })}
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

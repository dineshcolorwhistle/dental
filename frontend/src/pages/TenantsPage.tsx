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
import toast from 'react-hot-toast';
import { tenantService, type TenantListItem, type CreateTenantPayload } from '../services';
import { Pagination } from '../components';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export function TenantsPage() {
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
  });
  const [editFormErrors, setEditFormErrors] = useState<Partial<Record<keyof typeof editForm, string>>>({});

  // Form state
  const [form, setForm] = useState<CreateTenantPayload>({
    tenantName: '',
    ownerName: '',
    ownerEmail: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateTenantPayload, string>>>({});

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tenantService.getAll();
      setTenants(data);
    } catch (err) {
      toast.error('Failed to load tenants');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

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

    if (!form.tenantName.trim()) errors.tenantName = 'Lab name is required';
    if (!form.ownerName.trim()) errors.ownerName = 'Owner name is required';
    if (!form.ownerEmail.trim()) {
      errors.ownerEmail = 'Owner email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail)) {
      errors.ownerEmail = 'Enter a valid email address';
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
      toast.success('Tenant created successfully! Invite email sent.');
      setShowCreateModal(false);
      setForm({ tenantName: '', ownerName: '', ownerEmail: '' });
      setFormErrors({});
      await fetchTenants();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to create tenant';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (field: keyof CreateTenantPayload, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
      toast.success(`Tenant ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`);
      await fetchTenants();
    } catch {
      toast.error('Failed to update tenant status');
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
      toast.success('Tenant features updated successfully');
      setFeaturesModalOpen(false);
      await fetchTenants();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update features');
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
      toast.success('Tenant deleted successfully');
      setDeleteModalOpen(false);
      setTenantToDelete(null);
      await fetchTenants();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete tenant');
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
    });
    setEditFormErrors({});
    setShowEditModal(true);
  };

  const handleEditInputChange = (field: keyof typeof editForm, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    if (editFormErrors[field]) {
      setEditFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateEditForm = (): boolean => {
    const errors: Partial<Record<keyof typeof editForm, string>> = {};

    if (!editForm.name.trim()) errors.name = 'Lab name is required';
    if (editForm.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.contactEmail)) {
      errors.contactEmail = 'Enter a valid email address';
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
      toast.success('Tenant updated successfully!');
      setShowEditModal(false);
      await fetchTenants();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to update tenant';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Status Badge ───────────────────────────────────

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { className: string; icon: React.ReactNode; label: string }> = {
      ACTIVE: { className: 'badge badge--success', icon: <CheckCircle2 size={12} />, label: 'Active' },
      INACTIVE: { className: 'badge badge--warning', icon: <XCircle size={12} />, label: 'Inactive' },
      SUSPENDED: { className: 'badge badge--danger', icon: <AlertCircle size={12} />, label: 'Suspended' },
    };
    const { className, icon, label } = config[status] || config.INACTIVE;
    return <span className={className}>{icon} {label}</span>;
  };

  // ─── Render ─────────────────────────────────────────

  return (
    <div className="tenants-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">Tenants</h1>
          <p className="page-header__subtitle">Manage dental lab organizations</p>
        </div>
        <button
          id="btn-add-tenant"
          className="btn btn--primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={18} />
          <span>Add Tenant</span>
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
            <span className="stat-card__label">Total Tenants</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--success">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.active}</span>
            <span className="stat-card__label">Active</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--warning">
            <XCircle size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.inactive}</span>
            <span className="stat-card__label">Inactive</span>
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
            placeholder="Search tenants..."
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
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>Loading tenants...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <Building2 size={48} />
          </div>
          <h3 className="empty-state__title">
            {tenants.length === 0 ? 'No tenants yet' : 'No matching tenants'}
          </h3>
          <p className="empty-state__text">
            {tenants.length === 0
              ? 'Create your first tenant to get started with the platform.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {tenants.length === 0 && (
            <button
              className="btn btn--primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={18} />
              <span>Add Tenant</span>
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
                    Lab Name
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>Owner</th>
                <th>Branch</th>
                <th>Subdomain</th>
                <th>Status</th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('createdAt')}>
                    Created
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>Actions</th>
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
                          <Users size={12} /> {tenant.userCount} users · <GitBranch size={12} /> {tenant.branchCount} branches
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
                      {new Date(tenant.createdAt).toLocaleDateString('en-IN', {
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
                        title={tenant.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      >
                        {tenant.status === 'ACTIVE' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                        <span>{tenant.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                      </button>
                      <button
                        className="btn-action"
                        onClick={() => handleEditOpen(tenant)}
                        title="Edit Tenant"
                      >
                        <Pencil size={15} />
                        <span>Edit</span>
                      </button>
                      <button
                        className="btn-action btn-action--danger"
                        onClick={() => confirmDelete(tenant)}
                        title="Delete Tenant"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        className="btn-action"
                        onClick={() => openFeaturesModal(tenant)}
                        title="Manage Features"
                      >
                        <Settings size={15} />
                        <span>Features</span>
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
                <h2 className="modal__title">Add New Tenant</h2>
                <p className="modal__subtitle">
                  Create a new dental lab organization
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
                  Tenant Name (Lab Name) *
                </label>
                <input
                  id="input-tenant-name"
                  className={`form-input ${formErrors.tenantName ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., Smile Dental Lab"
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
                  Owner Name *
                </label>
                <input
                  id="input-owner-name"
                  className={`form-input ${formErrors.ownerName ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., John Doe"
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
                  Owner Email *
                </label>
                <input
                  id="input-owner-email"
                  className={`form-input ${formErrors.ownerEmail ? 'form-input--error' : ''}`}
                  type="email"
                  placeholder="e.g., owner@smilelab.com"
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
                  <Mail size={12} /> An invitation email with password reset link will be sent to this address.
                </span>
              </div>

              <div className="modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancel
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
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>Create Tenant</span>
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
                <h2 className="modal__title">Manage Features</h2>
                <p className="modal__subtitle">
                  Configure modules enabled for <strong>{selectedTenant.name}</strong>
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
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>QR Workflow</h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scan-to-access work orders for technicians</p>
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
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>Delivery Module</h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manage delivery boys and coordinate pickups/dropoffs</p>
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
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>Doctor Portal</h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Allow doctors to log in and submit orders directly</p>
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
                Cancel
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
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Features</span>
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
                <h2 className="modal__title">Edit Tenant</h2>
                <p className="modal__subtitle">
                  Update details for <strong>{selectedTenant.name}</strong>
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
                  Tenant Name (Lab Name) *
                </label>
                <input
                  id="input-edit-tenant-name"
                  className={`form-input ${editFormErrors.name ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., Smile Dental Lab"
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
                    Contact Email
                  </label>
                  <input
                    id="input-edit-tenant-email"
                    className={`form-input ${editFormErrors.contactEmail ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder="e.g., contact@smilelab.com"
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
                    Contact Phone
                  </label>
                  <input
                    id="input-edit-tenant-phone"
                    className="form-input"
                    type="text"
                    placeholder="e.g., +91-9876543210"
                    value={editForm.contactPhone}
                    onChange={(e) => handleEditInputChange('contactPhone', e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-tenant-address">
                  Address
                </label>
                <textarea
                  id="input-edit-tenant-address"
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="e.g., 123 Dental Street, City"
                  value={editForm.address}
                  onChange={(e) => handleEditInputChange('address', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-tenant-status">
                  Status *
                </label>
                <select
                  id="select-edit-tenant-status"
                  className="form-input"
                  value={editForm.status}
                  onChange={(e) => handleEditInputChange('status', e.target.value)}
                  disabled={saving}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
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
                  id="btn-edit-submit-tenant"
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
                    <>
                      <Pencil size={16} />
                      <span>Save Changes</span>
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
                <h2 className="modal__title">Delete Tenant</h2>
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
                Are you sure you want to delete <strong>{tenantToDelete.name}</strong>? This action will permanently remove the lab, its branches, users, and all associated data.
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

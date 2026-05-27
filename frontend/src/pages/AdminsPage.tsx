import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  Loader2,
  ArrowUpDown,
  Phone,
  Building2,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminService, branchService, type AdminListItem, type BranchListItem, type CreateAdminPayload } from '../services';
import { Pagination, SearchableSelect } from '../components';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'INVITED';

export function AdminsPage() {
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilter>('ALL');

  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Reset pagination when filters or search change
  useEffect(() => {
    setCurrentPage(0);
  }, [search, selectedBranchFilter, selectedStatusFilter]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'email' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<AdminListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [form, setForm] = useState<CreateAdminPayload & { status?: 'ACTIVE' | 'INACTIVE' | 'INVITED' }>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    branchId: '',
    status: 'ACTIVE',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateAdminPayload, string>>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [adminData, branchData] = await Promise.all([
        adminService.getAll(),
        branchService.getAll(),
      ]);
      setAdmins(adminData);
      setBranches(branchData.filter((b) => b.isActive));
    } catch (err) {
      toast.error('Failed to load administrators or branches');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Filtering & Sorting ────────────────────────────

  const filtered = admins
    .filter((a) => {
      if (selectedBranchFilter !== 'ALL' && a.branchId !== selectedBranchFilter) return false;
      if (selectedStatusFilter !== 'ALL' && a.status !== selectedStatusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.firstName.toLowerCase().includes(q) ||
          a.lastName.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.phone && a.phone.toLowerCase().includes(q)) ||
          (a.branch?.name && a.branch.name.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'name') {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return mul * nameA.localeCompare(nameB);
      }
      if (sortField === 'email') return mul * a.email.localeCompare(b.email);
      return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // ─── Stats ──────────────────────────────────────────

  const stats = {
    total: admins.length,
    active: admins.filter((a) => a.status === 'ACTIVE').length,
    invited: admins.filter((a) => a.status === 'INVITED').length,
  };

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (isEdit = false): boolean => {
    const errors: Partial<Record<keyof CreateAdminPayload, string>> = {};

    if (!form.firstName.trim()) errors.firstName = 'First name is required';
    if (!form.lastName.trim()) errors.lastName = 'Last name is required';

    if (!isEdit) {
      if (!form.email.trim()) {
        errors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = 'Enter a valid email address';
      }
    }

    if (!form.branchId) {
      errors.branchId = 'Assigned branch is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOpen = () => {
    setForm({
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      branchId: branches[0]?.id || '',
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditOpen = (admin: AdminListItem) => {
    setSelectedAdmin(admin);
    setForm({
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      phone: admin.phone || '',
      branchId: admin.branchId || '',
      status: admin.status,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    try {
      setSaving(true);
      await adminService.create(form);
      toast.success('Admin invited successfully! Invitation email sent.');
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to invite administrator';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin || !validateForm(true)) return;

    try {
      setSaving(true);
      await adminService.update(selectedAdmin.id, form);
      toast.success('Admin updated successfully!');
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to update administrator';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof CreateAdminPayload | 'status', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field as keyof CreateAdminPayload]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const toggleSort = (field: 'name' | 'email' | 'createdAt') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleToggleStatus = async (admin: AdminListItem) => {
    const newStatus = admin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await adminService.update(admin.id, { status: newStatus });
      toast.success(`Admin ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`);
      await fetchData();
    } catch {
      toast.error('Failed to update administrator status');
    }
  };

  const confirmDelete = (admin: AdminListItem) => {
    setAdminToDelete(admin);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!adminToDelete) return;
    try {
      setDeleting(true);
      await adminService.delete(adminToDelete.id);
      toast.success('Admin deleted successfully');
      setDeleteModalOpen(false);
      setAdminToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete admin');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Status Badge ───────────────────────────────────

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { className: string; icon: React.ReactNode; label: string }> = {
      ACTIVE: { className: 'badge badge--success', icon: <CheckCircle2 size={12} />, label: 'Active' },
      INACTIVE: { className: 'badge badge--warning', icon: <XCircle size={12} />, label: 'Inactive' },
      INVITED: { className: 'badge badge--primary', icon: <Mail size={12} />, label: 'Invited' },
    };
    const { className, icon, label } = config[status] || config.INACTIVE;
    return <span className={className}>{icon} {label}</span>;
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">Lab Admins</h1>
          <p className="page-header__subtitle">Manage branch administrators and their roles</p>
        </div>
        <button
          id="btn-add-admin"
          className="btn btn--primary"
          onClick={handleCreateOpen}
          disabled={branches.length === 0}
        >
          <Plus size={18} />
          <span>Add Admin</span>
        </button>
      </div>

      {branches.length === 0 && !loading && (
        <div className="alert alert--warning" style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderRadius: '12px', border: '1px solid var(--warning)', background: 'var(--bg-base)', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          <AlertCircle size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>No Active Branches Found</h4>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              You need to create at least one active branch before inviting or managing branch administrators. Go to the Branches tab to create a branch.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <Users size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">Total Admins</span>
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
            <Mail size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.invited}</span>
            <span className="stat-card__label">Invited (Pending Setup)</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="table-toolbar" style={{ gap: '1rem' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-admin-search"
            type="text"
            className="form-input search-input"
            placeholder="Search administrators..."
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
          {/* Branch Filter dropdown */}
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

          {/* Status Chips */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {(['ALL', 'ACTIVE', 'INACTIVE', 'INVITED'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                className={`filter-chip ${selectedStatusFilter === s ? 'filter-chip--active' : ''}`}
                onClick={() => setSelectedStatusFilter(s)}
              >
                {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>Loading administrators...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <Users size={48} />
          </div>
          <h3 className="empty-state__title">
            {admins.length === 0 ? 'No admins yet' : 'No matching administrators'}
          </h3>
          <p className="empty-state__text">
            {admins.length === 0
              ? 'Invite your branch managers or assistants as administrators.'
              : 'Try adjusting your search, branch, or filter criteria.'}
          </p>
          {admins.length === 0 && branches.length > 0 && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
            >
              <Plus size={18} />
              <span>Add Admin</span>
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="admins-table">
            <thead>
              <tr>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('name')}>
                    Administrator
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('email')}>
                    Email Address
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>Phone</th>
                <th>Assigned Branch</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((admin) => (
                <tr key={admin.id}>
                  <td>
                    <div className="cell-primary">
                      <div className="cell-avatar" style={{ background: 'linear-gradient(135deg, #A9CFE8, #6FAED9)' }}>
                        {admin.firstName.charAt(0).toUpperCase()}
                        {admin.lastName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="cell-primary__name">
                          {admin.firstName} {admin.lastName}
                        </span>
                        <span className="cell-primary__meta">
                          Created {new Date(admin.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="cell-subdomain" style={{ textTransform: 'none' }}>
                      <Mail size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {admin.email}
                    </span>
                  </td>
                  <td>
                    {admin.phone ? (
                      <span className="cell-date">
                        <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        {admin.phone}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {admin.branch ? (
                      <div className="cell-primary" style={{ gap: '0.25rem' }}>
                        <Building2 size={12} style={{ color: 'var(--accent-primary)' }} />
                        <span className="cell-branch" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{admin.branch.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={admin.status} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className={`btn-action ${admin.status === 'ACTIVE' ? 'btn-action--danger' : 'btn-action--success'}`}
                        onClick={() => handleToggleStatus(admin)}
                        title={admin.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      >
                        {admin.status === 'ACTIVE' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                        <span>{admin.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                      </button>
                      <button
                        className="btn-action"
                        onClick={() => handleEditOpen(admin)}
                        title="Edit Administrator"
                      >
                        <span>Edit</span>
                      </button>
                      <button
                        className="btn-action btn-action--danger"
                        onClick={() => confirmDelete(admin)}
                        title="Delete Administrator"
                      >
                        <Trash2 size={15} />
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
        <div className="modal-overlay" onClick={() => !saving && setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Invite Lab Administrator</h2>
                <p className="modal__subtitle">Invite a manager or administrator and assign them to a branch</p>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-admin-first">
                    First Name *
                  </label>
                  <input
                    id="input-admin-first"
                    className={`form-input ${formErrors.firstName ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder="e.g., John"
                    value={form.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={saving}
                    autoFocus
                  />
                  {formErrors.firstName && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.firstName}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="input-admin-last">
                    Last Name *
                  </label>
                  <input
                    id="input-admin-last"
                    className={`form-input ${formErrors.lastName ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder="e.g., Doe"
                    value={form.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    disabled={saving}
                  />
                  {formErrors.lastName && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.lastName}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-admin-email">
                  Email Address *
                </label>
                <input
                  id="input-admin-email"
                  className={`form-input ${formErrors.email ? 'form-input--error' : ''}`}
                  type="email"
                  placeholder="e.g., admin@smilelab.com"
                  value={form.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={saving}
                />
                {formErrors.email && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.email}
                  </span>
                )}
                <span className="form-hint">
                  <Mail size={12} /> An invitation email with password reset link will be sent to this address.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-admin-phone">
                  Phone Number (Optional)
                </label>
                <input
                  id="input-admin-phone"
                  className="form-input"
                  type="text"
                  placeholder="e.g., +919876543210"
                  value={form.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-admin-branch">
                  Assigned Branch *
                </label>
                <SearchableSelect
                  id="select-admin-branch"
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
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.branchId}
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
                  id="btn-submit-admin"
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Sending Invite...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAdmin && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Edit Administrator</h2>
                <p className="modal__subtitle">Update details for <strong>{selectedAdmin.firstName} {selectedAdmin.lastName}</strong></p>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-admin-first">
                    First Name *
                  </label>
                  <input
                    id="input-edit-admin-first"
                    className={`form-input ${formErrors.firstName ? 'form-input--error' : ''}`}
                    type="text"
                    value={form.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={saving}
                    autoFocus
                  />
                  {formErrors.firstName && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.firstName}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-admin-last">
                    Last Name *
                  </label>
                  <input
                    id="input-edit-admin-last"
                    className={`form-input ${formErrors.lastName ? 'form-input--error' : ''}`}
                    type="text"
                    value={form.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    disabled={saving}
                  />
                  {formErrors.lastName && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.lastName}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-admin-phone">
                  Phone Number (Optional)
                </label>
                <input
                  id="input-edit-admin-phone"
                  className="form-input"
                  type="text"
                  value={form.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-admin-branch">
                  Assigned Branch *
                </label>
                <SearchableSelect
                  id="select-edit-admin-branch"
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
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.branchId}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-admin-status">
                  Status *
                </label>
                <select
                  id="select-edit-admin-status"
                  className="form-input"
                  value={form.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  disabled={saving}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="INVITED">Invited</option>
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
                  id="btn-edit-submit-admin"
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
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && adminToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Delete Administrator</h2>
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
                Are you sure you want to delete administrator <strong>{adminToDelete.firstName} {adminToDelete.lastName}</strong>? This action will permanently remove their user account.
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

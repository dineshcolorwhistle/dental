import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Search,
  X,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  Loader2,
  ArrowUpDown,
  Phone,
  MapPin,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { branchService, adminService, type BranchListItem, type CreateBranchPayload, type AdminListItem } from '../services';
import { Pagination } from '../components';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export function BranchesPage() {
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<BranchListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'code' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [branchAdmins, setBranchAdmins] = useState<AdminListItem[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Reset pagination when filters or search change
  useEffect(() => {
    setCurrentPage(0);
  }, [search, statusFilter]);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<BranchListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [form, setForm] = useState<CreateBranchPayload & { defaultAdminId?: string | null }>({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    isActive: true,
    defaultAdminId: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateBranchPayload, string>>>({});

  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);
      const data = await branchService.getAll();
      setBranches(data);
    } catch (err) {
      toast.error('Failed to load branches');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // ─── Filtering & Sorting ────────────────────────────

  const filtered = branches
    .filter((b) => {
      if (statusFilter === 'ACTIVE' && !b.isActive) return false;
      if (statusFilter === 'INACTIVE' && b.isActive) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          b.name.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          (b.email && b.email.toLowerCase().includes(q)) ||
          (b.phone && b.phone.toLowerCase().includes(q)) ||
          (b.address && b.address.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'name') return mul * a.name.localeCompare(b.name);
      if (sortField === 'code') return mul * a.code.localeCompare(b.code);
      return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // ─── Stats ──────────────────────────────────────────

  const stats = {
    total: branches.length,
    active: branches.filter((b) => b.isActive).length,
    inactive: branches.filter((b) => !b.isActive).length,
  };

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateBranchPayload, string>> = {};

    if (!form.name.trim()) {
      errors.name = 'Branch name is required';
    } else if (form.name.length < 2) {
      errors.name = 'Branch name must be at least 2 characters';
    }

    if (form.code && form.code.trim().length > 0) {
      if (!/^[a-zA-Z0-9]+$/.test(form.code)) {
        errors.code = 'Branch code must be alphanumeric';
      } else if (form.code.length < 2 || form.code.length > 10) {
        errors.code = 'Branch code must be between 2 and 10 characters';
      }
    }

    if (form.email && form.email.trim().length > 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = 'Enter a valid email address';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOpen = () => {
    setForm({
      name: '',
      code: '',
      address: '',
      phone: '',
      email: '',
      isActive: true,
      defaultAdminId: '',
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditOpen = async (branch: BranchListItem) => {
    setSelectedBranch(branch);
    setForm({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      isActive: branch.isActive,
      defaultAdminId: branch.defaultAdminId || '',
    });
    setFormErrors({});
    setShowEditModal(true);

    try {
      setLoadingAdmins(true);
      const admins = await adminService.getAll(branch.id);
      setBranchAdmins(admins.filter((a) => a.status === 'ACTIVE'));
    } catch (err) {
      console.error('Failed to load branch admins', err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const { defaultAdminId, ...createPayload } = form;
      
      const sanitized = {
        ...createPayload,
        code: createPayload.code ? createPayload.code.trim() : undefined,
        email: createPayload.email ? createPayload.email.trim() : undefined,
        phone: createPayload.phone ? createPayload.phone.trim() : undefined,
        address: createPayload.address ? createPayload.address.trim() : undefined,
      };

      await branchService.create(sanitized);
      toast.success('Branch created successfully!');
      setShowCreateModal(false);
      await fetchBranches();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to create branch';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch || !validateForm()) return;

    try {
      setSaving(true);
      await branchService.update(selectedBranch.id, {
        name: form.name,
        code: form.code,
        address: form.address,
        phone: form.phone,
        email: form.email,
        isActive: form.isActive,
        defaultAdminId: form.defaultAdminId || null,
      });
      toast.success('Branch updated successfully!');
      setShowEditModal(false);
      await fetchBranches();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to update branch';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof CreateBranchPayload, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const toggleSort = (field: 'name' | 'code' | 'createdAt') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleToggleStatus = async (branch: BranchListItem) => {
    const newStatus = !branch.isActive;
    try {
      await branchService.update(branch.id, { isActive: newStatus });
      toast.success(`Branch ${newStatus ? 'activated' : 'deactivated'}`);
      await fetchBranches();
    } catch {
      toast.error('Failed to update branch status');
    }
  };

  const confirmDelete = (branch: BranchListItem) => {
    setBranchToDelete(branch);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!branchToDelete) return;
    try {
      setDeleting(true);
      await branchService.delete(branchToDelete.id);
      toast.success('Branch deleted successfully');
      setDeleteModalOpen(false);
      setBranchToDelete(null);
      await fetchBranches();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete branch');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Status Badge ───────────────────────────────────

  const StatusBadge = ({ active }: { active: boolean }) => {
    return active ? (
      <span className="badge badge--success"><CheckCircle2 size={12} /> Active</span>
    ) : (
      <span className="badge badge--warning"><XCircle size={12} /> Inactive</span>
    );
  };

  return (
    <div className="branches-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">Branches</h1>
          <p className="page-header__subtitle">Manage your dental lab branches</p>
        </div>
        <button
          id="btn-add-branch"
          className="btn btn--primary"
          onClick={handleCreateOpen}
        >
          <Plus size={18} />
          <span>Add Branch</span>
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
            <span className="stat-card__label">Total Branches</span>
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
            id="input-branch-search"
            type="text"
            className="form-input search-input"
            placeholder="Search branches..."
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
          {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((s) => (
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
          <span>Loading branches...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <Building2 size={48} />
          </div>
          <h3 className="empty-state__title">
            {branches.length === 0 ? 'No branches yet' : 'No matching branches'}
          </h3>
          <p className="empty-state__text">
            {branches.length === 0
              ? 'Create a branch to expand your operations.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {branches.length === 0 && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
            >
              <Plus size={18} />
              <span>Add Branch</span>
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="branches-table">
            <thead>
              <tr>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('name')}>
                    Branch Name
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('code')}>
                    Code
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>Default Admin</th>
                <th>Contact Info</th>
                <th>Address</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((branch) => (
                <tr key={branch.id}>
                  <td>
                    <div className="cell-primary">
                      <div className="cell-avatar" style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
                        {branch.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="cell-primary__name">{branch.name}</span>
                        <span className="cell-primary__meta">
                          <Users size={12} /> {branch._count?.users ?? 0} active users
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="cell-subdomain" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {branch.code}
                    </span>
                  </td>
                  <td>
                    {branch.defaultAdmin ? (
                      <div className="cell-primary" style={{ gap: '0.25rem' }}>
                        <Users size={12} style={{ color: 'var(--accent-primary)' }} />
                        <div>
                          <span className="cell-branch" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                            {branch.defaultAdmin.firstName} {branch.defaultAdmin.lastName}
                          </span>
                          <span className="cell-user__email" style={{ fontSize: '0.75rem', display: 'block' }}>
                            {branch.defaultAdmin.email}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted" style={{ fontSize: '0.8125rem', fontStyle: 'italic' }}>Not Assigned</span>
                    )}
                  </td>
                  <td>
                    <div className="cell-user">
                      {branch.email && (
                        <span className="cell-user__email" style={{ marginBottom: '2px' }}>
                          <Mail size={11} /> {branch.email}
                        </span>
                      )}
                      {branch.phone && (
                        <span className="cell-user__email">
                          <Phone size={11} /> {branch.phone}
                        </span>
                      )}
                      {!branch.email && !branch.phone && <span className="text-muted">—</span>}
                    </div>
                  </td>
                  <td>
                    {branch.address ? (
                      <span className="cell-date" style={{ maxWidth: '240px', display: 'inline-block', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.4' }}>
                        <MapPin size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }} />
                        {branch.address}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge active={branch.isActive} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className={`btn-action ${branch.isActive ? 'btn-action--danger' : 'btn-action--success'}`}
                        onClick={() => handleToggleStatus(branch)}
                        title={branch.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {branch.isActive ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                        <span>{branch.isActive ? 'Deactivate' : 'Activate'}</span>
                      </button>
                      <button
                        className="btn-action"
                        onClick={() => handleEditOpen(branch)}
                        title="Edit Branch"
                      >
                        <span>Edit</span>
                      </button>
                      <button
                        className="btn-action btn-action--danger"
                        onClick={() => confirmDelete(branch)}
                        title="Delete Branch"
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
                <h2 className="modal__title">Add New Branch</h2>
                <p className="modal__subtitle">Create a new branch location for your dental lab</p>
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
              <div className="form-group">
                <label className="form-label" htmlFor="input-branch-name">
                  Branch Name *
                </label>
                <input
                  id="input-branch-name"
                  className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., Downtown Branch"
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
                <label className="form-label" htmlFor="input-branch-code">
                  Branch Code (Optional)
                </label>
                <input
                  id="input-branch-code"
                  className={`form-input ${formErrors.code ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., DOWNTOWN (Auto-generated if empty)"
                  value={form.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  disabled={saving}
                />
                {formErrors.code && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.code}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-branch-email">
                  Branch Email (Optional)
                </label>
                <input
                  id="input-branch-email"
                  className={`form-input ${formErrors.email ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., branch@smilelab.com"
                  value={form.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={saving}
                />
                {formErrors.email && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.email}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-branch-phone">
                  Branch Phone (Optional)
                </label>
                <input
                  id="input-branch-phone"
                  className="form-input"
                  type="text"
                  placeholder="e.g., +919876543210"
                  value={form.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-branch-address">
                  Branch Address (Optional)
                </label>
                <textarea
                  id="input-branch-address"
                  className="form-input"
                  style={{ minHeight: '80px', fontFamily: 'inherit', padding: '10px 14px' }}
                  placeholder="e.g., 123 Dental St, Suite 4A"
                  value={form.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  disabled={saving}
                />
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
                  id="btn-submit-branch"
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
                      <Plus size={16} />
                      <span>Create Branch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedBranch && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Edit Branch</h2>
                <p className="modal__subtitle">Update details for branch <strong>{selectedBranch.name}</strong></p>
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
                <label className="form-label" htmlFor="input-edit-branch-name">
                  Branch Name *
                </label>
                <input
                  id="input-edit-branch-name"
                  className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., Downtown Branch"
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
                <label className="form-label" htmlFor="input-edit-branch-code">
                  Branch Code
                </label>
                <input
                  id="input-edit-branch-code"
                  className={`form-input ${formErrors.code ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., DOWNTOWN"
                  value={form.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  disabled={saving}
                />
                {formErrors.code && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.code}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-branch-email">
                  Branch Email (Optional)
                </label>
                <input
                  id="input-edit-branch-email"
                  className={`form-input ${formErrors.email ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., branch@smilelab.com"
                  value={form.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={saving}
                />
                {formErrors.email && (
                  <span className="form-error">
                    <AlertCircle size={12} /> {formErrors.email}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-branch-phone">
                  Branch Phone (Optional)
                </label>
                <input
                  id="input-edit-branch-phone"
                  className="form-input"
                  type="text"
                  placeholder="e.g., +919876543210"
                  value={form.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-branch-address">
                  Branch Address (Optional)
                </label>
                <textarea
                  id="input-edit-branch-address"
                  className="form-input"
                  style={{ minHeight: '80px', fontFamily: 'inherit', padding: '10px 14px' }}
                  placeholder="e.g., 123 Dental St, Suite 4A"
                  value={form.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-branch-admin">
                  Default Admin
                </label>
                {loadingAdmins ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    <Loader2 size={16} className="spinner" />
                    <span>Loading administrators...</span>
                  </div>
                ) : branchAdmins.length === 0 ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0' }}>
                    No active administrators found in this branch. To assign a Default Admin, first add or activate an administrator for this branch.
                  </div>
                ) : (
                  <select
                    id="select-edit-branch-admin"
                    className="form-input"
                    value={form.defaultAdminId || ''}
                    onChange={(e) => handleInputChange('defaultAdminId', e.target.value || null)}
                    disabled={saving}
                  >
                    <option value="">Select Default Admin...</option>
                    {branchAdmins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.firstName} {admin.lastName} ({admin.email})
                      </option>
                    ))}
                  </select>
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
                  id="btn-edit-submit-branch"
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
      {deleteModalOpen && branchToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Delete Branch</h2>
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
                Are you sure you want to delete branch <strong>{branchToDelete.name}</strong>? This action will permanently remove the branch. Users associated with this branch will have their branch reference set to null.
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

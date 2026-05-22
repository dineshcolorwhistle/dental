import { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
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
import { technicianService, branchService, type TechnicianListItem, type BranchListItem, type CreateTechnicianPayload, type UpdateTechnicianPayload } from '../services';
import { useAuth } from '../context';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'INVITED';

export function TechniciansPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [technicians, setTechnicians] = useState<TechnicianListItem[]>([]);
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilter>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState<TechnicianListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'email' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [technicianToDelete, setTechnicianToDelete] = useState<TechnicianListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [form, setForm] = useState<CreateTechnicianPayload & { status?: 'ACTIVE' | 'INACTIVE' | 'INVITED' }>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    branchId: '',
    status: 'ACTIVE',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateTechnicianPayload, string>>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;
      const [technicianData, branchData] = await Promise.all([
        technicianService.getAll(branchScope),
        branchService.getAll(),
      ]);
      setTechnicians(technicianData);
      setBranches(branchData.filter((b) => b.isActive));
    } catch (err) {
      toast.error('Failed to load technicians or branches');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Filtering & Sorting ────────────────────────────

  const filtered = technicians
    .filter((t) => {
      if (!isAdmin && selectedBranchFilter !== 'ALL' && t.branchId !== selectedBranchFilter) return false;
      if (selectedStatusFilter !== 'ALL' && t.status !== selectedStatusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.firstName.toLowerCase().includes(q) ||
          t.lastName.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          (t.phone && t.phone.toLowerCase().includes(q)) ||
          (t.branch?.name && t.branch.name.toLowerCase().includes(q))
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

  // ─── Stats ──────────────────────────────────────────

  const stats = {
    total: technicians.length,
    active: technicians.filter((t) => t.status === 'ACTIVE').length,
    invited: technicians.filter((t) => t.status === 'INVITED').length,
  };

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (isEdit = false): boolean => {
    const errors: Partial<Record<keyof CreateTechnicianPayload, string>> = {};

    if (!form.firstName.trim()) errors.firstName = 'First name is required';
    if (!form.lastName.trim()) errors.lastName = 'Last name is required';

    if (!isEdit) {
      if (!form.email.trim()) {
        errors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = 'Enter a valid email address';
      }
    }

    if (!isAdmin && !form.branchId) {
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
      branchId: isAdmin ? user?.branchId || '' : branches[0]?.id || '',
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditOpen = (tech: TechnicianListItem) => {
    setSelectedTechnician(tech);
    setForm({
      email: tech.email,
      firstName: tech.firstName,
      lastName: tech.lastName,
      phone: tech.phone || '',
      branchId: tech.branchId || '',
      status: tech.status,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    try {
      setSaving(true);
      const payload: CreateTechnicianPayload = {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        branchId: isAdmin ? user?.branchId || '' : form.branchId,
      };
      await technicianService.create(payload);
      toast.success('Technician invited successfully! Invitation email sent.');
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to invite technician';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechnician || !validateForm(true)) return;

    try {
      setSaving(true);
      const payload: UpdateTechnicianPayload = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        branchId: isAdmin ? user?.branchId || undefined : form.branchId || undefined,
        status: form.status,
      };
      await technicianService.update(selectedTechnician.id, payload);
      toast.success('Technician updated successfully!');
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to update technician';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof CreateTechnicianPayload | 'status', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field as keyof CreateTechnicianPayload]) {
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

  const handleToggleStatus = async (tech: TechnicianListItem) => {
    const newStatus = tech.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await technicianService.update(tech.id, { status: newStatus });
      toast.success(`Technician ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`);
      await fetchData();
    } catch {
      toast.error('Failed to update technician status');
    }
  };

  const confirmDelete = (tech: TechnicianListItem) => {
    setTechnicianToDelete(tech);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!technicianToDelete) return;
    try {
      setDeleting(true);
      await technicianService.delete(technicianToDelete.id);
      toast.success('Technician deleted successfully');
      setDeleteModalOpen(false);
      setTechnicianToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete technician');
    } finally {
      setDeleting(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { className: string; icon: React.ReactNode; label: string }> = {
      ACTIVE: { className: 'badge badge--success', icon: <CheckCircle2 size={12} />, label: 'Active' },
      INACTIVE: { className: 'badge badge--warning', icon: <XCircle size={12} />, label: 'Inactive' },
      INVITED: { className: 'badge badge--primary', icon: <Mail size={12} />, label: 'Invited' },
    };

    const current = config[status] || { className: 'badge', icon: null, label: status };

    return (
      <span className={current.className}>
        {current.icon}
        {current.label}
      </span>
    );
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">Technicians</h1>
          <p className="page-header__subtitle">Manage dental lab technicians and their access</p>
        </div>
        <button
          id="btn-add-technician"
          className="btn btn--primary"
          onClick={handleCreateOpen}
        >
          <Plus size={18} />
          <span>Invite Technician</span>
        </button>
      </div>

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <Wrench size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">Total Technicians</span>
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
          <div className="stat-card__icon stat-card__icon--primary">
            <Mail size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.invited}</span>
            <span className="stat-card__label">Pending Invites</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="table-toolbar" style={{ gap: '1rem' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-technician-search"
            type="text"
            className="form-input search-input"
            placeholder="Search technicians..."
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
          <span>Loading technicians...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
            <Wrench size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 className="empty-state__title">
            {technicians.length === 0 ? 'No technicians invited yet' : 'No matching records'}
          </h3>
          <p className="empty-state__text">
            {technicians.length === 0
              ? 'Invite technicians to assign design tasks and lab manufacturing workflow steps.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {technicians.length === 0 && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
            >
              <Plus size={18} />
              <span>Invite Technician</span>
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="technicians-table">
            <thead>
              <tr>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('name')}>
                    Technician
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
                {!isAdmin && <th>Branch</th>}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tech) => (
                <tr key={tech.id}>
                  <td>
                    <div className="cell-primary">
                      <div className="cell-avatar" style={{ background: 'linear-gradient(135deg, #A1C4FD, #C2E9FB)' }}>
                        {tech.firstName.charAt(0)}
                        {tech.lastName.charAt(0)}
                      </div>
                      <div>
                        <span className="cell-primary__name">
                          {tech.firstName} {tech.lastName}
                        </span>
                        <span className="cell-primary__meta">
                          Joined {new Date(tech.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="cell-subdomain" style={{ textTransform: 'none', fontWeight: 600 }}>
                      {tech.email}
                    </span>
                  </td>
                  <td>
                    {tech.phone ? (
                      <span className="cell-user__email">
                        <Phone size={11} /> {tech.phone}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  {!isAdmin && (
                    <td>
                      {tech.branch ? (
                        <div className="cell-primary" style={{ gap: '0.25rem' }}>
                          <Building2 size={12} style={{ color: 'var(--accent-primary)' }} />
                          <span className="cell-branch" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{tech.branch.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  <td>
                    <StatusBadge status={tech.status} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {tech.status !== 'INVITED' && (
                        <button
                          className={`btn-action ${tech.status === 'ACTIVE' ? 'btn-action--danger' : 'btn-action--success'}`}
                          onClick={() => handleToggleStatus(tech)}
                          title={tech.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        >
                          {tech.status === 'ACTIVE' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                          <span>{tech.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</span>
                        </button>
                      )}
                      <button
                        className="btn-action"
                        onClick={() => handleEditOpen(tech)}
                        title="Edit Technician"
                      >
                        <span>Edit</span>
                      </button>
                      <button
                        className="btn-action btn-action--danger"
                        onClick={() => confirmDelete(tech)}
                        title="Delete Technician"
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
                <h2 className="modal__title">Invite Technician</h2>
                <p className="modal__subtitle">Invite a new technician to this dental laboratory</p>
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
                  <label className="form-label" htmlFor="input-tech-firstname">
                    First Name *
                  </label>
                  <input
                    id="input-tech-firstname"
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
                  <label className="form-label" htmlFor="input-tech-lastname">
                    Last Name *
                  </label>
                  <input
                    id="input-tech-lastname"
                    className={`form-input ${formErrors.lastName ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder="e.g., Watson"
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
                <label className="form-label" htmlFor="input-tech-email">
                  Email Address *
                </label>
                <input
                  id="input-tech-email"
                  className={`form-input ${formErrors.email ? 'form-input--error' : ''}`}
                  type="email"
                  placeholder="e.g., technician@example.com"
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
                <label className="form-label" htmlFor="input-tech-phone">
                  Phone Number
                </label>
                <input
                  id="input-tech-phone"
                  className="form-input"
                  type="text"
                  placeholder="e.g., +919876543210"
                  value={form.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Branch select (Hidden if admin, shown if owner) */}
              {!isAdmin && branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-tech-branch">
                    Assigned Branch *
                  </label>
                  <select
                    id="select-tech-branch"
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
                  id="btn-submit-technician"
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Inviting...</span>
                    </>
                  ) : (
                    <span>Invite Technician</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTechnician && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Edit Technician</h2>
                <p className="modal__subtitle">Update profile for <strong>{selectedTechnician.firstName} {selectedTechnician.lastName}</strong></p>
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
                  <label className="form-label" htmlFor="input-edit-tech-firstname">
                    First Name *
                  </label>
                  <input
                    id="input-edit-tech-firstname"
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
                  <label className="form-label" htmlFor="input-edit-tech-lastname">
                    Last Name *
                  </label>
                  <input
                    id="input-edit-tech-lastname"
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
                <label className="form-label">
                  Email Address
                </label>
                <input
                  className="form-input"
                  type="email"
                  value={form.email}
                  disabled
                />
                <span className="form-error" style={{ color: 'var(--text-muted)' }}>
                  Email cannot be changed after invitation.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-tech-phone">
                  Phone Number
                </label>
                <input
                  id="input-edit-tech-phone"
                  className="form-input"
                  type="text"
                  value={form.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Branch select (Hidden if admin, shown if owner) */}
              {!isAdmin && branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-edit-tech-branch">
                    Assigned Branch *
                  </label>
                  <select
                    id="select-edit-tech-branch"
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

              {selectedTechnician.status !== 'INVITED' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-edit-tech-status">
                    Status *
                  </label>
                  <select
                    id="select-edit-tech-status"
                    className="form-input"
                    value={form.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    disabled={saving}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              )}

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
                  id="btn-edit-submit-technician"
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
      {deleteModalOpen && technicianToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Delete Technician</h2>
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
                Are you sure you want to delete technician <strong>{technicianToDelete.firstName} {technicianToDelete.lastName}</strong>? This action will permanently remove the record from the database.
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

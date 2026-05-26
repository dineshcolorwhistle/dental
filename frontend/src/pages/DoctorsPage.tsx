import { useState, useEffect, useCallback } from 'react';
import {
  Heart,
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
  MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doctorService, branchService, type DoctorListItem, type BranchListItem, type CreateDoctorPayload } from '../services';
import { useAuth } from '../context';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export function DoctorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilter>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'clinicName' | 'createdAt'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState<DoctorListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [form, setForm] = useState<CreateDoctorPayload & { isActive?: boolean }>({
    name: '',
    clinicName: '',
    email: '',
    phone: '',
    address: '',
    branchId: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateDoctorPayload, string>>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // If admin, scope branch data to the admin's branchId
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;
      const [doctorData, branchData] = await Promise.all([
        doctorService.getAll(branchScope),
        isAdmin ? Promise.resolve([]) : branchService.getAll(),
      ]);
      setDoctors(doctorData);
      setBranches(branchData.filter((b) => b.isActive));
    } catch (err) {
      toast.error('Failed to load doctors or branches');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.branchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Filtering & Sorting ────────────────────────────

  const filtered = doctors
    .filter((d) => {
      if (!isAdmin && selectedBranchFilter !== 'ALL' && d.branchId !== selectedBranchFilter) return false;
      if (selectedStatusFilter === 'ACTIVE' && !d.isActive) return false;
      if (selectedStatusFilter === 'INACTIVE' && d.isActive) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          d.name.toLowerCase().includes(q) ||
          (d.clinicName && d.clinicName.toLowerCase().includes(q)) ||
          (d.email && d.email.toLowerCase().includes(q)) ||
          (d.phone && d.phone.toLowerCase().includes(q)) ||
          (d.address && d.address.toLowerCase().includes(q)) ||
          (d.branch?.name && d.branch.name.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'name') return mul * a.name.localeCompare(b.name);
      if (sortField === 'clinicName') {
        const cA = a.clinicName || '';
        const cB = b.clinicName || '';
        return mul * cA.localeCompare(cB);
      }
      return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

  // ─── Stats ──────────────────────────────────────────

  const stats = {
    total: doctors.length,
    active: doctors.filter((d) => d.isActive).length,
    inactive: doctors.filter((d) => !d.isActive).length,
  };

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateDoctorPayload, string>> = {};

    if (!form.name.trim()) errors.name = 'Doctor name is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Enter a valid email address';
    }

    // Branch selection is only mandatory if branches exist and user is OWNER (otherwise ADMIN is auto-scoped)
    if (!isAdmin && branches.length > 0 && !form.branchId) {
      errors.branchId = 'Assigned branch is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOpen = () => {
    setForm({
      name: '',
      clinicName: '',
      email: '',
      phone: '',
      address: '',
      branchId: isAdmin ? user?.branchId || '' : branches[0]?.id || '',
      isActive: true,
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditOpen = (doctor: DoctorListItem) => {
    setSelectedDoctor(doctor);
    setForm({
      name: doctor.name,
      clinicName: doctor.clinicName || '',
      email: doctor.email || '',
      phone: doctor.phone || '',
      address: doctor.address || '',
      branchId: doctor.branchId || '',
      isActive: doctor.isActive,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload: CreateDoctorPayload = {
        name: form.name,
        clinicName: form.clinicName || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        branchId: form.branchId || undefined,
      };
      await doctorService.create(payload);
      toast.success('Doctor added successfully!');
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to add doctor';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !validateForm()) return;

    try {
      setSaving(true);
      await doctorService.update(selectedDoctor.id, form);
      toast.success('Doctor updated successfully!');
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to update doctor';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof CreateDoctorPayload | 'isActive', value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field as keyof CreateDoctorPayload]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const toggleSort = (field: 'name' | 'clinicName' | 'createdAt') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleToggleStatus = async (doctor: DoctorListItem) => {
    const newStatus = !doctor.isActive;
    try {
      await doctorService.update(doctor.id, { isActive: newStatus });
      toast.success(`Doctor ${newStatus ? 'activated' : 'deactivated'}`);
      await fetchData();
    } catch {
      toast.error('Failed to update doctor status');
    }
  };

  const confirmDelete = (doctor: DoctorListItem) => {
    setDoctorToDelete(doctor);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!doctorToDelete) return;
    try {
      setDeleting(true);
      await doctorService.delete(doctorToDelete.id);
      toast.success('Doctor record deleted successfully');
      setDeleteModalOpen(false);
      setDoctorToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete doctor');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">Doctors</h1>
          <p className="page-header__subtitle">Manage dental doctor and clinic records</p>
        </div>
        <button
          id="btn-add-doctor"
          className="btn btn--primary"
          onClick={handleCreateOpen}
        >
          <Plus size={18} />
          <span>Add Doctor</span>
        </button>
      </div>

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <Heart size={24} style={{ color: '#E35B77' }} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">Total Doctors</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--success">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.active}</span>
            <span className="stat-card__label">Active Clinics</span>
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
      <div className="table-toolbar" style={{ gap: '1rem' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-doctor-search"
            type="text"
            className="form-input search-input"
            placeholder="Search doctors or clinics..."
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
            {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((s) => (
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
          <span>Loading doctor records...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: '#FDEFF2' }}>
            <Heart size={48} style={{ color: '#E35B77' }} />
          </div>
          <h3 className="empty-state__title">
            {doctors.length === 0 ? 'No doctor records yet' : 'No matching records'}
          </h3>
          <p className="empty-state__text">
            {doctors.length === 0
              ? 'Add details of dental clinics or external doctors to assign work orders.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {doctors.length === 0 && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
            >
              <Plus size={18} />
              <span>Add Doctor</span>
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table" id="doctors-table">
            <thead>
              <tr>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('name')}>
                    Doctor Name
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('clinicName')}>
                    Clinic / Hospital
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>Contact Info</th>
                <th>Clinic Address</th>
                {!isAdmin && <th>Branch</th>}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doctor) => (
                <tr key={doctor.id}>
                  <td>
                    <div className="cell-primary">
                      <div className="cell-avatar" style={{ background: 'linear-gradient(135deg, #FAD0C4, #FF9A9E)' }}>
                        D
                      </div>
                      <div>
                        <span className="cell-primary__name">
                          {doctor.name}
                        </span>
                        <span className="cell-primary__meta">
                          Added {new Date(doctor.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {doctor.clinicName ? (
                      <span className="cell-subdomain" style={{ textTransform: 'none', fontWeight: 600 }}>
                        {doctor.clinicName}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="cell-user">
                      {doctor.email && (
                        <span className="cell-user__email" style={{ marginBottom: '2px', textTransform: 'none' }}>
                          <Mail size={11} /> {doctor.email}
                        </span>
                      )}
                      {doctor.phone && (
                        <span className="cell-user__email">
                          <Phone size={11} /> {doctor.phone}
                        </span>
                      )}
                      {!doctor.email && !doctor.phone && <span className="text-muted">—</span>}
                    </div>
                  </td>
                  <td>
                    {doctor.address ? (
                      <span className="cell-date" style={{ maxWidth: '200px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.4' }}>
                        <MapPin size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }} />
                        {doctor.address}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  {!isAdmin && (
                    <td>
                      {doctor.branch ? (
                        <div className="cell-primary" style={{ gap: '0.25rem' }}>
                          <Building2 size={12} style={{ color: 'var(--accent-primary)' }} />
                          <span className="cell-branch" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{doctor.branch.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  <td>
                    <span className={`badge ${doctor.isActive ? 'badge--success' : 'badge--warning'}`}>
                      {doctor.isActive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {doctor.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className={`btn-action ${doctor.isActive ? 'btn-action--danger' : 'btn-action--success'}`}
                        onClick={() => handleToggleStatus(doctor)}
                        title={doctor.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {doctor.isActive ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                        <span>{doctor.isActive ? 'Deactivate' : 'Activate'}</span>
                      </button>
                      <button
                        className="btn-action"
                        onClick={() => handleEditOpen(doctor)}
                        title="Edit Doctor"
                      >
                        <span>Edit</span>
                      </button>
                      <button
                        className="btn-action btn-action--danger"
                        onClick={() => confirmDelete(doctor)}
                        title="Delete Doctor"
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
                <h2 className="modal__title">Add Doctor Record</h2>
                <p className="modal__subtitle">Register an external doctor or dental clinic</p>
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
                <label className="form-label" htmlFor="input-doctor-name">
                  Doctor Name *
                </label>
                <input
                  id="input-doctor-name"
                  className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                  type="text"
                  placeholder="e.g., Dr. John Watson"
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
                <label className="form-label" htmlFor="input-doctor-clinic">
                  Clinic / Hospital Name
                </label>
                <input
                  id="input-doctor-clinic"
                  className="form-input"
                  type="text"
                  placeholder="e.g., Baker Street Dental Clinic"
                  value={form.clinicName}
                  onChange={(e) => handleInputChange('clinicName', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-doctor-email">
                    Email Address
                  </label>
                  <input
                    id="input-doctor-email"
                    className={`form-input ${formErrors.email ? 'form-input--error' : ''}`}
                    type="email"
                    placeholder="e.g., doctor@example.com"
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
                  <label className="form-label" htmlFor="input-doctor-phone">
                    Phone Number
                  </label>
                  <input
                    id="input-doctor-phone"
                    className="form-input"
                    type="text"
                    placeholder="e.g., +919876543210"
                    value={form.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-doctor-address">
                  Clinic Address
                </label>
                <textarea
                  id="input-doctor-address"
                  className="form-input"
                  style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                  placeholder="e.g., 221B Baker St, London"
                  value={form.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Branch select (Hidden/Disabled if admin, shown if owner) */}
              {!isAdmin && branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-doctor-branch">
                    Assigned Branch *
                  </label>
                  <select
                    id="select-doctor-branch"
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
                  id="btn-submit-doctor"
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
                    <span>Add Doctor</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedDoctor && (
        <div className="modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Edit Doctor</h2>
                <p className="modal__subtitle">Update details for <strong>{selectedDoctor.name}</strong></p>
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
                <label className="form-label" htmlFor="input-edit-doctor-name">
                  Doctor Name *
                </label>
                <input
                  id="input-edit-doctor-name"
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
                <label className="form-label" htmlFor="input-edit-doctor-clinic">
                  Clinic / Hospital Name
                </label>
                <input
                  id="input-edit-doctor-clinic"
                  className="form-input"
                  type="text"
                  value={form.clinicName}
                  onChange={(e) => handleInputChange('clinicName', e.target.value)}
                  disabled={saving}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-edit-doctor-email">
                    Email Address
                  </label>
                  <input
                    id="input-edit-doctor-email"
                    className={`form-input ${formErrors.email ? 'form-input--error' : ''}`}
                    type="email"
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
                  <label className="form-label" htmlFor="input-edit-doctor-phone">
                    Phone Number
                  </label>
                  <input
                    id="input-edit-doctor-phone"
                    className="form-input"
                    type="text"
                    value={form.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-doctor-address">
                  Clinic Address
                </label>
                <textarea
                  id="input-edit-doctor-address"
                  className="form-input"
                  style={{ minHeight: '60px', fontFamily: 'inherit', padding: '10px 14px' }}
                  value={form.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Branch select (Hidden if admin, shown if owner) */}
              {!isAdmin && branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-edit-doctor-branch">
                    Assigned Branch *
                  </label>
                  <select
                    id="select-edit-doctor-branch"
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

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-doctor-status">
                  Status *
                </label>
                <select
                  id="select-edit-doctor-status"
                  className="form-input"
                  value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => handleInputChange('isActive', e.target.value === 'ACTIVE')}
                  disabled={saving}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
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
                  id="btn-edit-submit-doctor"
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
      {deleteModalOpen && doctorToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">Delete Doctor</h2>
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
                Are you sure you want to delete doctor <strong>{doctorToDelete.name}</strong>? This action will permanently remove the record from the database.
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

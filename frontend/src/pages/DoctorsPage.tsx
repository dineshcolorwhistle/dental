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
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { doctorService, branchService, type DoctorListItem, type BranchListItem, type CreateDoctorPayload } from '../services';
import { useAuth } from '../context';
import { Pagination, SearchableSelect, PhoneInput } from '../components';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export function DoctorsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canEdit = user?.role === 'ADMIN';

  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
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
      toast.error(t('doctors.failedLoad'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.branchId, t]);

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

  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // ─── Stats ──────────────────────────────────────────

  const stats = {
    total: doctors.length,
    active: doctors.filter((d) => d.isActive).length,
    inactive: doctors.filter((d) => !d.isActive).length,
  };

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreateDoctorPayload, string>> = {};

    if (!form.name.trim()) errors.name = t('validation.fieldRequired');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = t('validation.invalidEmail');
    }

    // Branch selection is only mandatory if branches exist and user is OWNER (otherwise ADMIN is auto-scoped)
    if (!isAdmin && branches.length > 0 && !form.branchId) {
      errors.branchId = t('validation.fieldRequired');
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
      toast.success(t('doctors.createSuccess'));
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('doctors.failedCreate');
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
      toast.success(t('doctors.updateSuccess'));
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('doctors.failedUpdate');
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
      toast.success(t('doctors.statusChanged', { status: newStatus ? t('common.active') : t('common.inactive'), defaultValue: `Doctor ${newStatus ? 'activated' : 'deactivated'}` }));
      await fetchData();
    } catch {
      toast.error(t('doctors.failedUpdate'));
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
      toast.success(t('doctors.deleteSuccess'));
      setDeleteModalOpen(false);
      setDoctorToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('doctors.failedDelete'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('doctors.title')}</h1>
          <p className="page-header__subtitle">{t('doctors.subtitle', { defaultValue: 'Manage dental doctor and clinic records' })}</p>
        </div>
        {canEdit && (
          <button
            id="btn-add-doctor"
            className="btn btn--primary"
            onClick={handleCreateOpen}
          >
            <Plus size={18} />
            <span>{t('doctors.createDoctor')}</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <Heart size={24} style={{ color: '#E35B77' }} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">{t('doctors.totalDoctors', { defaultValue: 'Total Doctors' })}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--success">
            <CheckCircle2 size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.active}</span>
            <span className="stat-card__label">{t('doctors.activeClinics', { defaultValue: 'Active Clinics' })}</span>
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
      <div className="table-toolbar" style={{ gap: '1rem' }}>
        <div className="search-input-wrap">
          <Search size={16} className="search-input__icon" />
          <input
            id="input-doctor-search"
            type="text"
            className="form-input search-input"
            placeholder={t('doctors.searchPlaceholder')}
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

          {/* Status Chips */}
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                className={`filter-chip ${selectedStatusFilter === s ? 'filter-chip--active' : ''}`}
                onClick={() => setSelectedStatusFilter(s)}
              >
                {s === 'ALL' ? t('common.all') : s === 'ACTIVE' ? t('enums.userStatus.ACTIVE') : t('enums.userStatus.INACTIVE')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>{t('doctors.loading', { defaultValue: 'Loading doctor records...' })}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: '#FDEFF2' }}>
            <Heart size={48} style={{ color: '#E35B77' }} />
          </div>
          <h3 className="empty-state__title">
            {doctors.length === 0 ? t('doctors.noDoctorsYet', { defaultValue: 'No doctor records yet' }) : t('doctors.noMatching', { defaultValue: 'No matching records' })}
          </h3>
          <p className="empty-state__text">
            {doctors.length === 0
              ? t('doctors.createDesc', { defaultValue: 'Add details of dental clinics or external doctors to assign work orders.' })
              : t('doctors.adjustFilters', { defaultValue: 'Try adjusting your search or filter criteria.' })}
          </p>
          {doctors.length === 0 && canEdit && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
            >
              <Plus size={18} />
              <span>{t('doctors.createDoctor')}</span>
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
                    {t('doctors.doctorName')}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('clinicName')}>
                    {t('doctors.clinic')}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>{t('branches.contactInfo', { defaultValue: 'Contact Info' })}</th>
                <th>{t('doctors.clinicAddress', { defaultValue: 'Clinic Address' })}</th>
                {!isAdmin && <th>{t('common.branch')}</th>}
                <th>{t('common.status')}</th>
                {canEdit && <th>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((doctor) => (
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
                          {t('common.created')} {new Date(doctor.createdAt).toLocaleDateString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-IN', {
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
                      {doctor.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className={`btn-action ${doctor.isActive ? 'btn-action--danger' : 'btn-action--success'}`}
                          onClick={() => handleToggleStatus(doctor)}
                          title={doctor.isActive ? t('common.disable') : t('common.enable')}
                        >
                          {doctor.isActive ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                          <span>{doctor.isActive ? t('common.disable') : t('common.enable')}</span>
                        </button>
                        <button
                          className="btn-action"
                          onClick={() => handleEditOpen(doctor)}
                          title={t('doctors.editDoctor')}
                        >
                          <span>{t('common.edit')}</span>
                        </button>
                        <button
                          className="btn-action btn-action--danger"
                          onClick={() => confirmDelete(doctor)}
                          title={t('doctors.deleteConfirm')}
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
                <h2 className="modal__title">{t('doctors.createDoctor')}</h2>
                <p className="modal__subtitle">{t('doctors.createDoctorSubtitle', { defaultValue: 'Register an external doctor or dental clinic' })}</p>
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
                  {t('doctors.doctorName')} *
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
                  {t('doctors.clinicName')}
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
                    {t('common.email')}
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
                    {t('common.phone')}
                  </label>
                  <PhoneInput
                    id="input-doctor-phone"
                    value={form.phone}
                    onChange={(val) => handleInputChange('phone', val)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-doctor-address">
                  {t('doctors.clinicAddress', { defaultValue: 'Clinic Address' })}
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
                    {t('admins.assignedBranch')} *
                  </label>
                  <SearchableSelect
                     id="select-doctor-branch"
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
                  id="btn-submit-doctor"
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
                    <span>{t('doctors.createDoctor')}</span>
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
                <h2 className="modal__title">{t('doctors.editDoctor')}</h2>
                <p className="modal__subtitle">{t('admins.updateDetailsFor', { defaultValue: 'Update details for' })} <strong>{selectedDoctor.name}</strong></p>
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
                  {t('doctors.doctorName')} *
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
                  {t('doctors.clinicName')}
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
                    {t('common.email')}
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
                    {t('common.phone')}
                  </label>
                  <PhoneInput
                    id="input-edit-doctor-phone"
                    value={form.phone}
                    onChange={(val) => handleInputChange('phone', val)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-doctor-address">
                  {t('doctors.clinicAddress', { defaultValue: 'Clinic Address' })}
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
                    {t('admins.assignedBranch')} *
                  </label>
                  <SearchableSelect
                    id="select-edit-doctor-branch"
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

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-doctor-status">
                  {t('common.status')} *
                </label>
                <select
                  id="select-edit-doctor-status"
                  className="form-input"
                  value={form.isActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => handleInputChange('isActive', e.target.value === 'ACTIVE')}
                  disabled={saving}
                >
                  <option value="ACTIVE">{t('common.active')}</option>
                  <option value="INACTIVE">{t('common.inactive')}</option>
                </select>
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
                  id="btn-edit-submit-doctor"
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
      {deleteModalOpen && doctorToDelete && (
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
                {t('doctors.deleteConfirmText', { name: doctorToDelete.name, defaultValue: `Are you sure you want to delete doctor ${doctorToDelete.name}? This action will permanently remove the record from the database.` })}
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

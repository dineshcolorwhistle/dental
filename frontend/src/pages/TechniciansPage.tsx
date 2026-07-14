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
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { technicianService, branchService, authService, type TechnicianListItem, type BranchListItem, type CreateTechnicianPayload, type UpdateTechnicianPayload, type TenantLimitsResponse } from '../services';
import { useAuth } from '../context';
import { Pagination, SearchableSelect, PhoneInput } from '../components';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'INVITED';

export function TechniciansPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canEdit = user?.role === 'ADMIN';

  const [technicians, setTechnicians] = useState<TechnicianListItem[]>([]);
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

  const [tenantLimits, setTenantLimits] = useState<TenantLimitsResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;
      const [technicianData, branchData, limitsData] = await Promise.all([
        technicianService.getAll(branchScope),
        isAdmin ? Promise.resolve([]) : branchService.getAll(),
        authService.getTenantLimits(),
      ]);
      setTechnicians(technicianData);
      setBranches(branchData.filter((b) => b.isActive));
      setTenantLimits(limitsData);
    } catch (err) {
      toast.error(t('technicians.failedLoad'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.branchId, t]);

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

  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // ─── Stats ──────────────────────────────────────────

  const stats = {
    total: technicians.length,
    active: technicians.filter((t) => t.status === 'ACTIVE').length,
    invited: technicians.filter((t) => t.status === 'INVITED').length,
  };

  // ─── Form Handling ──────────────────────────────────

  const validateForm = (isEdit = false): boolean => {
    const errors: Partial<Record<keyof CreateTechnicianPayload, string>> = {};

    if (!form.firstName.trim()) errors.firstName = t('validation.fieldRequired');
    if (!form.lastName.trim()) errors.lastName = t('validation.fieldRequired');

    if (!isEdit) {
      if (!form.email.trim()) {
        errors.email = t('validation.fieldRequired');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = t('validation.invalidEmail');
      }
    }

    if (!isAdmin && !form.branchId) {
      errors.branchId = t('validation.fieldRequired');
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
      toast.success(t('technicians.inviteSent'));
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('technicians.failedCreate');
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
      toast.success(t('technicians.updateSuccess'));
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('technicians.failedUpdate');
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
      toast.success(t('technicians.statusChanged', { status: newStatus === 'ACTIVE' ? t('common.active') : t('common.inactive'), defaultValue: `Technician ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}` }));
      await fetchData();
    } catch {
      toast.error(t('technicians.failedUpdate'));
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
      toast.success(t('technicians.deleteSuccess'));
      setDeleteModalOpen(false);
      setTechnicianToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('technicians.failedDelete'));
    } finally {
      setDeleting(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { className: string; icon: React.ReactNode; labelKey: string }> = {
      ACTIVE: { className: 'badge badge--success', icon: <CheckCircle2 size={12} />, labelKey: 'enums.userStatus.ACTIVE' },
      INACTIVE: { className: 'badge badge--warning', icon: <XCircle size={12} />, labelKey: 'enums.userStatus.INACTIVE' },
      INVITED: { className: 'badge badge--primary', icon: <Mail size={12} />, labelKey: 'enums.userStatus.INVITED' },
    };

    const current = config[status] || { className: 'badge', icon: null, labelKey: 'enums.userStatus.INACTIVE' };

    return (
      <span className={current.className}>
        {current.icon}
        {t(current.labelKey)}
      </span>
    );
  };

  const isLimitReached = tenantLimits
    ? tenantLimits.currentTechnicians >= tenantLimits.maxTechnicians
    : false;

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('technicians.title')}</h1>
          <p className="page-header__subtitle">{t('technicians.subtitle', { defaultValue: 'Manage dental lab technicians and their access' })}</p>
        </div>
        {canEdit && (
          <button
            id="btn-add-technician"
            className="btn btn--primary"
            onClick={handleCreateOpen}
            disabled={isLimitReached}
          >
            <Plus size={18} />
            <span>{t('technicians.createTechnician')}</span>
          </button>
        )}
      </div>

      {isLimitReached && (
        <div className="alert alert--danger" style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderRadius: '12px', border: '1px solid var(--danger)', background: 'var(--bg-base)', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          <AlertCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>{t('technicians.limitReachedTitle', { defaultValue: 'Technician Limit Reached' })}</h4>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {t('technicians.limitReachedDesc', { count: tenantLimits?.maxTechnicians, defaultValue: `Your organization has reached the limit of ${tenantLimits?.maxTechnicians} Lab Technician(s). To invite more, please contact your laboratory administrator or support to upgrade your plan.` })}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="tenants-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <Wrench size={24} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">{t('technicians.totalTechnicians', { defaultValue: 'Total Technicians' })}</span>
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
          <div className="stat-card__icon stat-card__icon--primary">
            <Mail size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.invited}</span>
            <span className="stat-card__label">{t('technicians.pendingInvites', { defaultValue: 'Pending Invites' })}</span>
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
            placeholder={t('technicians.searchPlaceholder')}
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
            {(['ALL', 'ACTIVE', 'INACTIVE', 'INVITED'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                className={`filter-chip ${selectedStatusFilter === s ? 'filter-chip--active' : ''}`}
                onClick={() => setSelectedStatusFilter(s)}
              >
                {s === 'ALL' ? t('common.all') : s === 'ACTIVE' ? t('enums.userStatus.ACTIVE') : s === 'INACTIVE' ? t('enums.userStatus.INACTIVE') : t('enums.userStatus.INVITED')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>{t('technicians.loading', { defaultValue: 'Loading technicians...' })}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
            <Wrench size={48} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h3 className="empty-state__title">
            {technicians.length === 0 ? t('technicians.noTechnicians', { defaultValue: 'No technicians found' }) : t('technicians.noMatching', { defaultValue: 'No matching records' })}
          </h3>
          <p className="empty-state__text">
            {technicians.length === 0
              ? t('technicians.createDesc', { defaultValue: 'Invite technicians to assign design tasks and lab manufacturing workflow steps.' })
              : t('technicians.adjustFilters', { defaultValue: 'Try adjusting your search or filter criteria.' })}
          </p>
          {technicians.length === 0 && canEdit && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
              disabled={isLimitReached}
            >
              <Plus size={18} />
              <span>{t('technicians.createTechnician')}</span>
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
                    {t('navigation.technician')}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>
                  <button className="th-sort" onClick={() => toggleSort('email')}>
                    {t('common.email')}
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th>{t('common.phone')}</th>
                {!isAdmin && <th>{t('common.branch')}</th>}
                <th>{t('common.status')}</th>
                {canEdit && <th>{t('common.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.map((tech) => (
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
                          {t('common.joined', { defaultValue: 'Joined' })} {new Date(tech.createdAt).toLocaleDateString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-IN', {
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
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {tech.status !== 'INVITED' && (
                          <button
                            className={`btn-action ${tech.status === 'ACTIVE' ? 'btn-action--danger' : 'btn-action--success'}`}
                            onClick={() => handleToggleStatus(tech)}
                            title={tech.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}
                          >
                            {tech.status === 'ACTIVE' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                            <span>{tech.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}</span>
                          </button>
                        )}
                        <button
                          className="btn-action"
                          onClick={() => handleEditOpen(tech)}
                          title={t('technicians.editTechnician')}
                        >
                          <span>{t('common.edit')}</span>
                        </button>
                        <button
                          className="btn-action btn-action--danger"
                          onClick={() => confirmDelete(tech)}
                          title={t('technicians.deleteConfirm')}
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
                <h2 className="modal__title">{t('technicians.createTechnician')}</h2>
                <p className="modal__subtitle">{t('technicians.createTechnicianSubtitle', { defaultValue: 'Invite a new technician to this dental laboratory' })}</p>
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
                    {t('admins.firstName')} *
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
                    {t('admins.lastName')} *
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
                  {t('common.email')} *
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
                  {t('common.phone')}
                </label>
                <PhoneInput
                  id="input-tech-phone"
                  value={form.phone}
                  onChange={(val) => handleInputChange('phone', val)}
                  disabled={saving}
                />
              </div>

              {/* Branch select (Hidden if admin, shown if owner) */}
              {!isAdmin && branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-tech-branch">
                    {t('admins.assignedBranch')} *
                  </label>
                  <SearchableSelect
                    id="select-tech-branch"
                    options={branches.map((b) => ({
                      value: b.id,
                      label: `${b.name} (${b.code})`,
                    }))}
                    value={form.branchId}
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
                  id="btn-submit-technician"
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
                    <span>{t('technicians.createTechnician')}</span>
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
                <h2 className="modal__title">{t('technicians.editTechnician')}</h2>
                <p className="modal__subtitle">{t('admins.updateDetailsFor', { defaultValue: 'Update details for' })} <strong>{selectedTechnician.firstName} {selectedTechnician.lastName}</strong></p>
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
                    {t('admins.firstName')} *
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
                    {t('admins.lastName')} *
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
                  {t('common.email')}
                </label>
                <input
                  className="form-input"
                  type="email"
                  value={form.email}
                  disabled
                />
                <span className="form-error" style={{ color: 'var(--text-muted)' }}>
                  {t('technicians.emailChangeHint', { defaultValue: 'Email cannot be changed after invitation.' })}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-edit-tech-phone">
                  {t('common.phone')}
                </label>
                <PhoneInput
                  id="input-edit-tech-phone"
                  value={form.phone}
                  onChange={(val) => handleInputChange('phone', val)}
                  disabled={saving}
                />
              </div>

              {/* Branch select (Hidden if admin, shown if owner) */}
              {!isAdmin && branches.length > 0 && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-edit-tech-branch">
                    {t('admins.assignedBranch')} *
                  </label>
                  <SearchableSelect
                    id="select-edit-tech-branch"
                    options={branches.map((b) => ({
                      value: b.id,
                      label: `${b.name} (${b.code})`,
                    }))}
                    value={form.branchId}
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

              {selectedTechnician.status !== 'INVITED' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="select-edit-tech-status">
                    {t('common.status')} *
                  </label>
                  <select
                    id="select-edit-tech-status"
                    className="form-input"
                    value={form.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    disabled={saving}
                  >
                    <option value="ACTIVE">{t('common.active')}</option>
                    <option value="INACTIVE">{t('common.inactive')}</option>
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
                  {t('common.cancel')}
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
      {deleteModalOpen && technicianToDelete && (
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
                {t('technicians.deleteConfirmText', { name: `${technicianToDelete.firstName} ${technicianToDelete.lastName}`, defaultValue: `Are you sure you want to delete technician ${technicianToDelete.firstName} ${technicianToDelete.lastName}? This action will permanently remove the record from the database.` })}
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

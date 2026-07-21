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
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { adminService, branchService, authService, type AdminListItem, type BranchListItem, type CreateAdminPayload, type TenantLimitsResponse, type UserProfile } from '../services';
import { Pagination, SearchableSelect, PhoneInput } from '../components';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'INVITED';

export function AdminsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canDelete = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
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

  const [tenantLimits, setTenantLimits] = useState<TenantLimitsResponse | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isOwnerEmailMatched, setIsOwnerEmailMatched] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [adminData, branchData, limitsData, profileData] = await Promise.all([
        adminService.getAll(),
        branchService.getAll(),
        authService.getTenantLimits(),
        authService.getProfile(),
      ]);
      setAdmins(adminData);
      setBranches(branchData.filter((b) => b.isActive));
      setTenantLimits(limitsData);
      setCurrentUserProfile(profileData);
    } catch (err) {
      toast.error(t('admins.failedLoad'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [t]);

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

    if (!form.firstName.trim()) errors.firstName = t('validation.fieldRequired');

    if (!isEdit) {
      if (!form.email.trim()) {
        errors.email = t('validation.fieldRequired');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errors.email = t('validation.invalidEmail');
      }
    }

    if (!form.branchId) {
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
      branchId: branches[0]?.id || '',
    });
    setIsOwnerEmailMatched(false);
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
      const newAdmin = await adminService.create(form);
      if (newAdmin && (newAdmin as any).isOwnerAdmin) {
        toast.success(t('admins.createSuccess'));
      } else {
        toast.success(t('admins.inviteSent'));
      }
      setShowCreateModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('admins.failedCreate');
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
      toast.success(t('admins.updateSuccess'));
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('admins.failedUpdate');
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof CreateAdminPayload | 'status', value: string) => {
    if (field === 'email') {
      const emailVal = value;
      const trimmedEmail = emailVal.trim().toLowerCase();
      const matchesOwner = !!currentUserProfile && currentUserProfile.email.toLowerCase() === trimmedEmail;
      
      setIsOwnerEmailMatched(matchesOwner);
      
      if (matchesOwner) {
        setForm((prev) => ({
          ...prev,
          email: emailVal,
          firstName: currentUserProfile.firstName,
          lastName: currentUserProfile.lastName,
          phone: currentUserProfile.phone || '',
        }));
        setFormErrors((prev) => ({
          ...prev,
          email: undefined,
          firstName: undefined,
          lastName: undefined,
        }));
      } else {
        setForm((prev) => {
          const wasMatched = isOwnerEmailMatched;
          return {
            ...prev,
            email: emailVal,
            ...(wasMatched ? { firstName: '', lastName: '', phone: '' } : {}),
          };
        });
        if (formErrors.email) {
          setFormErrors((prev) => ({ ...prev, email: undefined }));
        }
      }
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
      if (formErrors[field as keyof CreateAdminPayload]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
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
      toast.success(t('admins.statusChanged', { status: newStatus === 'ACTIVE' ? t('common.active') : t('common.inactive') }));
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('admins.failedUpdate');
      toast.error(Array.isArray(message) ? message[0] : message);
    }
  };

  const handleMakeDefaultAdmin = async (admin: AdminListItem) => {
    if (!admin.branchId) return;
    try {
      setLoading(true);
      await branchService.update(admin.branchId, { defaultAdminId: admin.id });
      toast.success(t('admins.defaultAdminSet', { name: `${admin.firstName} ${admin.lastName}`, branch: admin.branch?.name }));
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('admins.failedUpdate');
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setLoading(false);
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
      toast.success(t('admins.deleteSuccess'));
      setDeleteModalOpen(false);
      setAdminToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('admins.failedDelete'));
    } finally {
      setDeleting(false);
    }
  };

  // ─── Status Badge ───────────────────────────────────

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { className: string; icon: React.ReactNode; labelKey: string }> = {
      ACTIVE: { className: 'badge badge--success', icon: <CheckCircle2 size={12} />, labelKey: 'enums.userStatus.ACTIVE' },
      INACTIVE: { className: 'badge badge--warning', icon: <XCircle size={12} />, labelKey: 'enums.userStatus.INACTIVE' },
      INVITED: { className: 'badge badge--primary', icon: <Mail size={12} />, labelKey: 'enums.userStatus.INVITED' },
    };
    const { className, icon, labelKey } = config[status] || config.INACTIVE;
    return <span className={className}>{icon} {t(labelKey)}</span>;
  };

  const isLimitReached = tenantLimits
    ? tenantLimits.currentAdmins >= tenantLimits.maxAdmins
    : false;

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('admins.title')}</h1>
          <p className="page-header__subtitle">{t('admins.subtitle', { defaultValue: 'Manage branch administrators and their roles' })}</p>
        </div>
        <button
          id="btn-add-admin"
          className="btn btn--primary"
          onClick={handleCreateOpen}
          disabled={branches.length === 0 || isLimitReached}
        >
          <Plus size={18} />
          <span>{t('admins.createAdmin')}</span>
        </button>
      </div>

      {isLimitReached && (
        <div className="alert alert--danger" style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderRadius: '12px', border: '1px solid var(--danger)', background: 'var(--bg-base)', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          <AlertCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>{t('admins.limitReachedTitle', { defaultValue: 'Lab Admin Limit Reached' })}</h4>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {t('admins.limitReachedDesc', { count: tenantLimits?.maxAdmins, defaultValue: `Your organization has reached the limit of ${tenantLimits?.maxAdmins} Lab Administrator(s). To invite more, please contact support to upgrade your plan.` })}
            </p>
          </div>
        </div>
      )}

      {branches.length === 0 && !loading && (
        <div className="alert alert--warning" style={{ display: 'flex', gap: '0.75rem', padding: '1rem', borderRadius: '12px', border: '1px solid var(--warning)', background: 'var(--bg-base)', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
          <AlertCircle size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>{t('admins.noBranchesTitle', { defaultValue: 'No Active Branches Found' })}</h4>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {t('admins.noBranchesDesc', { defaultValue: 'You need to create at least one active branch before inviting or managing branch administrators. Go to the Branches tab to create a branch.' })}
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
            <span className="stat-card__label">{t('admins.totalAdmins', { defaultValue: 'Total Admins' })}</span>
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
            <Mail size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.invited}</span>
            <span className="stat-card__label">{t('admins.invitedPending', { defaultValue: 'Invited (Pending Setup)' })}</span>
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
            placeholder={t('admins.searchPlaceholder')}
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
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('common.branch')}:</span>
            <select
              className="form-input"
              style={{ width: '160px', height: '36px', padding: '0 0.75rem', borderRadius: '8px', fontSize: '0.8125rem' }}
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
            >
              <option value="ALL">{t('common.allBranches', { defaultValue: 'All Branches' })}</option>
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
          <span>{t('admins.loading')}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">
            <Users size={48} />
          </div>
          <h3 className="empty-state__title">
            {admins.length === 0 ? t('admins.noAdminsYet', { defaultValue: 'No admins yet' }) : t('admins.noMatching', { defaultValue: 'No matching administrators' })}
          </h3>
          <p className="empty-state__text">
            {admins.length === 0
              ? t('admins.inviteDesc', { defaultValue: 'Invite your branch managers or assistants as administrators.' })
              : t('admins.adjustFilters', { defaultValue: 'Try adjusting your search, branch, or filter criteria.' })}
          </p>
          {admins.length === 0 && branches.length > 0 && (
            <button
              className="btn btn--primary"
              onClick={handleCreateOpen}
              disabled={isLimitReached}
            >
              <Plus size={18} />
              <span>{t('admins.createAdmin')}</span>
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
                    {t('enums.userRole.ADMIN')}
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
                <th>{t('admins.assignedBranch', { defaultValue: 'Assigned Branch' })}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
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
                          {admin.branch?.defaultAdminId === admin.id && (
                             <span className="badge badge--success" style={{ marginLeft: '8px', fontSize: '0.6875rem', padding: '2px 6px', textTransform: 'uppercase', verticalAlign: 'middle', fontWeight: 700 }}>
                               {t('branches.defaultAdmin')}
                             </span>
                           )}
                        </span>
                        <span className="cell-primary__meta">
                          {t('common.created') || 'Created'} {new Date(admin.createdAt).toLocaleDateString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-IN', {
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
                        title={admin.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}
                      >
                        {admin.status === 'ACTIVE' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                        <span>{admin.status === 'ACTIVE' ? t('common.disable') : t('common.enable')}</span>
                      </button>
                      {admin.status === 'ACTIVE' && admin.branchId && admin.branch?.defaultAdminId !== admin.id && (
                         <button
                           className="btn-action"
                           style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
                           onClick={() => handleMakeDefaultAdmin(admin)}
                           title={t('admins.designateDefaultAdmin', { defaultValue: 'Designate as Default Admin' })}
                         >
                           <span>{t('admins.makeDefault', { defaultValue: 'Make Default' })}</span>
                         </button>
                       )}
                      <button
                        className="btn-action"
                        onClick={() => handleEditOpen(admin)}
                        title={t('admins.editAdmin')}
                      >
                        <span>{t('common.edit')}</span>
                      </button>
                      {canDelete && (
                        <button
                          className="btn-action btn-action--danger"
                          onClick={() => confirmDelete(admin)}
                          title={t('common.delete')}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
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
                <h2 className="modal__title">{t('admins.createAdmin')}</h2>
                <p className="modal__subtitle">{t('admins.createAdminSubtitle', { defaultValue: 'Create a manager or administrator and assign them to a branch' })}</p>
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
              {isOwnerEmailMatched && (
                <div className="alert alert--info" style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--accent-primary)', background: 'var(--bg-base)', marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                  <AlertCircle size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    {t('admins.ownerAutoFillInfo')}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="input-admin-first">
                    {t('admins.firstName')} *
                  </label>
                  <input
                    id="input-admin-first"
                    className={`form-input ${formErrors.firstName ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder="e.g., John"
                    value={form.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    disabled={saving}
                    readOnly={isOwnerEmailMatched}
                    style={isOwnerEmailMatched ? { backgroundColor: 'var(--bg-muted)', cursor: 'not-allowed' } : undefined}
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
                    {t('admins.lastName')} ({t('common.optional', { defaultValue: 'Optional' })})
                  </label>
                  <input
                    id="input-admin-last"
                    className={`form-input ${formErrors.lastName ? 'form-input--error' : ''}`}
                    type="text"
                    placeholder="e.g., Doe"
                    value={form.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    disabled={saving}
                    readOnly={isOwnerEmailMatched}
                    style={isOwnerEmailMatched ? { backgroundColor: 'var(--bg-muted)', cursor: 'not-allowed' } : undefined}
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
                  {t('common.email')} *
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
                <span className="form-hint" style={isOwnerEmailMatched ? { color: 'var(--accent-primary)' } : undefined}>
                  {isOwnerEmailMatched ? (
                    <>
                      <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {t('admins.ownerAutoFillInfo')}
                    </>
                  ) : (
                    <>
                      <Mail size={12} />
                      {t('admins.inviteWelcomeEmailHint', { defaultValue: 'A welcome email with password reset link will be sent to this address.' })}
                    </>
                  )}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-admin-phone">
                  {t('common.phone')} ({t('common.optional', { defaultValue: 'Optional' })})
                </label>
                <PhoneInput
                  id="input-admin-phone"
                  value={form.phone}
                  onChange={(val) => handleInputChange('phone', val)}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-admin-branch">
                  {t('admins.assignedBranch')} *
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
                  placeholder={t('branches.selectBranch')}
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
                  {t('common.cancel')}
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
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>{t('admins.createAdmin')}</span>
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
                <h2 className="modal__title">{t('admins.editAdmin')}</h2>
                <p className="modal__subtitle">{t('admins.updateDetailsFor', { defaultValue: 'Update details for' })} <strong>{selectedAdmin.firstName} {selectedAdmin.lastName}</strong></p>
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
                    {t('admins.firstName')} *
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
                    {t('admins.lastName')} ({t('common.optional', { defaultValue: 'Optional' })})
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
                  {t('common.phone')} ({t('common.optional', { defaultValue: 'Optional' })})
                </label>
                <PhoneInput
                  id="input-edit-admin-phone"
                  value={form.phone}
                  onChange={(val) => handleInputChange('phone', val)}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="select-edit-admin-branch">
                  {t('admins.assignedBranch')} *
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
                  placeholder={t('branches.selectBranch')}
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
                  {t('common.status')} *
                </label>
                <select
                  id="select-edit-admin-status"
                  className="form-input"
                  value={form.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  disabled={saving}
                >
                  <option value="ACTIVE">{t('enums.userStatus.ACTIVE')}</option>
                  <option value="INACTIVE">{t('enums.userStatus.INACTIVE')}</option>
                  <option value="INVITED">{t('enums.userStatus.INVITED')}</option>
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
                  id="btn-edit-submit-admin"
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
      {deleteModalOpen && adminToDelete && (
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
                {t('admins.deleteConfirmText', { name: `${adminToDelete.firstName} ${adminToDelete.lastName}`, defaultValue: `Are you sure you want to delete administrator ${adminToDelete.firstName} ${adminToDelete.lastName}? This action will permanently remove their user account.` })}
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

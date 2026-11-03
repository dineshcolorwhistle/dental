import { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Plus,
  Search,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Mail,
  Loader2,
  ArrowUpDown,
  Phone,
  Building2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  technicianService,
  branchService,
  authService,
  type TechnicianListItem,
  type BranchListItem,
  type CreateTechnicianPayload,
  type UpdateTechnicianPayload,
  type TenantLimitsResponse,
  type InactivationCheckResult,
} from '../services';
import { useAuth } from '../context';
import { Pagination, SearchableSelect, PhoneInput } from '../components';
import { formatDate } from '../utils/dateUtils';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'INVITED';

export function TechniciansPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const canEdit = isAdmin || isOwner;
  const canCreate = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

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

  // Inactivation & warning modal states
  const [inactivationCheckLoading, setInactivationCheckLoading] = useState(false);
  const [inactivationCheckResult, setInactivationCheckResult] = useState<InactivationCheckResult | null>(null);
  const [showInactivationBlockedModal, setShowInactivationBlockedModal] = useState(false);
  const [showDeactivationWarningModal, setShowDeactivationWarningModal] = useState(false);
  const [techToDeactivate, setTechToDeactivate] = useState<TechnicianListItem | null>(null);

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

  const handleMakeDefaultTechnician = async (tech: TechnicianListItem) => {
    if (!isAdmin || !tech.branchId) return;
    try {
      setLoading(true);
      await technicianService.setDefaultTechnician(tech.id);
      toast.success(
        t('technicians.defaultTechnicianSet', {
          name: `${tech.firstName} ${tech.lastName}`,
          branch: tech.branch?.name,
          defaultValue: `${tech.firstName} ${tech.lastName} set as default technician for ${tech.branch?.name}`,
        }),
      );
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('technicians.failedUpdate');
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (tech: TechnicianListItem) => {
    if (!isAdmin) return;
    if (tech.status === 'ACTIVE') {
      // Step 1: Default technician cannot be deactivated
      if (tech.branch?.defaultTechnicianId === tech.id) {
        toast.error(
          t('technicians.cannotInactivateDefault', {
            defaultValue:
              'Cannot deactivate the default technician. Please designate another technician as the default technician first.',
          }),
        );
        return;
      }

      // Step 2: Run inactivation pre-check
      try {
        setInactivationCheckLoading(true);
        setTechToDeactivate(tech);
        const result = await technicianService.checkInactivation(tech.id);
        setInactivationCheckResult(result);

        if (result.activeWorkOrders.length > 0) {
          setShowInactivationBlockedModal(true);
        } else {
          setShowDeactivationWarningModal(true);
        }
      } catch (err: any) {
        const message = err?.response?.data?.message || t('technicians.failedUpdate');
        toast.error(Array.isArray(message) ? message[0] : message);
      } finally {
        setInactivationCheckLoading(false);
      }
    } else {
      // Reactivation flow
      try {
        await technicianService.update(tech.id, { status: 'ACTIVE' });
        toast.success(
          t('technicians.statusChanged', {
            status: t('common.active'),
            defaultValue: 'Technician activated',
          }),
        );
        await fetchData();
      } catch (err: any) {
        const message = err?.response?.data?.message || t('technicians.failedUpdate');
        toast.error(Array.isArray(message) ? message[0] : message);
      }
    }
  };

  const confirmDeactivation = async () => {
    if (!isAdmin || !techToDeactivate) return;
    try {
      setInactivationCheckLoading(true);
      await technicianService.update(techToDeactivate.id, { status: 'INACTIVE' });
      toast.success(
        t('technicians.statusChanged', {
          status: t('common.inactive'),
          defaultValue: 'Technician deactivated',
        }),
      );
      setShowDeactivationWarningModal(false);
      setTechToDeactivate(null);
      setInactivationCheckResult(null);
      await fetchData();
    } catch (err: any) {
      const message = err?.response?.data?.message || t('technicians.failedUpdate');
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setInactivationCheckLoading(false);
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
          <p className="page-header__subtitle">
            {t('technicians.subtitle', { defaultValue: 'Manage dental lab technicians and their access' })}
          </p>
        </div>
        {canCreate && (
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
        <div
          className="alert alert--danger"
          style={{
            display: 'flex',
            gap: '0.75rem',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--danger)',
            background: 'var(--bg-base)',
            marginBottom: '1.5rem',
            color: 'var(--text-primary)',
          }}
        >
          <AlertCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>
              {t('technicians.limitReachedTitle', { defaultValue: 'Technician Limit Reached' })}
            </h4>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {t('technicians.limitReachedDesc', {
                count: tenantLimits?.maxTechnicians,
                defaultValue: `Your organization has reached the limit of ${tenantLimits?.maxTechnicians} Lab Technician(s). To invite more, please contact your laboratory administrator or support to upgrade your plan.`,
              })}
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
            <span className="stat-card__label">
              {t('technicians.totalTechnicians', { defaultValue: 'Total Technicians' })}
            </span>
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
            <span className="stat-card__label">
              {t('technicians.pendingInvites', { defaultValue: 'Pending Invites' })}
            </span>
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

        <div
          className="table-toolbar__filters"
          style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}
        >
          {/* Branch Filter dropdown (Only for OWNER, since ADMIN is auto-scoped) */}
          {!isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                {t('common.branch')}:
              </span>
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
                {s === 'ALL'
                  ? t('common.all')
                  : s === 'ACTIVE'
                  ? t('enums.userStatus.ACTIVE')
                  : s === 'INACTIVE'
                  ? t('enums.userStatus.INACTIVE')
                  : t('enums.userStatus.INVITED')}
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
            {technicians.length === 0
              ? t('technicians.noTechnicians', { defaultValue: 'No technicians found' })
              : t('technicians.noMatching', { defaultValue: 'No matching records' })}
          </h3>
          <p className="empty-state__text">
            {technicians.length === 0
              ? t('technicians.createDesc', { defaultValue: 'Invite technicians to assign design tasks and lab manufacturing workflow steps.' })
              : t('technicians.adjustFilters', { defaultValue: 'Try adjusting your search or filter criteria.' })}
          </p>
          {technicians.length === 0 && canCreate && (
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
                          {tech.branch?.defaultTechnicianId === tech.id && (
                            <span
                              className="badge badge--success"
                              style={{
                                marginLeft: '8px',
                                fontSize: '0.6875rem',
                                padding: '2px 6px',
                                textTransform: 'uppercase',
                                verticalAlign: 'middle',
                                fontWeight: 700,
                              }}
                            >
                              {t('technicians.defaultTechnician', { defaultValue: 'Default Technician' })}
                            </span>
                          )}
                        </span>
                        <span className="cell-primary__meta">
                          {t('common.joined', { defaultValue: 'Joined' })} {formatDate(tech.createdAt, i18n.language, user?.timezone, {
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
                        {isAdmin && tech.status !== 'INVITED' && tech.branch?.defaultTechnicianId !== tech.id && (
                          <button
                            className={`btn-action ${tech.status === 'ACTIVE' ? 'btn-action--danger' : 'btn-action--success'}`}
                            onClick={() => handleToggleStatus(tech)}
                            title={tech.status === 'ACTIVE' ? t('common.inactive') : t('common.active')}
                            disabled={inactivationCheckLoading && techToDeactivate?.id === tech.id}
                          >
                            {tech.status === 'ACTIVE' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                            <span>{tech.status === 'ACTIVE' ? t('common.inactive') : t('common.active')}</span>
                          </button>
                        )}
                        {isAdmin && tech.status === 'ACTIVE' && tech.branchId && tech.branch?.defaultTechnicianId !== tech.id && (
                          <button
                            className="btn-action"
                            style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
                            onClick={() => handleMakeDefaultTechnician(tech)}
                            title={t('technicians.designateDefault', { defaultValue: 'Designate as Default Technician' })}
                          >
                            <span>{t('technicians.makeDefault', { defaultValue: 'Make Default' })}</span>
                          </button>
                        )}
                        <button
                          className="btn-action"
                          onClick={() => handleEditOpen(tech)}
                          title={t('technicians.editTechnician')}
                        >
                          <span>{t('common.edit')}</span>
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
                <p className="modal__subtitle">
                  {t('admins.updateDetailsFor', { defaultValue: 'Update details for' })}{' '}
                  <strong>
                    {selectedTechnician.firstName} {selectedTechnician.lastName}
                  </strong>
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
                <label className="form-label">{t('common.email')}</label>
                <input className="form-input" type="email" value={form.email} disabled />
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

      {/* Inactivation Blocked Modal */}
      {showInactivationBlockedModal && inactivationCheckResult && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowInactivationBlockedModal(false);
            setTechToDeactivate(null);
            setInactivationCheckResult(null);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">
                  {t('technicians.inactivationBlockedTitle', { defaultValue: 'Cannot Deactivate Technician' })}
                </h2>
                {techToDeactivate && (
                  <p className="modal__subtitle">
                    {techToDeactivate.firstName} {techToDeactivate.lastName}
                  </p>
                )}
              </div>
              <button
                className="modal__close"
                onClick={() => {
                  setShowInactivationBlockedModal(false);
                  setTechToDeactivate(null);
                  setInactivationCheckResult(null);
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1rem 1.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.875rem',
                  background: 'var(--danger-light, #fee2e2)',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                }}
              >
                <AlertCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {t('technicians.inactivationBlockedDesc', {
                    defaultValue: 'This technician currently has active or paused processes in the following Work Orders:',
                  })}
                </span>
              </div>
              <ul
                style={{
                  paddingLeft: '1.25rem',
                  margin: '0 0 1rem 0',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.375rem',
                }}
              >
                {inactivationCheckResult.activeWorkOrders.map((folio: string) => (
                  <li key={folio} style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {folio}
                  </li>
                ))}
              </ul>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
                {t('technicians.completeOrReassignFirst', {
                  defaultValue: 'Please complete or reassign these processes before deactivating this technician.',
                })}
              </p>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setShowInactivationBlockedModal(false);
                  setTechToDeactivate(null);
                  setInactivationCheckResult(null);
                }}
              >
                {t('common.close', { defaultValue: 'Close' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivation Warning Modal */}
      {showDeactivationWarningModal && inactivationCheckResult && techToDeactivate && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!inactivationCheckLoading) {
              setShowDeactivationWarningModal(false);
              setTechToDeactivate(null);
              setInactivationCheckResult(null);
            }
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">
                  {t('technicians.deactivationWarningTitle', { defaultValue: 'Deactivate Technician' })}
                </h2>
                <p className="modal__subtitle">
                  {techToDeactivate.firstName} {techToDeactivate.lastName} ({techToDeactivate.email})
                </p>
              </div>
              <button
                className="modal__close"
                onClick={() => {
                  if (!inactivationCheckLoading) {
                    setShowDeactivationWarningModal(false);
                    setTechToDeactivate(null);
                    setInactivationCheckResult(null);
                  }
                }}
                aria-label="Close"
                disabled={inactivationCheckLoading}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1rem 1.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.875rem',
                  background: 'var(--warning-light, #fef3c7)',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                }}
              >
                <AlertTriangle size={18} style={{ color: 'var(--warning, #d97706)', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t('technicians.deactivationWarningCard', {
                    defaultValue: 'Pending Process Reassignment Warning',
                  })}
                </span>
              </div>
              <div
                style={{
                  background: 'var(--bg-card, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '8px',
                  padding: '0.875rem 1rem',
                  fontSize: '0.8125rem',
                  lineHeight: 1.6,
                }}
              >
                <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <li>
                    {t('technicians.deactivationWarningPending', {
                      count: inactivationCheckResult.pendingProcessesCount,
                      name:
                        inactivationCheckResult.defaultTechnician?.name ||
                        t('common.unknown', { defaultValue: 'Default Technician' }),
                      defaultValue: `All ${inactivationCheckResult.pendingProcessesCount} pending or not-yet-started process(es) across all Work Orders will be reassigned to the Default Technician: ${
                        inactivationCheckResult.defaultTechnician?.name || 'Default Technician'
                      }.`,
                    })}
                  </li>
                  <li>
                    {t('technicians.deactivationWarningCompleted', {
                      defaultValue:
                        'All completed processes will retain this technician\'s name for historical reference.',
                    })}
                  </li>
                </ul>
              </div>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setShowDeactivationWarningModal(false);
                  setTechToDeactivate(null);
                  setInactivationCheckResult(null);
                }}
                disabled={inactivationCheckLoading}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                style={{ backgroundColor: 'var(--danger)' }}
                onClick={confirmDeactivation}
                disabled={inactivationCheckLoading}
              >
                {inactivationCheckLoading ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>{t('common.saving')}</span>
                  </>
                ) : (
                  <span>{t('technicians.confirmDeactivation', { defaultValue: 'Confirm Deactivation' })}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

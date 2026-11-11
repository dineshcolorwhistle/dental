import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Building2,
  Loader2,
  Search,
  Globe,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  ClipboardList,
  Calendar,
  X,
  Settings,
  Layers,
  Check,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Eye,
  Plus,
  MapPin,
  Link2,
  Copy,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../context';
import { useAppDate } from '../hooks';
import {
  connectedClinicService,
  prosthesisTypeService,
  branchService,
  apiKeyService,
  type ConnectedClinicListItem,
  type ProsthesisTypeListItem,
  type UpdateClinicProsthesisItem,
  type BranchListItem,
  type CreateClinicPayload,
} from '../services';
import {
  Pagination,
  ClinicWorkOrdersModal,
  ViewWorkOrderModal,
  PhoneInput,
} from '../components';

export function ConnectedClinicsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { formatDate, formatCurrency } = useAppDate();
  const canCreateClinic =
    user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const [clinics, setClinics] = useState<ConnectedClinicListItem[]>([]);
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONNECTED' | 'NOT_CONNECTED'>('ALL');
  const [expandedClinicId, setExpandedClinicId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Modal State for Clinic Work Orders List
  const [selectedClinicForOrders, setSelectedClinicForOrders] =
    useState<ConnectedClinicListItem | null>(null);
  // Modal State for Individual Work Order Detail Drill-down
  const [selectedWorkOrderIdForDetail, setSelectedWorkOrderIdForDetail] =
    useState<string | null>(null);

  // Add Clinic Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingClinic, setCreatingClinic] = useState(false);
  const [createForm, setCreateForm] = useState<CreateClinicPayload>({
    name: '',
    url: '',
    address: '',
    phone: '',
    branchId: '',
  });
  const [createFormErrors, setCreateFormErrors] = useState<{
    name?: string;
    url?: string;
  }>({});

  // Connect Clinic Modal State
  const [clinicToConnect, setClinicToConnect] = useState<ConnectedClinicListItem | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [branchApiKey, setBranchApiKey] = useState<string | null>(null);
  const [loadingApiKey, setLoadingApiKey] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Modal State for Prosthesis Types Management
  const [selectedClinicForProsthesis, setSelectedClinicForProsthesis] =
    useState<ConnectedClinicListItem | null>(null);
  const [allProsthesisTypes, setAllProsthesisTypes] = useState<ProsthesisTypeListItem[]>([]);
  const [loadingProsthesisTypes, setLoadingProsthesisTypes] = useState(false);
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(new Set());
  const [selectedTypePrices, setSelectedTypePrices] = useState<Record<string, number>>({});
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [savingProsthesis, setSavingProsthesis] = useState(false);

  // Modal State for Delete Clinic Confirmation
  const [clinicToDelete, setClinicToDelete] = useState<ConnectedClinicListItem | null>(null);
  const [deletingClinic, setDeletingClinic] = useState(false);

  const getClinicPendingPayment = useCallback((clinic: ConnectedClinicListItem) => {
    if (clinic.totalPending !== undefined && clinic.totalPending !== null) {
      return clinic.totalPending;
    }
    let totalPending = 0;
    clinic.doctors.forEach((doc) => {
      doc.workOrders.forEach((wo) => {
        const quote = wo.totalQuote || 0;
        const paid = wo.initialPayment || 0;
        if (wo.status !== 'CANCELLED') {
          totalPending += Math.max(0, quote - paid);
        }
      });
    });
    return totalPending;
  }, []);

  const fetchClinics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await connectedClinicService.getAll();
      setClinics(data);
    } catch {
      toast.error(t('connectedClinics.failedLoad') || 'Failed to load clinics');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchClinics();
  }, [fetchClinics]);

  useEffect(() => {
    if (user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN') {
      branchService.getAll().then(setBranches).catch(() => {});
    }
  }, [user?.role]);

  // Reset pagination when search query or status filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, statusFilter]);

  const handleOpenCreateModal = () => {
    setCreateForm({
      name: '',
      url: '',
      address: '',
      phone: '',
      branchId: user?.branchId || (branches.length > 0 ? branches[0].id : ''),
    });
    setCreateFormErrors({});
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    if (creatingClinic) return;
    setShowCreateModal(false);
    setCreateFormErrors({});
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; url?: string } = {};
    if (!createForm.name.trim()) {
      errors.name = t('common.required', { defaultValue: 'Required' });
    }
    if (!createForm.url.trim()) {
      errors.url = t('common.required', { defaultValue: 'Required' });
    }
    if (Object.keys(errors).length > 0) {
      setCreateFormErrors(errors);
      return;
    }

    try {
      setCreatingClinic(true);
      const created = await connectedClinicService.create({
        name: createForm.name.trim(),
        url: createForm.url.trim(),
        address: createForm.address?.trim() || undefined,
        phone: createForm.phone?.trim() || undefined,
        branchId: createForm.branchId || undefined,
      });
      setClinics((prev) => [created, ...prev]);
      toast.success(
        t('connectedClinics.clinicCreatedSuccess') ||
          'Clinic created successfully!'
      );
      setShowCreateModal(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('connectedClinics.clinicCreateError') ||
          'Failed to create clinic'
      );
    } finally {
      setCreatingClinic(false);
    }
  };

  const handleOpenConnectModal = async (clinic: ConnectedClinicListItem) => {
    setClinicToConnect(clinic);
    setConnectionTestResult(null);
    setCopiedApiKey(false);
    setCopiedEndpoint(false);
    setBranchApiKey(null);
    setLoadingApiKey(true);

    try {
      const keys = await apiKeyService.getAll();
      const match =
        keys.find((k) => k.branch?.id === clinic.branch.id && k.isActive) ||
        keys.find((k) => k.isActive) ||
        keys[0];
      if (match) {
        setBranchApiKey(match.key);
      }
    } catch {
      // API key fetch is non-blocking
    } finally {
      setLoadingApiKey(false);
    }
  };

  const handleCloseConnectModal = () => {
    if (connecting) return;
    setClinicToConnect(null);
    setConnectionTestResult(null);
  };

  const handleConnectClinic = async () => {
    if (!clinicToConnect) return;
    try {
      setConnecting(true);
      const res = await connectedClinicService.connect(clinicToConnect.id);
      if (res.pingMessage) {
        setConnectionTestResult({
          success: res.pingSuccess ?? true,
          message: res.pingMessage,
        });
      }
      setClinics((prev) =>
        prev.map((c) =>
          c.id === clinicToConnect.id
            ? {
                ...c,
                isConnected: true,
                connectedAt: new Date().toISOString(),
              }
            : c
        )
      );
      toast.success(
        t('connectedClinics.clinicConnectedSuccess') ||
          'Clinic connected successfully!'
      );
      setClinicToConnect(null);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          t('connectedClinics.clinicConnectError') ||
          'Failed to connect clinic'
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleCopyText = async (text: string, type: 'key' | 'endpoint') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedApiKey(true);
        setTimeout(() => setCopiedApiKey(false), 2000);
      } else {
        setCopiedEndpoint(true);
        setTimeout(() => setCopiedEndpoint(false), 2000);
      }
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const toggleExpandClinic = (id: string) => {
    setExpandedClinicId((prev) => (prev === id ? null : id));
  };

  const handleOpenProsthesisModal = async (clinic: ConnectedClinicListItem) => {
    setSelectedClinicForProsthesis(clinic);
    setModalSearchQuery('');
    setLoadingProsthesisTypes(true);

    const initialSelectedIds = new Set(
      clinic.allowedProsthesisTypes?.map((cpt) => cpt.prosthesisType.id) || []
    );
    setSelectedTypeIds(initialSelectedIds);

    const initialPrices: Record<string, number> = {};
    clinic.allowedProsthesisTypes?.forEach((cpt) => {
      const p = cpt.price !== undefined && cpt.price !== null ? cpt.price : (cpt.prosthesisType.price ?? 0);
      initialPrices[cpt.prosthesisType.id] = p;
    });
    setSelectedTypePrices(initialPrices);

    try {
      const types = await prosthesisTypeService.getAll(clinic.branch.id);
      setAllProsthesisTypes(types);

      // Pre-fill default common prices for any types not already in clinic custom prices
      setSelectedTypePrices((prev) => {
        const updated = { ...prev };
        types.forEach((pt) => {
          if (updated[pt.id] === undefined) {
            updated[pt.id] = pt.price ?? 0;
          }
        });
        return updated;
      });
    } catch {
      toast.error(t('errors.generic') || 'Failed to fetch prosthesis types');
    } finally {
      setLoadingProsthesisTypes(false);
    }
  };

  const handleCloseProsthesisModal = () => {
    setSelectedClinicForProsthesis(null);
    setAllProsthesisTypes([]);
    setSelectedTypeIds(new Set());
    setSelectedTypePrices({});
    setModalSearchQuery('');
  };

  const handleToggleProsthesisType = (id: string) => {
    setSelectedTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllTypes = () => {
    const allIds = new Set(allProsthesisTypes.map((pt) => pt.id));
    setSelectedTypeIds(allIds);
  };

  const handleDeselectAllTypes = () => {
    setSelectedTypeIds(new Set());
  };

  const handleSaveProsthesisTypes = async () => {
    if (!selectedClinicForProsthesis) return;

    try {
      setSavingProsthesis(true);
      const payload: UpdateClinicProsthesisItem[] = Array.from(selectedTypeIds).map((id) => ({
        prosthesisTypeId: id,
        price: selectedTypePrices[id] ?? 0,
      }));

      const updatedClinic = await connectedClinicService.updateProsthesisTypes(
        selectedClinicForProsthesis.id,
        payload
      );

      setClinics((prev) =>
        prev.map((c) => (c.id === updatedClinic.id ? updatedClinic : c))
      );

      toast.success(
        t('connectedClinics.saveSuccess') ||
          'Clinic prosthesis types updated successfully!'
      );
      handleCloseProsthesisModal();
    } catch {
      toast.error(
        t('connectedClinics.saveError') ||
          'Failed to update clinic prosthesis types.'
      );
    } finally {
      setSavingProsthesis(false);
    }
  };

  const handleOpenDeleteModal = (clinic: ConnectedClinicListItem) => {
    setClinicToDelete(clinic);
  };

  const handleCloseDeleteModal = () => {
    if (deletingClinic) return;
    setClinicToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!clinicToDelete) return;

    try {
      setDeletingClinic(true);
      await connectedClinicService.delete(clinicToDelete.id);
      setClinics((prev) => prev.filter((c) => c.id !== clinicToDelete.id));
      toast.success(
        t('connectedClinics.deleteSuccess') ||
          'Clinic and associated doctors/orders deleted successfully'
      );
      setClinicToDelete(null);
    } catch {
      toast.error(
        t('connectedClinics.deleteError') || 'Failed to delete connected clinic'
      );
    } finally {
      setDeletingClinic(false);
    }
  };

  const filteredClinics = clinics.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.phone && c.phone.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'CONNECTED') {
      return !!c.isConnected;
    }
    if (statusFilter === 'NOT_CONNECTED') {
      return !c.isConnected;
    }
    return true;
  });

  const paginatedClinics = filteredClinics.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  const getOrderStats = (workOrders: Array<{ status: string }>) => {
    const total = workOrders.length;
    const active = workOrders.filter(
      (wo) =>
        wo.status !== 'COMPLETED' &&
        wo.status !== 'FAILED' &&
        wo.status !== 'CANCELLED'
    ).length;
    return { total, active };
  };

  // Compute stats for all clinics
  const stats = clinics.reduce(
    (acc, c) => {
      acc.totalClinics += 1;
      if (c.isConnected) {
        acc.connectedClinics += 1;
      } else {
        acc.unconnectedClinics += 1;
      }
      c.doctors.forEach((doc) => {
        acc.totalDoctors += 1;
        doc.workOrders.forEach((wo) => {
          acc.totalOrders += 1;
          const isActive =
            wo.status !== 'COMPLETED' &&
            wo.status !== 'FAILED' &&
            wo.status !== 'CANCELLED';
          if (isActive) {
            acc.activeOrders += 1;
          }
        });
      });
      return acc;
    },
    {
      totalClinics: 0,
      connectedClinics: 0,
      unconnectedClinics: 0,
      totalDoctors: 0,
      totalOrders: 0,
      activeOrders: 0,
    }
  );

  const filteredModalTypes = allProsthesisTypes.filter(
    (pt) =>
      pt.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
      (pt.description &&
        pt.description.toLowerCase().includes(modalSearchQuery.toLowerCase()))
  );

  return (
    <div className="connected-clinics-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('connectedClinics.title')}</h1>
          <p className="page-header__subtitle">{t('connectedClinics.subtitle')}</p>
        </div>
        {canCreateClinic && (
          <div className="page-header__actions">
            <button
              id="btn-add-clinic"
              className="btn btn--primary"
              onClick={handleOpenCreateModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
              }}
            >
              <Plus size={18} />
              <span>{t('connectedClinics.addClinic', { defaultValue: 'Add Clinic' })}</span>
            </button>
          </div>
        )}
      </div>

      {/* Stats Dashboard */}
      {!loading && clinics.length > 0 && (
        <div className="dashboard-page__stats">
          {/* Total Clinics */}
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--primary">
              <Building2 size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.totalClinics}</span>
              <span className="stat-card__label">{t('connectedClinics.totalClinics')}</span>
            </div>
          </div>

          {/* Connected Clinics */}
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--success">
              <CheckCircle2 size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.connectedClinics}</span>
              <span className="stat-card__label">{t('connectedClinics.connected', { defaultValue: 'Connected' })}</span>
            </div>
          </div>

          {/* Not Connected Clinics */}
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--warning">
              <Clock size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.unconnectedClinics}</span>
              <span className="stat-card__label">{t('connectedClinics.notConnected', { defaultValue: 'Not Connected' })}</span>
            </div>
          </div>

          {/* Total Orders */}
          <div className="stat-card">
            <div
              className="stat-card__icon"
              style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}
            >
              <ClipboardList size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.totalOrders}</span>
              <span className="stat-card__label">{t('connectedClinics.totalOrders')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      {!loading && clinics.length > 0 && (
        <div
          className="table-toolbar"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Status Filter Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              id="filter-all-clinics"
              type="button"
              className={`btn btn--sm ${statusFilter === 'ALL' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setStatusFilter('ALL')}
              style={{ borderRadius: '20px', padding: '0.35rem 0.85rem' }}
            >
              {t('connectedClinics.allClinics', { defaultValue: 'All Clinics' })} ({stats.totalClinics})
            </button>
            <button
              id="filter-connected-clinics"
              type="button"
              className={`btn btn--sm ${statusFilter === 'CONNECTED' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setStatusFilter('CONNECTED')}
              style={{
                borderRadius: '20px',
                padding: '0.35rem 0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <CheckCircle2
                size={13}
                style={{
                  color:
                    statusFilter === 'CONNECTED'
                      ? 'inherit'
                      : 'var(--success, #10B981)',
                }}
              />
              {t('connectedClinics.connected', { defaultValue: 'Connected' })} ({stats.connectedClinics})
            </button>
            <button
              id="filter-not-connected-clinics"
              type="button"
              className={`btn btn--sm ${statusFilter === 'NOT_CONNECTED' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setStatusFilter('NOT_CONNECTED')}
              style={{
                borderRadius: '20px',
                padding: '0.35rem 0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Clock
                size={13}
                style={{
                  color:
                    statusFilter === 'NOT_CONNECTED' ? 'inherit' : '#F59E0B',
                }}
              />
              {t('connectedClinics.notConnected', { defaultValue: 'Not Connected' })} ({stats.unconnectedClinics})
            </button>
          </div>

          <div className="search-input-wrap">
            <Search size={16} className="search-input__icon" />
            <input
              id="input-clinic-search"
              type="text"
              className="form-input search-input"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-input__clear"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="table-loading">
          <Loader2 size={32} className="spinner" />
          <span>{t('common.loading')}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredClinics.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">
            <Building2 size={48} />
          </div>
          <h3 className="empty-state__title">
            {t('connectedClinics.title')}
          </h3>
          <p className="empty-state__text">
            {clinics.length === 0
              ? t('connectedClinics.noClinics')
              : t('common.noResults')}
          </p>
          {clinics.length === 0 && canCreateClinic && (
            <button
              id="btn-empty-add-clinic"
              className="btn btn--primary"
              onClick={handleOpenCreateModal}
              style={{
                marginTop: '1rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: 600,
              }}
            >
              <Plus size={16} />
              <span>{t('connectedClinics.addClinic', { defaultValue: 'Add Clinic' })}</span>
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && filteredClinics.length > 0 && (
        <>
          <div className="data-table-wrap">
            <table className="data-table" id="connected-clinics-table">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}></th>
                  <th>{t('connectedClinics.clinicName')}</th>
                  <th>{t('connectedClinics.status', { defaultValue: 'Status' })}</th>
                  <th>{t('connectedClinics.branch')}</th>
                  <th>{t('connectedClinics.registeredAt')}</th>
                  <th>{t('connectedClinics.prosthesisTypes')}</th>
                  <th>{t('connectedClinics.doctorsCount')}</th>
                  <th>{t('connectedClinics.totalOrders')}</th>
                  <th>{t('connectedClinics.pendingPayment', { defaultValue: 'Pending Payment' })}</th>
                  <th style={{ textAlign: 'right' }}>{t('connectedClinics.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClinics.map((clinic) => {
                  const isExpanded = expandedClinicId === clinic.id;
                  const totalClinicOrders = clinic.doctors.reduce(
                    (sum, doc) => sum + doc.workOrders.length,
                    0
                  );
                  const allowedItems = clinic.allowedProsthesisTypes || [];
                  const allowedCount = allowedItems.length;
                  const tooltipText = allowedCount > 0
                    ? allowedItems.map((item) => `• ${item.prosthesisType.name}: $${((item.price !== undefined && item.price !== null) ? item.price : (item.prosthesisType.price ?? 0)).toFixed(2)}`).join('\n')
                    : (t('connectedClinics.noProsthesisConfigured') || 'No prosthesis types configured');

                  return (
                    <Fragment key={clinic.id}>
                      <tr style={{ transition: 'background 0.2s' }}>
                        <td>
                          <button
                            className="btn btn--icon"
                            onClick={() => toggleExpandClinic(clinic.id)}
                            style={{ color: 'var(--text-secondary)' }}
                            aria-label="Expand details"
                          >
                            {isExpanded ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </button>
                        </td>
                        <td>
                          <div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                              }}
                            >
                              <Building2
                                size={16}
                                style={{ color: 'var(--accent-primary)', flexShrink: 0 }}
                              />
                              <span>{clinic.name}</span>
                            </div>
                            {clinic.url && (
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-secondary)',
                                  marginTop: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Globe size={11} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', whiteSpace: 'nowrap' }}>
                                  {clinic.url.replace(/^https?:\/\//, '')}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          {clinic.isConnected ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: 'var(--success, #10B981)',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <CheckCircle2 size={13} />
                              {t('connectedClinics.statusConnected', {
                                defaultValue: 'Connected',
                              })}
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#D97706',
                                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Clock size={13} />
                              {t('connectedClinics.statusNotConnected', {
                                defaultValue: 'Not Connected',
                              })}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge--neutral">
                            {clinic.branch.name}
                          </span>
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontSize: '0.8125rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <Calendar size={14} />
                            {formatDate(clinic.createdAt)}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${allowedCount > 0 ? 'badge--primary' : 'badge--warning'}`}
                            data-tooltip-top={tooltipText}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              fontWeight: 700,
                              fontSize: '0.8125rem',
                              cursor: 'pointer',
                            }}
                          >
                            {allowedCount}
                          </span>
                        </td>
                        <td>
                          <span
                            className="badge badge--primary"
                            style={{ minWidth: '24px', textAlign: 'center' }}
                          >
                            {clinic.doctors.length}
                          </span>
                        </td>
                        <td>
                          <span
                            className="badge badge--success"
                            style={{ minWidth: '24px', textAlign: 'center' }}
                          >
                            {totalClinicOrders}
                          </span>
                        </td>
                        <td>
                          {(() => {
                            const pending = getClinicPendingPayment(clinic);
                            const hasPending = pending > 0;
                            return (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.8125rem',
                                  fontWeight: 700,
                                  color: hasPending
                                    ? 'var(--danger, #EF4444)'
                                    : 'var(--success, #10B981)',
                                  backgroundColor: hasPending
                                    ? 'rgba(239, 68, 68, 0.08)'
                                    : 'rgba(16, 185, 129, 0.08)',
                                  border: hasPending
                                    ? '1px solid rgba(239, 68, 68, 0.2)'
                                    : '1px solid rgba(16, 185, 129, 0.2)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatCurrency(pending)}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '0.5rem',
                            }}
                          >
                            {!clinic.isConnected ? (
                              <button
                                id={`btn-connect-clinic-${clinic.id}`}
                                className="btn btn--primary btn--sm"
                                onClick={() => handleOpenConnectModal(clinic)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.8125rem',
                                  padding: '0.35rem 0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                <Link2 size={14} />
                                {t('connectedClinics.connectClinic', {
                                  defaultValue: 'Connect Clinic',
                                })}
                              </button>
                            ) : (
                              <>
                                <button
                                  id={`btn-view-orders-${clinic.id}`}
                                  className="btn btn--secondary btn--sm"
                                  onClick={() =>
                                    setSelectedClinicForOrders(clinic)
                                  }
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    fontSize: '0.8125rem',
                                    padding: '0.35rem 0.75rem',
                                  }}
                                  title={t('connectedClinics.viewOrders', {
                                    defaultValue: 'View Orders',
                                  })}
                                >
                                  <Eye size={14} />
                                  {t('connectedClinics.viewOrders', {
                                    defaultValue: 'View Orders',
                                  })}
                                </button>
                                <button
                                  id={`btn-manage-prosthesis-${clinic.id}`}
                                  className="btn btn--secondary btn--sm"
                                  onClick={() =>
                                    handleOpenProsthesisModal(clinic)
                                  }
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    fontSize: '0.8125rem',
                                    padding: '0.35rem 0.75rem',
                                  }}
                                >
                                  <Settings size={14} />
                                  {t('connectedClinics.manageProsthesis')}
                                </button>
                              </>
                            )}
                            <button
                              id={`btn-delete-clinic-${clinic.id}`}
                              className="btn btn--danger btn--sm"
                              onClick={() => handleOpenDeleteModal(clinic)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.8125rem',
                                padding: '0.35rem 0.75rem',
                              }}
                              title={t('common.delete')}
                            >
                              <Trash2 size={14} />
                              {t('common.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={10}
                            style={{
                              background: 'rgba(111, 174, 217, 0.02)',
                              padding: '1.25rem 1.5rem',
                            }}
                          >
                            <div
                              className="dashboard-card"
                              style={{ padding: '1.25rem' }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '0.75rem',
                                  marginBottom: '1rem',
                                  borderBottom: '1px solid var(--border)',
                                  paddingBottom: '0.75rem',
                                }}
                              >
                                <h4
                                  style={{
                                    margin: 0,
                                    fontSize: '0.925rem',
                                    color: 'var(--text-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                  }}
                                >
                                  <Building2
                                    size={16}
                                    style={{ color: 'var(--accent-primary)' }}
                                  />
                                  {clinic.name} - {t('connectedClinics.details')}
                                </h4>

                                </div>

                                {/* Clinic Basic Info Summary */}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns:
                                      'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    background:
                                      'var(--bg-body, rgba(234, 244, 251, 0.5))',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    marginBottom: '1rem',
                                    fontSize: '0.8125rem',
                                  }}
                                >
                                  {clinic.url && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        overflow: 'hidden',
                                      }}
                                    >
                                      <Globe
                                        size={14}
                                        style={{
                                          color: 'var(--accent-primary)',
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span
                                        style={{ color: 'var(--text-secondary)' }}
                                      >
                                        {t('connectedClinics.clinicWebsiteUrl')}:
                                      </span>
                                      <a
                                        href={
                                          clinic.url.startsWith('http')
                                            ? clinic.url
                                            : `https://${clinic.url}`
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          color: 'var(--accent-primary)',
                                          textDecoration: 'none',
                                          fontWeight: 500,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                        title={clinic.url}
                                      >
                                        {clinic.url}
                                      </a>
                                    </div>
                                  )}
                                  {clinic.address && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                      }}
                                    >
                                      <MapPin
                                        size={14}
                                        style={{
                                          color: 'var(--accent-primary)',
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span
                                        style={{ color: 'var(--text-secondary)' }}
                                      >
                                        {t('connectedClinics.address')}:
                                      </span>
                                      <span
                                        style={{
                                          color: 'var(--text-primary)',
                                          fontWeight: 500,
                                        }}
                                      >
                                        {clinic.address}
                                      </span>
                                    </div>
                                  )}
                                  {clinic.phone && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                      }}
                                    >
                                      <Phone
                                        size={14}
                                        style={{
                                          color: 'var(--accent-primary)',
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span
                                        style={{ color: 'var(--text-secondary)' }}
                                      >
                                        {t('connectedClinics.contactNumber')}:
                                      </span>
                                      <span
                                        style={{
                                          color: 'var(--text-primary)',
                                          fontWeight: 500,
                                        }}
                                      >
                                        {clinic.phone}
                                      </span>
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                    }}
                                  >
                                    {clinic.isConnected ? (
                                      <>
                                        <CheckCircle2
                                          size={14}
                                          style={{
                                            color: 'var(--success, #10B981)',
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span
                                          style={{
                                            color: 'var(--success, #10B981)',
                                            fontWeight: 600,
                                          }}
                                        >
                                          {t('connectedClinics.statusConnected', {
                                            defaultValue: 'Connected',
                                          })}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Clock
                                          size={14}
                                          style={{
                                            color: '#D97706',
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span
                                          style={{
                                            color: '#D97706',
                                            fontWeight: 600,
                                          }}
                                        >
                                          {t(
                                            'connectedClinics.statusNotConnected',
                                            { defaultValue: 'Not Connected' }
                                          )}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                              {clinic.doctors.length === 0 ? (
                                <p
                                  style={{
                                    color: 'var(--text-muted)',
                                    fontSize: '0.8125rem',
                                    textAlign: 'center',
                                    padding: '1rem 0',
                                  }}
                                >
                                  {t('connectedClinics.noDoctors')}
                                </p>
                              ) : (
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns:
                                      'repeat(auto-fill, minmax(300px, 1fr))',
                                    gap: '1rem',
                                  }}
                                >
                                  {clinic.doctors.map((doctor) => {
                                    const stats = getOrderStats(
                                      doctor.workOrders
                                    );
                                    return (
                                      <div
                                        key={doctor.id}
                                        style={{
                                          background:
                                            'var(--bg-body, rgba(234, 244, 251, 0.5))',
                                          border: '1px solid var(--border)',
                                          borderRadius: '12px',
                                          padding: '1rem',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '0.75rem',
                                          minWidth: 0,
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontSize: '0.875rem',
                                          }}
                                        >
                                          <User
                                            size={14}
                                            style={{
                                              color: 'var(--text-secondary)',
                                            }}
                                          />
                                          {doctor.name}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: '0.8125rem',
                                            color: 'var(--text-secondary)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.25rem',
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.5rem',
                                              textTransform: 'none',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                            }}
                                            title={doctor.email || undefined}
                                          >
                                            <Mail size={12} style={{ flexShrink: 0 }} />
                                            <span
                                              style={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                              }}
                                            >
                                              {doctor.email || 'N/A'}
                                            </span>
                                          </div>
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.5rem',
                                            }}
                                          >
                                            <Phone size={12} style={{ flexShrink: 0 }} />
                                            <span>{doctor.phone || 'N/A'}</span>
                                          </div>
                                        </div>
                                        <div
                                          style={{
                                            borderTop: '1px solid var(--border)',
                                            paddingTop: '0.75rem',
                                            marginTop: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.625rem',
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              gap: '0.5rem',
                                              fontSize: '0.8125rem',
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.375rem',
                                              }}
                                            >
                                              <ClipboardList
                                                size={14}
                                                style={{
                                                  color: 'var(--accent-primary)',
                                                  flexShrink: 0,
                                                }}
                                              />
                                              <span style={{ color: 'var(--text-secondary)' }}>
                                                {t('connectedClinics.totalOrders')}:
                                              </span>
                                              <strong
                                                style={{
                                                  color: 'var(--text-primary)',
                                                }}
                                              >
                                                {stats.total}
                                              </strong>
                                            </div>
                                            <div
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.375rem',
                                              }}
                                            >
                                              <span
                                                style={{
                                                  width: '8px',
                                                  height: '8px',
                                                  borderRadius: '50%',
                                                  background: 'var(--success)',
                                                  flexShrink: 0,
                                                }}
                                              ></span>
                                              <span style={{ color: 'var(--text-secondary)' }}>
                                                {t('connectedClinics.activeOrders')}:
                                              </span>
                                              <strong
                                                style={{
                                                  color: 'var(--success)',
                                                }}
                                              >
                                                {stats.active}
                                              </strong>
                                            </div>
                                          </div>
                                          {(() => {
                                            const docPending = doctor.workOrders.reduce((sum, wo) => {
                                              const q = wo.totalQuote || 0;
                                              const p = wo.initialPayment || 0;
                                              return wo.status === 'CANCELLED' ? sum : sum + Math.max(0, q - p);
                                            }, 0);
                                            return (
                                              <div
                                                style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between',
                                                  gap: '0.5rem',
                                                  fontSize: '0.8125rem',
                                                  padding: '0.375rem 0.625rem',
                                                  borderRadius: '6px',
                                                  background:
                                                    docPending > 0
                                                      ? 'rgba(239, 68, 68, 0.08)'
                                                      : 'rgba(16, 185, 129, 0.08)',
                                                  border: `1px solid ${
                                                    docPending > 0
                                                      ? 'rgba(239, 68, 68, 0.2)'
                                                      : 'rgba(16, 185, 129, 0.2)'
                                                  }`,
                                                }}
                                              >
                                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                  {t('connectedClinics.pendingAmount', { defaultValue: 'Pending Amount' })}:
                                                </span>
                                                <strong
                                                  style={{
                                                    color:
                                                      docPending > 0
                                                        ? 'var(--danger, #EF4444)'
                                                        : 'var(--success, #10B981)',
                                                    fontWeight: 700,
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                >
                                                  {formatCurrency(docPending)}
                                                </strong>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredClinics.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Manage Prosthesis Types Modal Overlay */}
      {selectedClinicForProsthesis && (
        <div className="modal-overlay" onClick={handleCloseProsthesisModal}>
          <div
            className="modal modal--lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px', overflow: 'hidden' }}
          >
            {/* Modal Header */}
            <div
              className="modal__header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.75rem',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background:
                      'linear-gradient(135deg, rgba(111, 174, 217, 0.15), rgba(70, 130, 180, 0.2))',
                    border: '1px solid rgba(111, 174, 217, 0.3)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--accent-primary)',
                    flexShrink: 0,
                  }}
                >
                  <Layers size={22} style={{ display: 'block', margin: 'auto' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3
                    className="modal__title"
                    style={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.2, margin: 0 }}
                  >
                    {t('connectedClinics.manageProsthesis')}
                  </h3>
                  <p
                    className="modal__subtitle"
                    style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0', lineHeight: 1.2 }}
                  >
                    {selectedClinicForProsthesis.name} • {selectedClinicForProsthesis.branch.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal__close"
                onClick={handleCloseProsthesisModal}
                aria-label="Close"
                style={{ margin: 0, display: 'grid', placeItems: 'center' }}
              >
                <X size={20} style={{ display: 'block', margin: 'auto' }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal__body" style={{ gap: '1rem', padding: '1.5rem 1.75rem' }}>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {t('connectedClinics.subtitle')}
              </p>

              {/* Toolbar & Filters */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  className="search-input-wrap"
                  style={{ flex: 1, minWidth: '220px' }}
                >
                  <Search size={15} className="search-input__icon" />
                  <input
                    id="input-prosthesis-modal-search"
                    type="text"
                    className="form-input search-input"
                    style={{
                      fontSize: '0.8125rem',
                      height: '38px',
                      borderRadius: '8px',
                    }}
                    placeholder={t('common.search')}
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                  />
                  {modalSearchQuery && (
                    <button
                      className="search-input__clear"
                      onClick={() => setModalSearchQuery('')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={handleSelectAllTypes}
                    style={{
                      fontSize: '0.8125rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '8px',
                    }}
                  >
                    {t('common.all')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={handleDeselectAllTypes}
                    style={{
                      fontSize: '0.8125rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '8px',
                    }}
                  >
                    {t('common.none')}
                  </button>
                </div>
              </div>

              {/* Status Badge Indicator */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  padding: '0.625rem 0.875rem',
                  background: 'rgba(111, 174, 217, 0.05)',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                }}
              >
                <span>
                  {t('connectedClinics.typesSelected', {
                    count: selectedTypeIds.size,
                  })}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    background: 'rgba(111, 174, 217, 0.12)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                  }}
                >
                  {selectedTypeIds.size} / {allProsthesisTypes.length}
                </span>
              </div>

              {/* Prosthesis Selection List */}
              {loadingProsthesisTypes ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2.5rem',
                    gap: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Loader2 size={24} className="spinner" />
                  <span>{t('common.loading')}</span>
                </div>
              ) : filteredModalTypes.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    padding: '2.5rem 1rem',
                    fontSize: '0.875rem',
                  }}
                >
                  {t('common.noResults')}
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: '340px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.625rem',
                    paddingRight: '0.375rem',
                  }}
                >
                  {filteredModalTypes.map((pt) => {
                    const isChecked = selectedTypeIds.has(pt.id);
                    const displayPrice = selectedTypePrices[pt.id] ?? pt.price ?? 0;

                    return (
                      <div
                        key={pt.id}
                        onClick={() => handleToggleProsthesisType(pt.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.875rem',
                          padding: '0.875rem 1.125rem',
                          borderRadius: '12px',
                          border: isChecked
                            ? '1.5px solid var(--accent-primary)'
                            : '1px solid var(--border)',
                          background: isChecked
                            ? 'rgba(111, 174, 217, 0.08)'
                            : 'var(--bg-surface)',
                          boxShadow: isChecked
                            ? '0 2px 8px rgba(111, 174, 217, 0.12)'
                            : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease-in-out',
                        }}
                      >
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '7px',
                            border: isChecked
                              ? 'none'
                              : '1.5px solid var(--border)',
                            background: isChecked
                              ? 'var(--accent-primary)'
                              : 'transparent',
                            color: '#ffffff',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            transition: 'all 0.15s ease-in-out',
                          }}
                        >
                          {isChecked && (
                            <Check
                              size={15}
                              strokeWidth={3}
                              style={{ display: 'block', margin: 'auto' }}
                            />
                          )}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              lineHeight: 1.3,
                              color: isChecked
                                ? 'var(--accent-primary)'
                                : 'var(--text-heading)',
                            }}
                          >
                            {pt.name}
                          </div>
                          {pt.description && (
                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
                                marginTop: '0.25rem',
                                lineHeight: 1.3,
                              }}
                            >
                              {pt.description}
                            </div>
                          )}
                        </div>

                        {/* Price Display & Custom Price Input */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          {isChecked ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {t('connectedClinics.clinicPrice')}: $
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-input"
                                style={{
                                  width: '90px',
                                  height: '32px',
                                  padding: '0.2rem 0.4rem',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                }}
                                placeholder={t('connectedClinics.enterAmount')}
                                value={displayPrice}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const val = parseFloat(e.target.value);
                                  setSelectedTypePrices((prev) => ({
                                    ...prev,
                                    [pt.id]: isNaN(val) ? 0 : val,
                                  }));
                                }}
                              />
                            </div>
                          ) : (
                            <span
                              className="badge badge--neutral"
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                alignSelf: 'center',
                              }}
                            >
                              {t('connectedClinics.commonPrice')}: ${(pt.price ?? 0).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="modal__footer"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1.25rem 1.75rem',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                borderBottomLeftRadius: 'var(--radius-lg)',
                borderBottomRightRadius: 'var(--radius-lg)',
                marginTop: 0,
              }}
            >
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleCloseProsthesisModal}
                disabled={savingProsthesis}
                style={{ minWidth: '100px', height: '38px', borderRadius: '8px' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSaveProsthesisTypes}
                disabled={savingProsthesis || loadingProsthesisTypes}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  minWidth: '140px',
                  height: '38px',
                  borderRadius: '8px',
                }}
              >
                {savingProsthesis ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>{t('common.loading')}</span>
                  </>
                ) : (
                  <>
                    <Check
                      size={16}
                      style={{ display: 'block', margin: 'auto' }}
                    />
                    <span>{t('common.save')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Connected Clinic Confirmation Modal */}
      {clinicToDelete && (
        <div
          className="modal-overlay"
          onClick={handleCloseDeleteModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              className="modal__header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border)',
                backgroundColor: 'rgba(239, 68, 68, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--danger)',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3
                    className="modal__title"
                    style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    {t('connectedClinics.deleteModalTitle')}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      margin: '0.2rem 0 0 0',
                      lineHeight: 1.2,
                    }}
                  >
                    {clinicToDelete.name} • {clinicToDelete.branch.name}
                  </p>
                </div>
              </div>
              <button
                className="modal__close"
                onClick={handleCloseDeleteModal}
                disabled={deletingClinic}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: '4px',
                  display: 'flex',
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div
              className="modal__body"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              {/* Alert Message Box */}
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                }}
              >
                <AlertTriangle
                  size={18}
                  style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }}
                />
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      color: 'var(--danger)',
                      marginBottom: '0.35rem',
                    }}
                  >
                    {t('connectedClinics.deleteWarningMessage', {
                      orderCount: clinicToDelete.doctors.reduce(
                        (sum, doc) => sum + doc.workOrders.length,
                        0
                      ),
                      doctorCount: clinicToDelete.doctors.length,
                      prosthesisCount: clinicToDelete.allowedProsthesisTypes?.length || 0,
                    })}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {t('connectedClinics.deleteScopeNote')}
                  </p>
                </div>
              </div>

              {/* Breakdown Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--bg-body, rgba(241, 245, 249, 0.6))',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '0.75rem',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: 'var(--danger)',
                    }}
                  >
                    {clinicToDelete.doctors.length}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginTop: '2px',
                    }}
                  >
                    {t('connectedClinics.affectedDoctors', {
                      count: clinicToDelete.doctors.length,
                    })}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-body, rgba(241, 245, 249, 0.6))',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '0.75rem',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: 'var(--danger)',
                    }}
                  >
                    {clinicToDelete.doctors.reduce(
                      (sum, doc) => sum + doc.workOrders.length,
                      0
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginTop: '2px',
                    }}
                  >
                    {t('connectedClinics.affectedOrders', {
                      count: clinicToDelete.doctors.reduce(
                        (sum, doc) => sum + doc.workOrders.length,
                        0
                      ),
                    })}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-body, rgba(241, 245, 249, 0.6))',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '0.75rem',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {clinicToDelete.allowedProsthesisTypes?.length || 0}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginTop: '2px',
                    }}
                  >
                    {t('connectedClinics.affectedProsthesis', {
                      count: clinicToDelete.allowedProsthesisTypes?.length || 0,
                    })}
                  </div>
                </div>
              </div>

              {/* Master Catalog Safe Banner */}
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '10px',
                  padding: '0.625rem 0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8125rem',
                  color: 'var(--success)',
                }}
              >
                <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                <span>{t('connectedClinics.masterCatalogSafe')}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              className="modal__footer"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border)',
                backgroundColor: 'var(--bg-surface)',
                marginTop: 0,
              }}
            >
              <button
                id="btn-cancel-delete-clinic"
                type="button"
                className="btn btn--secondary"
                onClick={handleCloseDeleteModal}
                disabled={deletingClinic}
                style={{ minWidth: '90px', height: '38px', borderRadius: '8px' }}
              >
                {t('common.cancel')}
              </button>
              <button
                id="btn-confirm-delete-clinic"
                type="button"
                className="btn btn--danger"
                onClick={handleConfirmDelete}
                disabled={deletingClinic}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  minWidth: '130px',
                  height: '38px',
                  borderRadius: '8px',
                }}
              >
                {deletingClinic ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>{t('connectedClinics.deleting')}</span>
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

      {/* Create Clinic Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={handleCloseCreateModal}
          style={{ zIndex: 1100 }}
        >
          <div
            className="modal"
            style={{ maxWidth: '520px', width: '100%', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__header">
              <div>
                <h3 className="modal__title">
                  {t('connectedClinics.createClinicModalTitle', {
                    defaultValue: 'Add New Clinic',
                  })}
                </h3>
                <p className="modal__subtitle">
                  {t('connectedClinics.createClinicSubtitle', {
                    defaultValue:
                      'Register a clinic now and connect integration later',
                  })}
                </p>
              </div>
              <button
                type="button"
                className="modal__close"
                onClick={handleCloseCreateModal}
                disabled={creatingClinic}
                aria-label={t('common.close', { defaultValue: 'Close' })}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal__body">
                {/* Clinic Name */}
                <div className="form-group">
                  <label className="form-label" htmlFor="clinic-name">
                    {t('connectedClinics.clinicName')}{' '}
                    <span style={{ color: 'var(--danger, #EF4444)' }}>*</span>
                  </label>
                  <input
                    id="clinic-name"
                    type="text"
                    className={`form-input ${createFormErrors.name ? 'form-input--error' : ''}`}
                    placeholder={t('connectedClinics.clinicNamePlaceholder', {
                      defaultValue: 'e.g. Smile Dental Clinic',
                    })}
                    value={createForm.name}
                    onChange={(e) => {
                      setCreateForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }));
                      if (createFormErrors.name)
                        setCreateFormErrors((prev) => ({
                          ...prev,
                          name: undefined,
                        }));
                    }}
                    autoFocus
                  />
                  {createFormErrors.name && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--danger, #EF4444)',
                        marginTop: '0.25rem',
                        display: 'block',
                      }}
                    >
                      {createFormErrors.name}
                    </span>
                  )}
                </div>

                {/* Clinic Website URL */}
                <div className="form-group">
                  <label className="form-label" htmlFor="clinic-url">
                    {t('connectedClinics.clinicWebsiteUrl')}{' '}
                    <span style={{ color: 'var(--danger, #EF4444)' }}>*</span>
                  </label>
                  <input
                    id="clinic-url"
                    type="text"
                    className={`form-input ${createFormErrors.url ? 'form-input--error' : ''}`}
                    placeholder={t(
                      'connectedClinics.clinicWebsiteUrlPlaceholder',
                      { defaultValue: 'e.g. https://clinic.example.com' }
                    )}
                    value={createForm.url}
                    onChange={(e) => {
                      setCreateForm((prev) => ({
                        ...prev,
                        url: e.target.value,
                      }));
                      if (createFormErrors.url)
                        setCreateFormErrors((prev) => ({
                          ...prev,
                          url: undefined,
                        }));
                    }}
                  />
                  {createFormErrors.url && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--danger, #EF4444)',
                        marginTop: '0.25rem',
                        display: 'block',
                      }}
                    >
                      {createFormErrors.url}
                    </span>
                  )}
                </div>

                {/* Address */}
                <div className="form-group">
                  <label className="form-label" htmlFor="clinic-address">
                    {t('connectedClinics.address')}
                  </label>
                  <input
                    id="clinic-address"
                    type="text"
                    className="form-input"
                    placeholder={t('connectedClinics.addressPlaceholder', {
                      defaultValue: 'e.g. 123 Main St, Suite 400',
                    })}
                    value={createForm.address || ''}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Contact Number */}
                <div className="form-group">
                  <label className="form-label" htmlFor="clinic-phone">
                    {t('connectedClinics.contactNumber')}
                  </label>
                  <PhoneInput
                    id="clinic-phone"
                    value={createForm.phone || ''}
                    onChange={(val) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        phone: val,
                      }))
                    }
                    disabled={creatingClinic}
                  />
                </div>

                {/* Branch selection if multi-branch */}
                {branches.length > 1 && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="clinic-branch">
                      {t('connectedClinics.branch')}
                    </label>
                    <select
                      id="clinic-branch"
                      className="form-input"
                      value={createForm.branchId}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          branchId: e.target.value,
                        }))
                      }
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="modal__footer">
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={handleCloseCreateModal}
                    disabled={creatingClinic}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={creatingClinic}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      minWidth: '120px',
                      justifyContent: 'center',
                      fontWeight: 600,
                    }}
                  >
                    {creatingClinic ? (
                      <>
                        <Loader2 size={16} className="spinner" />
                        <span>
                          {t('connectedClinics.saving', {
                            defaultValue: 'Saving...',
                          })}
                        </span>
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        <span>
                          {t('connectedClinics.createClinic', {
                            defaultValue: 'Create Clinic',
                          })}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Connect Clinic Integration Modal */}
      {clinicToConnect && (
        <div
          className="modal-overlay"
          onClick={handleCloseConnectModal}
          style={{ zIndex: 1100 }}
        >
          <div
            className="modal"
            style={{ maxWidth: '580px', width: '100%', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal__header">
              <div>
                <h3 className="modal__title">
                  {t('connectedClinics.connectClinicModalTitle', {
                    defaultValue: 'Connect Clinic Integration',
                  })}
                </h3>
                <p className="modal__subtitle">
                  {t('connectedClinics.connectClinicSubtitle', {
                    defaultValue:
                      'Follow these steps to connect this clinic to your laboratory',
                  })}
                </p>
              </div>
              <button
                type="button"
                className="modal__close"
                onClick={handleCloseConnectModal}
                disabled={connecting}
                aria-label={t('common.close', { defaultValue: 'Close' })}
              >
                <X size={20} />
              </button>
            </div>

            <div
              className="modal__body"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                padding: '1.25rem',
                overflowY: 'auto',
                maxHeight: 'calc(90vh - 140px)',
              }}
            >
              {/* Target Clinic Card */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  backgroundColor:
                    'var(--bg-body, rgba(234, 244, 251, 0.5))',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      fontSize: '0.925rem',
                    }}
                  >
                    {clinicToConnect.name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Globe size={12} />
                    <span>{clinicToConnect.url}</span>
                  </div>
                </div>
                <span className="badge badge--neutral">
                  {clinicToConnect.branch.name}
                </span>
              </div>

              {/* Instructions Callout */}
              <div
                style={{
                  fontSize: '0.8125rem',
                  lineHeight: '1.5',
                  color: 'var(--text-primary)',
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                }}
              >
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>
                  {t('connectedClinics.integrationInstructions', {
                    defaultValue:
                      'Provide these credentials to the clinic administrator to configure their clinic portal integration:',
                  })}
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '1.25rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <li>
                    {t('connectedClinics.step1', {
                      defaultValue:
                        '1. Copy the Branch API Key and Integration Endpoint below.',
                    })}
                  </li>
                  <li>
                    {t('connectedClinics.step2', {
                      defaultValue:
                        '2. In the clinic management software, enter this API Key and Lab URL under Integration Settings.',
                    })}
                  </li>
                  <li>
                    {t('connectedClinics.step3', {
                      defaultValue:
                        '3. Click "Connect Clinic" to activate the integration.',
                    })}
                  </li>
                </ul>
              </div>

              {/* API Key credential */}
              <div className="form-group">
                <label
                  className="form-label"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    {t('connectedClinics.apiKeyLabel', {
                      defaultValue: 'Branch API Key',
                    })}
                  </span>
                  {branchApiKey && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {clinicToConnect.branch.name}
                    </span>
                  )}
                </label>
                {loadingApiKey ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                      padding: '0.5rem 0',
                    }}
                  >
                    <Loader2 size={16} className="spinner" />
                    <span>Loading API Key...</span>
                  </div>
                ) : branchApiKey ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      readOnly
                      value={branchApiKey}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '0.8125rem',
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => handleCopyText(branchApiKey, 'key')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        flexShrink: 0,
                      }}
                    >
                      {copiedApiKey ? (
                        <Check
                          size={14}
                          style={{ color: 'var(--success, #10B981)' }}
                        />
                      ) : (
                        <Copy size={14} />
                      )}
                      <span>
                        {copiedApiKey
                          ? t('connectedClinics.copied', {
                              defaultValue: 'Copied!',
                            })
                          : t('connectedClinics.copyApiKey', {
                              defaultValue: 'Copy Key',
                            })}
                      </span>
                    </button>
                  </div>
                ) : (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    No active API key found for this branch. You can generate
                    one on the API Keys page.
                  </p>
                )}
              </div>

              {/* Integration Endpoint URL */}
              <div className="form-group">
                <label className="form-label">
                  {t('connectedClinics.labWebhookEndpoint', {
                    defaultValue: 'Lab Integration Endpoint',
                  })}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    readOnly
                    value={`${window.location.origin}/api/integration/config`}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem',
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() =>
                      handleCopyText(
                        `${window.location.origin}/api/integration/config`,
                        'endpoint'
                      )
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flexShrink: 0,
                    }}
                  >
                    {copiedEndpoint ? (
                      <Check
                        size={14}
                        style={{ color: 'var(--success, #10B981)' }}
                      />
                    ) : (
                      <Copy size={14} />
                    )}
                    <span>
                      {copiedEndpoint
                        ? t('connectedClinics.copied', {
                            defaultValue: 'Copied!',
                          })
                        : t('common.copy', { defaultValue: 'Copy' })}
                    </span>
                  </button>
                </div>
              </div>

              {/* Connection Test Result Banner */}
              {connectionTestResult && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: connectionTestResult.success
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(245, 158, 11, 0.1)',
                    color: connectionTestResult.success
                      ? 'var(--success, #10B981)'
                      : '#D97706',
                    border: `1px solid ${
                      connectionTestResult.success
                        ? 'rgba(16, 185, 129, 0.25)'
                        : 'rgba(245, 158, 11, 0.25)'
                    }`,
                  }}
                >
                  {connectionTestResult.success ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertTriangle size={16} />
                  )}
                  <span>{connectionTestResult.message}</span>
                </div>
              )}
            </div>

            <div
              className="modal__footer"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem 1.25rem',
                borderTop: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleCloseConnectModal}
                disabled={connecting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleConnectClinic}
                disabled={connecting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  minWidth: '150px',
                  justifyContent: 'center',
                  fontWeight: 600,
                }}
              >
                {connecting ? (
                  <>
                    <Loader2 size={16} className="spinner" />
                    <span>
                      {t('connectedClinics.testingConnection', {
                        defaultValue: 'Connecting...',
                      })}
                    </span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>
                      {t('connectedClinics.connectClinic', {
                        defaultValue: 'Connect Clinic',
                      })}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clinic Work Orders List Modal */}
      <ClinicWorkOrdersModal
        isOpen={!!selectedClinicForOrders}
        onClose={() => setSelectedClinicForOrders(null)}
        clinic={selectedClinicForOrders}
        onViewWorkOrderDetail={(workOrderId) => setSelectedWorkOrderIdForDetail(workOrderId)}
      />

      {/* Individual Work Order Detail Drill-down Modal */}
      <ViewWorkOrderModal
        isOpen={!!selectedWorkOrderIdForDetail}
        onClose={() => setSelectedWorkOrderIdForDetail(null)}
        workOrderId={selectedWorkOrderIdForDetail}
        onUpdate={() => {
          fetchClinics();
        }}
      />
    </div>
  );
}

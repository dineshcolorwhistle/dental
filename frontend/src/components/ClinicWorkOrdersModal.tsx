import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Search,
  ExternalLink,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Clock,
  PlayCircle,
  ShieldCheck,
  CircleDot,
  Eye,
  Loader2,
  Check,
  DollarSign,
  User,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  connectedClinicService,
  type ConnectedClinicListItem,
  type ClinicWorkOrderListItem,
} from '../services';
import { Pagination } from './Pagination';
import { formatDate } from '../utils/dateUtils';

interface ClinicWorkOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinic: ConnectedClinicListItem | null;
  onViewWorkOrderDetail?: (workOrderId: string) => void;
}

type PaymentFilter = 'ALL' | 'PENDING' | 'PAID';

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  CREATED: { label: 'Created', color: '#6B7280', bg: '#F3F4F6', icon: <CircleDot size={12} /> },
  ASSIGNED: { label: 'Assigned', color: '#3B82F6', bg: '#EFF6FF', icon: <Clock size={12} /> },
  IN_PROGRESS: { label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB', icon: <PlayCircle size={12} /> },
  INTERNAL_VERIFICATION: { label: 'Internal Verification', color: '#8B5CF6', bg: '#F5F3FF', icon: <ShieldCheck size={12} /> },
  EXTERNAL_VERIFICATION: { label: 'External Verification', color: '#6366F1', bg: '#EEF2FF', icon: <ShieldCheck size={12} /> },
  COMPLETED: { label: 'Completed', color: '#10B981', bg: '#ECFDF5', icon: <CheckCircle2 size={12} /> },
  FAILED: { label: 'Failed', color: '#EF4444', bg: '#FEF2F2', icon: <AlertCircle size={12} /> },
  CANCELLED: { label: 'Cancelled', color: '#F97316', bg: '#FFF3E0', icon: <X size={12} /> },
};

export function ClinicWorkOrdersModal({
  isOpen,
  onClose,
  clinic,
  onViewWorkOrderDetail,
}: ClinicWorkOrdersModalProps) {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<ClinicWorkOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 8;

  const formatCurrency = useCallback((val: number | null | undefined) => {
    return new Intl.NumberFormat(i18n.language?.startsWith('es') ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  }, [i18n.language]);

  const loadWorkOrders = useCallback(async () => {
    if (!clinic) return;
    try {
      setLoading(true);
      const res = await connectedClinicService.getWorkOrders(clinic.id);
      if (res && res.workOrders) {
        setOrders(res.workOrders);
      } else {
        // Fallback from clinic doctor records if endpoint returned empty
        const fallbackOrders: ClinicWorkOrderListItem[] = [];
        clinic.doctors.forEach((doc) => {
          doc.workOrders.forEach((wo) => {
            const quote = wo.totalQuote || 0;
            const collected = wo.initialPayment || 0;
            const pending = wo.status === 'CANCELLED' ? 0 : Math.max(0, quote - collected);
            fallbackOrders.push({
              id: wo.id,
              folioNumber: wo.folioNumber || `#${wo.id.slice(0, 8)}`,
              patient: wo.patient || null,
              status: wo.status,
              totalQuote: wo.totalQuote || null,
              initialPayment: wo.initialPayment || null,
              collectedAmount: collected,
              pendingAmount: pending,
              deliveryDate: wo.deliveryDate || null,
              createdAt: wo.createdAt || new Date().toISOString(),
              doctor: { id: doc.id, name: doc.name, email: doc.email },
              prosthesisType: wo.prosthesisType,
            });
          });
        });
        setOrders(fallbackOrders);
      }
    } catch {
      // Fallback to local clinic doctors orders on network error
      const fallbackOrders: ClinicWorkOrderListItem[] = [];
      clinic.doctors.forEach((doc) => {
        doc.workOrders.forEach((wo) => {
          const quote = wo.totalQuote || 0;
          const collected = wo.initialPayment || 0;
          const pending = wo.status === 'CANCELLED' ? 0 : Math.max(0, quote - collected);
          fallbackOrders.push({
            id: wo.id,
            folioNumber: wo.folioNumber || `#${wo.id.slice(0, 8)}`,
            patient: wo.patient || null,
            status: wo.status,
            totalQuote: wo.totalQuote || null,
            initialPayment: wo.initialPayment || null,
            collectedAmount: collected,
            pendingAmount: pending,
            deliveryDate: wo.deliveryDate || null,
            createdAt: wo.createdAt || new Date().toISOString(),
            doctor: { id: doc.id, name: doc.name, email: doc.email },
            prosthesisType: wo.prosthesisType,
          });
        });
      });
      setOrders(fallbackOrders);
    } finally {
      setLoading(false);
    }
  }, [clinic]);

  useEffect(() => {
    if (isOpen && clinic) {
      setSearch('');
      setPaymentFilter('ALL');
      setCurrentPage(0);
      loadWorkOrders();
    }
  }, [isOpen, clinic, loadWorkOrders]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Overall summary metrics calculated across all clinic orders
  const metrics = useMemo(() => {
    let totalQuoted = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let pendingCount = 0;
    let paidCount = 0;

    orders.forEach((o) => {
      totalQuoted += o.totalQuote || 0;
      totalCollected += o.collectedAmount || 0;
      totalPending += o.pendingAmount || 0;
      if (o.pendingAmount > 0) {
        pendingCount += 1;
      } else if ((o.totalQuote || 0) > 0) {
        paidCount += 1;
      }
    });

    return {
      totalOrders: orders.length,
      totalQuoted,
      totalCollected,
      totalPending,
      pendingCount,
      paidCount,
    };
  }, [orders]);

  // Filtered orders based on search & payment filter
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Payment status filter
      if (paymentFilter === 'PENDING' && o.pendingAmount <= 0) {
        return false;
      }
      if (paymentFilter === 'PAID') {
        const quote = o.totalQuote || 0;
        if (quote <= 0 || o.pendingAmount > 0) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const folio = o.folioNumber.toLowerCase();
        const patient = (o.patient || '').toLowerCase();
        const docName = (o.doctor.name || '').toLowerCase();
        const ptName = (o.prosthesisType?.name || '').toLowerCase();
        return (
          folio.includes(q) ||
          patient.includes(q) ||
          docName.includes(q) ||
          ptName.includes(q)
        );
      }

      return true;
    });
  }, [orders, paymentFilter, search]);

  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  if (!isOpen || !clinic) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal modal--xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1060px',
          width: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
        }}
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
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background:
                  'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.25))',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--accent-primary)',
                flexShrink: 0,
              }}
            >
              <ClipboardList size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <h3
                  className="modal__title"
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--text-primary)',
                  }}
                >
                  {clinic.name}
                </h3>
                <span className="badge badge--neutral" style={{ fontSize: '0.75rem' }}>
                  {clinic.branch.name}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginTop: '0.25rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                }}
              >
                <a
                  href={clinic.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: 'var(--accent-primary)',
                    textDecoration: 'none',
                  }}
                >
                  {clinic.url}
                  <ExternalLink size={12} />
                </a>
                <span>•</span>
                <span>
                  {t('connectedClinics.clinicWorkOrders', {
                    defaultValue: 'Clinic Work Orders',
                  })}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
            style={{ margin: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          className="modal__body"
          style={{
            padding: '1.5rem 1.75rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Top KPI Metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* Total Orders */}
            <div
              className="stat-card"
              style={{
                padding: '1rem 1.25rem',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                background: 'var(--bg-body, rgba(248, 250, 252, 0.5))',
              }}
            >
              <div className="stat-card__icon stat-card__icon--primary">
                <ClipboardList size={20} />
              </div>
              <div className="stat-card__content">
                <span className="stat-card__value" style={{ fontSize: '1.375rem' }}>
                  {metrics.totalOrders}
                </span>
                <span className="stat-card__label" style={{ fontSize: '0.75rem' }}>
                  {t('connectedClinics.totalOrders', { defaultValue: 'Total Orders' })}
                </span>
              </div>
            </div>

            {/* Total Quoted */}
            <div
              className="stat-card"
              style={{
                padding: '1rem 1.25rem',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                background: 'var(--bg-body, rgba(248, 250, 252, 0.5))',
              }}
            >
              <div
                className="stat-card__icon"
                style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
              >
                <DollarSign size={20} />
              </div>
              <div className="stat-card__content">
                <span className="stat-card__value" style={{ fontSize: '1.375rem' }}>
                  {formatCurrency(metrics.totalQuoted)}
                </span>
                <span className="stat-card__label" style={{ fontSize: '0.75rem' }}>
                  {t('connectedClinics.totalQuoted', { defaultValue: 'Total Quoted' })}
                </span>
              </div>
            </div>

            {/* Total Collected */}
            <div
              className="stat-card"
              style={{
                padding: '1rem 1.25rem',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                background: 'var(--bg-body, rgba(248, 250, 252, 0.5))',
              }}
            >
              <div className="stat-card__icon stat-card__icon--success">
                <CheckCircle2 size={20} />
              </div>
              <div className="stat-card__content">
                <span
                  className="stat-card__value"
                  style={{ fontSize: '1.375rem', color: 'var(--success, #10B981)' }}
                >
                  {formatCurrency(metrics.totalCollected)}
                </span>
                <span className="stat-card__label" style={{ fontSize: '0.75rem' }}>
                  {t('connectedClinics.totalCollected', { defaultValue: 'Total Collected' })}
                </span>
              </div>
            </div>

            {/* Total Pending */}
            <div
              className="stat-card"
              style={{
                padding: '1rem 1.25rem',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                background: 'var(--bg-body, rgba(248, 250, 252, 0.5))',
              }}
            >
              <div
                className="stat-card__icon"
                style={{
                  backgroundColor:
                    metrics.totalPending > 0
                      ? 'rgba(239, 68, 68, 0.12)'
                      : 'rgba(16, 185, 129, 0.12)',
                  color:
                    metrics.totalPending > 0
                      ? 'var(--danger, #EF4444)'
                      : 'var(--success, #10B981)',
                }}
              >
                <AlertCircle size={20} />
              </div>
              <div className="stat-card__content">
                <span
                  className="stat-card__value"
                  style={{
                    fontSize: '1.375rem',
                    color:
                      metrics.totalPending > 0
                        ? 'var(--danger, #EF4444)'
                        : 'var(--success, #10B981)',
                  }}
                >
                  {formatCurrency(metrics.totalPending)}
                </span>
                <span className="stat-card__label" style={{ fontSize: '0.75rem' }}>
                  {t('connectedClinics.totalPending', { defaultValue: 'Total Pending' })}
                </span>
              </div>
            </div>
          </div>

          {/* Toolbar: Search and Filter Pills */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            {/* Search Input */}
            <div className="search-input-wrap" style={{ flex: '1 1 280px', maxWidth: '380px' }}>
              <Search size={16} className="search-input__icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder={t('connectedClinics.searchOrdersPlaceholder', {
                  defaultValue: 'Search folio, patient, doctor...',
                })}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(0);
                }}
              />
              {search && (
                <button
                  type="button"
                  className="search-input__clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Payment Filter Pills */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-body, #F1F5F9)',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setPaymentFilter('ALL');
                  setCurrentPage(0);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor:
                    paymentFilter === 'ALL' ? 'var(--bg-surface, #FFFFFF)' : 'transparent',
                  color:
                    paymentFilter === 'ALL'
                      ? 'var(--text-heading, #0F172A)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow:
                    paymentFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('connectedClinics.allOrders', { defaultValue: 'All' })} ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentFilter('PENDING');
                  setCurrentPage(0);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor:
                    paymentFilter === 'PENDING' ? 'var(--bg-surface, #FFFFFF)' : 'transparent',
                  color:
                    paymentFilter === 'PENDING'
                      ? 'var(--danger, #EF4444)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow:
                    paymentFilter === 'PENDING' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('connectedClinics.pendingOnly', { defaultValue: 'Pending' })} ({metrics.pendingCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentFilter('PAID');
                  setCurrentPage(0);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor:
                    paymentFilter === 'PAID' ? 'var(--bg-surface, #FFFFFF)' : 'transparent',
                  color:
                    paymentFilter === 'PAID'
                      ? 'var(--success, #10B981)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow:
                    paymentFilter === 'PAID' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {t('connectedClinics.paidInFull', { defaultValue: 'Paid' })} ({metrics.paidCount})
              </button>
            </div>
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '3rem 0',
                gap: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              <Loader2 size={24} className="spinner" />
              <span>{t('common.loading', { defaultValue: 'Loading work orders...' })}</span>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredOrders.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '3.5rem 1rem',
                background: 'var(--bg-surface)',
                borderRadius: '12px',
                border: '1px dashed var(--border)',
              }}
            >
              <ClipboardList
                size={40}
                style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem' }}
              />
              <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
                {t('connectedClinics.noWorkOrders', {
                  defaultValue: 'No work orders found for this clinic.',
                })}
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                }}
              >
                {orders.length > 0
                  ? t('common.noResults', {
                      defaultValue: 'No orders matched your search or filter criteria.',
                    })
                  : t('connectedClinics.noOrdersRegistered', {
                      defaultValue: 'This clinic currently has no associated work orders.',
                    })}
              </p>
            </div>
          )}

          {/* Work Orders Table */}
          {!loading && filteredOrders.length > 0 && (
            <div
              className="data-table-wrap"
              style={{
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
              }}
            >
              <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    <th>{t('workOrders.folio', { defaultValue: 'Folio' })}</th>
                    <th>{t('workOrders.doctor', { defaultValue: 'Doctor' })}</th>
                    <th>{t('workOrders.patient', { defaultValue: 'Patient' })}</th>
                    <th>{t('workOrders.prosthesisType', { defaultValue: 'Prosthesis' })}</th>
                    <th>{t('common.status', { defaultValue: 'Status' })}</th>
                    <th>{t('workOrders.totalQuote', { defaultValue: 'Total Quote' })}</th>
                    <th>{t('connectedClinics.collectedAmount', { defaultValue: 'Collected Amount' })}</th>
                    <th>{t('connectedClinics.pendingAmount', { defaultValue: 'Pending Amount' })}</th>
                    <th>{t('common.created', { defaultValue: 'Created' })}</th>
                    <th style={{ textAlign: 'right' }}>{t('common.actions', { defaultValue: 'Actions' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((wo) => {
                    const sc = STATUS_CONFIG[wo.status] || STATUS_CONFIG.CREATED;
                    const isFullyPaid = (wo.totalQuote || 0) > 0 && wo.pendingAmount === 0;
                    const hasPending = wo.pendingAmount > 0;

                    return (
                      <tr key={wo.id}>
                        {/* Folio */}
                        <td>
                          <button
                            type="button"
                            onClick={() => onViewWorkOrderDetail?.(wo.id)}
                            style={{
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              color: 'var(--accent-primary)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontSize: '0.8125rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title={t('workOrders.viewWorkOrder', { defaultValue: 'View Work Order' })}
                          >
                            {wo.folioNumber}
                          </button>
                        </td>

                        {/* Doctor */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={13} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {wo.doctor.name}
                            </span>
                          </div>
                        </td>

                        {/* Patient */}
                        <td>
                          <span style={{ color: wo.patient ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {wo.patient || '—'}
                          </span>
                        </td>

                        {/* Prosthesis Type */}
                        <td>
                          {wo.prosthesisType ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: 'var(--text-secondary)',
                                fontSize: '0.775rem',
                              }}
                            >
                              <Layers size={12} style={{ color: 'var(--accent-primary)' }} />
                              {wo.prosthesisType.name}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <span
                            className="badge"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: sc.color,
                              backgroundColor: sc.bg,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {sc.icon}
                            {t(`status.${wo.status.toLowerCase()}`, { defaultValue: sc.label })}
                          </span>
                        </td>

                        {/* Total Quote */}
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {formatCurrency(wo.totalQuote)}
                          </span>
                        </td>

                        {/* Collected Amount */}
                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color:
                                wo.collectedAmount > 0
                                  ? 'var(--success, #10B981)'
                                  : 'var(--text-muted)',
                            }}
                          >
                            {formatCurrency(wo.collectedAmount)}
                          </span>
                        </td>

                        {/* Pending Amount */}
                        <td>
                          {hasPending ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: 'var(--danger, #EF4444)',
                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatCurrency(wo.pendingAmount)}
                            </span>
                          ) : isFullyPaid ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: 'var(--success, #10B981)',
                                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <Check size={12} strokeWidth={2.5} />
                              {t('financePage.paidInFull', { defaultValue: 'Paid' })}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              {formatCurrency(0)}
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: 'var(--text-muted)',
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Calendar size={12} />
                            {formatDate(wo.createdAt, i18n.language)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn-action"
                            onClick={() => onViewWorkOrderDetail?.(wo.id)}
                            style={{
                              color: 'var(--accent-primary, #3B82F6)',
                              backgroundColor: 'rgba(59, 130, 246, 0.08)',
                              padding: '4px 8px',
                            }}
                            title={t('workOrders.viewWorkOrder', {
                              defaultValue: 'View Work Order Details',
                            })}
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredOrders.length > PAGE_SIZE && (
            <div style={{ marginTop: '0.5rem' }}>
              <Pagination
                currentPage={currentPage}
                totalItems={filteredOrders.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal__footer"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.75rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {t('connectedClinics.showingCountOrders', {
              count: filteredOrders.length,
              total: orders.length,
              defaultValue: `Showing ${filteredOrders.length} of ${orders.length} orders`,
            })}
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={onClose}
          >
            {t('common.close', { defaultValue: 'Close' })}
          </button>
        </div>
      </div>
    </div>
  );
}

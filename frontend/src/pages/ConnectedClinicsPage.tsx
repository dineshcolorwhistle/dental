import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Building2,
  Loader2,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  ClipboardList,
  Calendar,
  X,
  Activity,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { connectedClinicService, type ConnectedClinicListItem } from '../services';
import { Pagination } from '../components';

export function ConnectedClinicsPage() {
  const { t, i18n } = useTranslation();
  const [clinics, setClinics] = useState<ConnectedClinicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClinicId, setExpandedClinicId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

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

  // Reset pagination when search query changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery]);

  const toggleExpandClinic = (id: string) => {
    setExpandedClinicId(prev => (prev === id ? null : id));
  };

  const filteredClinics = clinics.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.branch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const paginatedClinics = filteredClinics.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  const getOrderStats = (workOrders: Array<{ status: string }>) => {
    const total = workOrders.length;
    const active = workOrders.filter(
      wo => wo.status !== 'COMPLETED' && wo.status !== 'FAILED' && wo.status !== 'CANCELLED'
    ).length;
    return { total, active };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );
  };

  // Compute stats for all clinics
  const stats = clinics.reduce(
    (acc, c) => {
      c.doctors.forEach(doc => {
        acc.totalDoctors += 1;
        doc.workOrders.forEach(wo => {
          acc.totalOrders += 1;
          const isActive = wo.status !== 'COMPLETED' && wo.status !== 'FAILED' && wo.status !== 'CANCELLED';
          if (isActive) {
            acc.activeOrders += 1;
          }
        });
      });
      return acc;
    },
    { totalClinics: clinics.length, totalDoctors: 0, totalOrders: 0, activeOrders: 0 }
  );

  return (
    <div className="connected-clinics-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('connectedClinics.title')}</h1>
          <p className="page-header__subtitle">{t('connectedClinics.subtitle')}</p>
        </div>
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

          {/* Total Doctors */}
          <div className="stat-card">
            <div className="stat-card__icon" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
              <User size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.totalDoctors}</span>
              <span className="stat-card__label">{t('connectedClinics.totalDoctors')}</span>
            </div>
          </div>

          {/* Total Orders */}
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--success">
              <ClipboardList size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.totalOrders}</span>
              <span className="stat-card__label">{t('connectedClinics.totalOrders')}</span>
            </div>
          </div>

          {/* Active Orders */}
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--warning">
              <Activity size={24} />
            </div>
            <div className="stat-card__content">
              <span className="stat-card__value">{stats.activeOrders}</span>
              <span className="stat-card__label">{t('connectedClinics.activeOrders')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      {!loading && clinics.length > 0 && (
        <div className="table-toolbar">
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
              <button className="search-input__clear" onClick={() => setSearchQuery('')}>
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
          <h3 className="empty-state__title">{t('connectedClinics.title')}</h3>
          <p className="empty-state__text">
            {clinics.length === 0 ? t('connectedClinics.noClinics') : t('common.noResults')}
          </p>
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
                  <th>{t('connectedClinics.clinicUrl')}</th>
                  <th>{t('connectedClinics.branch')}</th>
                  <th>{t('connectedClinics.registeredAt')}</th>
                  <th>{t('connectedClinics.doctorsCount')}</th>
                  <th>{t('connectedClinics.totalOrders')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClinics.map((clinic) => {
                  const isExpanded = expandedClinicId === clinic.id;
                  const totalClinicOrders = clinic.doctors.reduce((sum, doc) => sum + doc.workOrders.length, 0);

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
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            <Building2 size={16} style={{ color: 'var(--accent-primary)' }} />
                            {clinic.name}
                          </div>
                        </td>
                        <td>
                          <a
                            href={clinic.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-primary)', fontSize: '0.8125rem' }}
                          >
                            {clinic.url}
                            <ExternalLink size={12} />
                          </a>
                        </td>
                        <td>
                          <span className="badge badge--neutral">
                            {clinic.branch.name}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            <Calendar size={14} />
                            {formatDate(clinic.createdAt)}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge--primary" style={{ minWidth: '24px', textAlign: 'center' }}>
                            {clinic.doctors.length}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge--success" style={{ minWidth: '24px', textAlign: 'center' }}>
                            {totalClinicOrders}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ background: 'rgba(111, 174, 217, 0.02)', padding: '1.25rem 1.5rem' }}>
                            <div className="dashboard-card" style={{ padding: '1.25rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.925rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <Building2 size={16} style={{ color: 'var(--accent-primary)' }} />
                                  {clinic.name} - {t('connectedClinics.details')}
                                </h4>
                              </div>

                              {clinic.doctors.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem 0' }}>
                                  {t('connectedClinics.noDoctors')}
                                </p>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                  {clinic.doctors.map((doctor) => {
                                    const stats = getOrderStats(doctor.workOrders);
                                    return (
                                      <div key={doctor.id} style={{
                                        background: 'var(--bg-body, rgba(234, 244, 251, 0.5))',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem'
                                      }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                          <User size={14} style={{ color: 'var(--text-secondary)' }} />
                                          {doctor.name}
                                        </div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'none' }}>
                                            <Mail size={12} />
                                            {doctor.email || 'N/A'}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Phone size={12} />
                                            {doctor.phone || 'N/A'}
                                          </div>
                                        </div>
                                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <ClipboardList size={14} style={{ color: 'var(--accent-primary)' }} />
                                            <span>{t('connectedClinics.totalOrders')}:</span>
                                            <strong style={{ color: 'var(--text-primary)' }}>{stats.total}</strong>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></span>
                                            <span>{t('connectedClinics.activeOrders')}:</span>
                                            <strong style={{ color: 'var(--success)' }}>{stats.active}</strong>
                                          </div>
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
    </div>
  );
}

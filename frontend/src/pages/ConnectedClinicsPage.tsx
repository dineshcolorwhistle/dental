import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { connectedClinicService, type ConnectedClinicListItem } from '../services';

export function ConnectedClinicsPage() {
  const { t, i18n } = useTranslation();
  const [clinics, setClinics] = useState<ConnectedClinicListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClinicId, setExpandedClinicId] = useState<string | null>(null);

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

  const toggleExpandClinic = (id: string) => {
    setExpandedClinicId(prev => (prev === id ? null : id));
  };

  const filteredClinics = clinics.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.branch.name.toLowerCase().includes(searchQuery.toLowerCase())
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

  return (
    <div className="connected-clinics-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title">{t('connectedClinics.title')}</h1>
          <p className="page-header__subtitle">{t('connectedClinics.subtitle')}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="table-actions" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="search-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: '1', minWidth: '250px' }}>
          <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }} />
          <input
            type="text"
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.875rem' }}
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <Loader2 size={32} className="spinner" style={{ color: 'var(--accent-primary)' }} />
        </div>
      )}

      {/* No Connected Clinics State */}
      {!loading && filteredClinics.length === 0 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '3rem 2rem',
          textAlign: 'center',
        }}>
          <Building2 size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>{t('connectedClinics.title')}</h3>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem', fontSize: '0.875rem' }}>
            {t('connectedClinics.noClinics')}
          </p>
        </div>
      )}

      {/* Clinics Table */}
      {!loading && filteredClinics.length > 0 && (
        <div className="table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
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
              {filteredClinics.map((clinic) => {
                const isExpanded = expandedClinicId === clinic.id;
                const totalClinicOrders = clinic.doctors.reduce((sum, doc) => sum + doc.workOrders.length, 0);

                return (
                  <tr key={clinic.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Expanded Detail Panel */}
      {!loading && expandedClinicId && (
        (() => {
          const selectedClinic = clinics.find(c => c.id === expandedClinicId);
          if (!selectedClinic) return null;

          return (
            <div style={{
              marginTop: '1.5rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={18} style={{ color: 'var(--accent-primary)' }} />
                  {selectedClinic.name} - {t('connectedClinics.details')}
                </h3>
                <button
                  className="btn btn--neutral btn--sm"
                  onClick={() => setExpandedClinicId(null)}
                >
                  {t('common.close')}
                </button>
              </div>

              {selectedClinic.doctors.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem 0' }}>
                  {t('connectedClinics.noDoctors')}
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {selectedClinic.doctors.map((doctor) => {
                    const stats = getOrderStats(doctor.workOrders);
                    return (
                      <div key={doctor.id} style={{
                        background: 'var(--bg-body)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={16} style={{ color: 'var(--text-secondary)' }} />
                          {doctor.name}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          );
        })()
      )}
    </div>
  );
}

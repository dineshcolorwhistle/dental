import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context';
import { tenantService, type TenantListItem } from '../services';
import { Building2, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export function SuperAdminDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tenantService.getAll();
      setTenants(data);
    } catch (err) {
      toast.error(t('tenants.failedLoad', { defaultValue: 'Failed to load tenants' }));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greetingMorning', { defaultValue: 'Good morning' });
    if (hour < 17) return t('dashboard.greetingAfternoon', { defaultValue: 'Good afternoon' });
    return t('dashboard.greetingEvening', { defaultValue: 'Good evening' });
  };

  if (loading) {
    return (
      <div className="table-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader2 size={36} className="spinner" />
        <span style={{ marginLeft: '12px' }}>{t('dashboard.loadingAnalytics', { defaultValue: 'Loading analytics...' })}</span>
      </div>
    );
  }

  const activeTenantsCount = tenants.filter((t) => t.status === 'ACTIVE').length;

  return (
    <div className="dashboard-page animate-fade-in" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Greeting */}
      <div className="dashboard-page__header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="dashboard-page__title" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-heading)' }}>
            {getGreeting()}, {user?.firstName || 'Super Admin'}!
          </h1>
          <p className="dashboard-page__subtitle" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {t('superAdminDashboard.subtitle', { defaultValue: 'Global system administration console' })}
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 10px',
          borderRadius: '6px',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#10B981'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#10B981',
            display: 'inline-block'
          }} />
          <span>{t('dashboard.realTimeMonitoring', { defaultValue: 'System Active' })}</span>
        </div>
      </div>

      {/* KPI Widgets Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {/* Card: Total Tenants */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            backgroundColor: 'rgba(111, 174, 217, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
          }}>
            <Building2 size={28} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('superAdminDashboard.totalTenants', { defaultValue: 'Total Tenants' })}
            </span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
              {tenants.length}
            </h3>
          </div>
        </div>

        {/* Card: Active Tenants */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--success)',
          }}>
            <Building2 size={28} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('superAdminDashboard.activeTenants', { defaultValue: 'Active Tenants' })}
            </span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
              {activeTenantsCount}
            </h3>
          </div>
        </div>

        {/* Card: System Status */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--info)',
          }}>
            <ShieldCheck size={28} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('superAdminDashboard.systemStatus', { defaultValue: 'System Status' })}
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)', margin: '4px 0 0 0' }}>
              {t('superAdminDashboard.systemStatusActive', { defaultValue: 'Operational' })}
            </h3>
          </div>
        </div>
      </div>

      {/* Quick Action Section */}
      <div className="dashboard-card" style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: 'var(--shadow-md)',
      }}>
        <h3 className="dashboard-card__title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '0.5rem' }}>
          {t('superAdminDashboard.title', { defaultValue: 'Super Admin Dashboard' })}
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          {t('superAdminDashboard.welcome', { defaultValue: 'Welcome back, Super Admin! Select an action to view and manage laboratory tenants on the platform.' })}
        </p>
        <Link
          to="/tenants"
          className="btn btn--primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '8px' }}
        >
          <span>{t('superAdminDashboard.manageTenants', { defaultValue: 'Manage Tenants' })}</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

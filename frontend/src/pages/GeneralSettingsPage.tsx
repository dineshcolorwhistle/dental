import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  Globe,
  Upload,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Lock,
  Clock,
  Coins,
  Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantService } from '../services';
import { SearchableSelect } from '../components';

const TIMEZONE_OPTIONS = [
  { value: 'America/Mexico_City', label: 'Mexico City, Guadalajara, Monterrey, Puebla (UTC-6) - Central' },
  { value: 'America/Cancun', label: 'Cancún, Chetumal, Quintana Roo (UTC-5) - Southeast' },
  { value: 'America/Tijuana', label: 'Tijuana, Mexicali, Ensenada (UTC-8) - Pacific' },
  { value: 'America/Hermosillo', label: 'Hermosillo, Sonora (UTC-7) - Sonora' },
  { value: 'America/Chihuahua', label: 'Chihuahua, Ciudad Juárez (UTC-6) - Mountain' },
  { value: 'America/Mazatlan', label: 'Mazatlán, Culiacán, Sinaloa (UTC-7)' },
  { value: 'America/Merida', label: 'Mérida, Yucatán (UTC-6)' },
  { value: 'America/Monterrey', label: 'Monterrey, Nuevo León (UTC-6)' },
  { value: 'America/Bogota', label: 'Bogotá, Medellín, Cali - Colombia (UTC-5)' },
  { value: 'America/Lima', label: 'Lima, Arequipa - Peru (UTC-5)' },
  { value: 'America/Santiago', label: 'Santiago, Valparaíso - Chile (UTC-3/-4)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires, Córdoba - Argentina (UTC-3)' },
  { value: 'America/Guatemala', label: 'Guatemala City - Guatemala (UTC-6)' },
  { value: 'America/Costa_Rica', label: 'San José - Costa Rica (UTC-6)' },
  { value: 'America/Panama', label: 'Panama City - Panama (UTC-5)' },
  { value: 'America/New_York', label: 'New York, Boston, Miami (UTC-5/-4) - US Eastern' },
  { value: 'America/Chicago', label: 'Chicago, Dallas, Houston (UTC-6/-5) - US Central' },
  { value: 'America/Denver', label: 'Denver, Salt Lake City (UTC-7/-6) - US Mountain' },
  { value: 'America/Phoenix', label: 'Phoenix, Arizona (UTC-7)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles, San Francisco, Seattle (UTC-8/-7) - US Pacific' },
  { value: 'Europe/Madrid', label: 'Madrid, Barcelona - Spain (UTC+1/+2) - CET' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

const CURRENCY_OPTIONS = [
  { value: 'MXN', label: 'MXN ($) - Peso Mexicano' },
  { value: 'USD', label: 'USD ($) - US Dollar' },
  { value: 'EUR', label: 'EUR (€) - Euro' },
  { value: 'COP', label: 'COP ($) - Peso Colombiano' },
  { value: 'PEN', label: 'PEN (S/) - Sol Peruano' },
];

export function GeneralSettingsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [labName, setLabName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('America/Mexico_City');
  const [currency, setCurrency] = useState('MXN');

  useEffect(() => {
    const fetchTenantProfile = async () => {
      try {
        setLoading(true);
        const data = await tenantService.getMyProfile();
        setLabName(data.name);
        setSubdomain(data.subdomain);
        setLogoUrl(data.logoUrl);
        if (data.settings?.timezone) {
          setTimezone(data.settings.timezone);
        }
        if (data.settings?.currency) {
          setCurrency(data.settings.currency);
        }
      } catch (err) {
        toast.error(t('failedLoadReference', { defaultValue: 'Failed to load organization settings' }));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantProfile();
  }, [t]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('validation.maxLength', { count: 2, defaultValue: 'File size must be less than 2MB' }));
      return;
    }

    // Validate format
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast.error(t('validation.fieldRequired', { defaultValue: 'Supported formats: JPG, PNG, WEBP, SVG' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Url = reader.result as string;
      try {
        setUploading(true);
        await tenantService.updateMyProfile({ logoUrl: base64Url });
        setLogoUrl(base64Url);
        toast.success(t('generalSettings.saveSuccess'));
        
        // Dispatch logo update event to update sidebar
        window.dispatchEvent(new CustomEvent('tenantLogoUpdated', { detail: base64Url }));
        
        // Sync logo in local storage session
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          parsed.tenantLogoUrl = base64Url;
          localStorage.setItem('user', JSON.stringify(parsed));
        }
      } catch (err: any) {
        toast.error(t('generalSettings.saveFailed'));
        console.error(err);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    try {
      setUploading(true);
      await tenantService.updateMyProfile({ logoUrl: '' });
      setLogoUrl(null);
      toast.success(t('generalSettings.saveSuccess'));
      
      // Dispatch logo update event to update sidebar
      window.dispatchEvent(new CustomEvent('tenantLogoUpdated', { detail: null }));
      
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        parsed.tenantLogoUrl = null;
        localStorage.setItem('user', JSON.stringify(parsed));
      }
    } catch (err: any) {
      toast.error(t('generalSettings.saveFailed'));
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      await tenantService.updateMyProfile({ timezone, currency });
      toast.success(t('generalSettings.settingsSaved', { defaultValue: 'Settings updated successfully' }));

      // Sync updated timezone and currency in local storage session
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        parsed.timezone = timezone;
        parsed.currency = currency;
        localStorage.setItem('user', JSON.stringify(parsed));
      }
    } catch (err: any) {
      toast.error(t('generalSettings.saveFailed', { defaultValue: 'Failed to update settings' }));
      console.error(err);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem' }}>
        <Loader2 size={36} className="spinner" style={{ color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
          {t('generalSettings.title')}
        </h1>
        <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {t('generalSettings.subtitle')}
        </p>
      </div>

      <div className="card" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '2rem', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Logo Upload Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>{t('generalSettings.labLogo')}</label>
            
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: 'var(--radius-md)',
                border: '2px dashed var(--border)',
                backgroundColor: 'rgba(111, 174, 217, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
              }}>
                {uploading ? (
                  <Loader2 size={24} className="spinner" style={{ color: 'var(--accent-primary)' }} />
                ) : logoUrl ? (
                  <img src={logoUrl} alt="Laboratory Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <ImageIcon size={32} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {t('generalSettings.logoHint')}
                </p>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <label className="btn btn--primary" style={{ cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}>
                    <Upload size={14} />
                    <span>{t('generalSettings.uploadLogo')}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      style={{ display: 'none' }}
                      onChange={handleLogoChange}
                      disabled={uploading}
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      className="btn btn--danger btn--ghost"
                      style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                      onClick={handleRemoveLogo}
                      disabled={uploading}
                    >
                      <Trash2 size={14} />
                      <span>{t('generalSettings.removeLogo')}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />

          {/* Timezone & Currency Configuration Form */}
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Timezone */}
            <div className="form-group">
              <label className="form-label" htmlFor="settings-timezone" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <Clock size={14} style={{ color: 'var(--accent-primary)' }} />
                {t('generalSettings.timezone')}
              </label>
              <SearchableSelect
                id="settings-timezone"
                options={TIMEZONE_OPTIONS}
                value={timezone}
                onChange={(val) => setTimezone(val)}
                placeholder={t('generalSettings.selectTimezone', { defaultValue: 'Search or select timezone...' })}
              />
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t('generalSettings.timezoneHint')}
              </p>
            </div>

            {/* Currency */}
            <div className="form-group">
              <label className="form-label" htmlFor="settings-currency" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <Coins size={14} style={{ color: 'var(--accent-primary)' }} />
                {t('generalSettings.currency')}
              </label>
              <SearchableSelect
                id="settings-currency"
                options={CURRENCY_OPTIONS}
                value={currency}
                onChange={(val) => setCurrency(val)}
                placeholder={t('generalSettings.selectCurrency', { defaultValue: 'Select currency...' })}
              />
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t('generalSettings.currencyHint')}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={savingSettings}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {savingSettings ? <Loader2 size={15} className="spinner" /> : <Save size={15} />}
                <span>{t('generalSettings.saveSettings')}</span>
              </button>
            </div>
          </form>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />

          {/* Lab Name (Read-Only) */}
          <div className="form-group">
            <label className="form-label" htmlFor="settings-lab-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={14} />
              {t('generalSettings.labName')}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="settings-lab-name"
                type="text"
                className="form-input"
                style={{ paddingRight: '2.5rem', backgroundColor: 'var(--bg-overlay)', cursor: 'not-allowed', color: 'var(--text-secondary)' }}
                value={labName}
                readOnly
                disabled
              />
              <Lock size={14} style={{ position: 'absolute', right: '12px', color: 'var(--text-muted)', opacity: 0.7 }} />
            </div>
          </div>

          {/* Subdomain (Read-Only) */}
          <div className="form-group">
            <label className="form-label" htmlFor="settings-subdomain" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={14} />
              {t('generalSettings.subdomain')}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="settings-subdomain"
                type="text"
                className="form-input"
                style={{ paddingRight: '2.5rem', backgroundColor: 'var(--bg-overlay)', cursor: 'not-allowed', color: 'var(--text-secondary)' }}
                value={`${subdomain}.dentallab.com`}
                readOnly
                disabled
              />
              <Lock size={14} style={{ position: 'absolute', right: '12px', color: 'var(--text-muted)', opacity: 0.7 }} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

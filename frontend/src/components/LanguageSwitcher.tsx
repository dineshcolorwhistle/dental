import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context';
import { authService } from '../services';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const switchLanguage = async (lang: string) => {
    i18n.changeLanguage(lang);
    setOpen(false);

    // Persist to backend if user is authenticated
    if (user) {
      try {
        const backendLang = lang.startsWith('es') ? 'ES' : 'EN';
        await authService.updateLanguage(backendLang);
      } catch (err) {
        console.error('Failed to persist language preference:', err);
      }
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="topbar__menu-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}
        onClick={() => setOpen(!open)}
        aria-label={t('languageSwitcher.language')}
        title={t('languageSwitcher.language')}
      >
        <Globe size={18} />
        <span>{currentLang.toUpperCase()}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            zIndex: 200,
            minWidth: '140px',
          }}
        >
          <button
            onClick={() => switchLanguage('en')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 14px',
              border: 'none',
              backgroundColor: currentLang === 'en' ? 'var(--accent-primary-glow, rgba(111, 174, 217, 0.1))' : 'transparent',
              color: currentLang === 'en' ? 'var(--accent-primary)' : 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: currentLang === 'en' ? 700 : 500,
              textAlign: 'left',
              transition: 'background-color 0.15s',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>🇺🇸</span>
            <span>{t('languageSwitcher.english')}</span>
          </button>
          <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />
          <button
            onClick={() => switchLanguage('es')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 14px',
              border: 'none',
              backgroundColor: currentLang === 'es' ? 'var(--accent-primary-glow, rgba(111, 174, 217, 0.1))' : 'transparent',
              color: currentLang === 'es' ? 'var(--accent-primary)' : 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: currentLang === 'es' ? 700 : 500,
              textAlign: 'left',
              transition: 'background-color 0.15s',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>🇲🇽</span>
            <span>{t('languageSwitcher.spanish')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

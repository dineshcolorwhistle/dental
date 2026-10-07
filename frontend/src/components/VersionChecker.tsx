import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Injected by Vite define at build time, or 'dev' during local development
const CURRENT_VERSION = typeof __APP_BUILD_VERSION__ !== 'undefined' ? __APP_BUILD_VERSION__ : 'dev';

interface VersionResponse {
  version: string;
  buildTime?: string;
}

export function VersionChecker() {
  const { t } = useTranslation();
  const location = useLocation();
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const checkTimeoutRef = useRef<number | null>(null);

  const isAuthPage = ['/login', '/forgot-password', '/reset-password'].includes(location.pathname);

  const checkForUpdate = useCallback(async () => {
    // Skip checking in local dev mode
    if (import.meta.env.DEV || CURRENT_VERSION === 'dev') return;

    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) return;

      const data: VersionResponse = await response.json();
      if (data && data.version && data.version !== CURRENT_VERSION) {
        // If user is on login/auth page, automatically reload immediately
        if (isAuthPage) {
          window.location.reload();
          return;
        }

        setHasUpdate(true);
      }
    } catch {
      // Ignore network errors during background check
    }
  }, [isAuthPage]);

  // Periodic check and listener for focus/visibility changes
  useEffect(() => {
    if (import.meta.env.DEV) return;

    // Check after 5 seconds on initial load
    checkTimeoutRef.current = window.setTimeout(checkForUpdate, 5000);

    // Periodic check every 3 minutes
    const intervalId = window.setInterval(checkForUpdate, 3 * 60 * 1000);

    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    return () => {
      if (checkTimeoutRef.current) window.clearTimeout(checkTimeoutRef.current);
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [checkForUpdate]);

  const handleReload = () => {
    setIsReloading(true);
    window.location.reload();
  };

  if (!hasUpdate || dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 18px',
        backgroundColor: 'var(--bg-surface, #ffffff)',
        color: 'var(--text-primary, #111827)',
        borderRadius: '12px',
        border: '1px solid var(--accent-primary, #3b82f6)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        animation: 'fadeInUp 0.3s ease-out forwards',
        maxWidth: '420px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          color: 'var(--accent-primary, #3b82f6)',
          flexShrink: 0,
        }}
      >
        <Sparkles size={18} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: '1.2' }}>
          {t('common.updateAvailableTitle', { defaultValue: 'Update Available' })}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)', marginTop: '2px' }}>
          {t('common.updateAvailableDesc', { defaultValue: 'A new version of DentalLab is ready.' })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleReload}
          disabled={isReloading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: 'var(--accent-primary, #3b82f6)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={isReloading ? 'spinner' : ''} />
          <span>{t('common.refresh', { defaultValue: 'Refresh' })}</span>
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #9ca3af)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

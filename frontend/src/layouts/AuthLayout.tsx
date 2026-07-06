import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { getSubdomain } from '../utils/subdomain';
import { authService } from '../services';

export function AuthLayout() {
  const { t } = useTranslation();
  const [tenantName, setTenantName] = useState<string | null>(null);

  useEffect(() => {
    const subdomain = getSubdomain();
    if (subdomain) {
      authService.getTenantInfo(subdomain)
        .then((data) => {
          if (data && data.name) {
            setTenantName(data.name);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch tenant info:', err);
        });
    }
  }, []);

  return (
    <div className="auth-layout">
      {/* Language Switcher in Top Right */}
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <div className="auth-layout__background">
        <div className="auth-layout__gradient-orb auth-layout__gradient-orb--1" />
        <div className="auth-layout__gradient-orb auth-layout__gradient-orb--2" />
        <div className="auth-layout__gradient-orb auth-layout__gradient-orb--3" />
      </div>

      <div className="auth-layout__container">
        <div className="auth-layout__brand">
          <div className="auth-layout__logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M24 4C18 4 14 8 12 14C10 20 10 28 14 34C17 38 20 42 24 44C28 42 31 38 34 34C38 28 38 20 36 14C34 8 30 4 24 4Z" fill="url(#tooth-gradient)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
              <defs>
                <linearGradient id="tooth-gradient" x1="12" y1="4" x2="36" y2="44">
                  <stop stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          {tenantName ? (
            <h1 className="auth-layout__title">{tenantName}</h1>
          ) : (
            <>
              <h1 className="auth-layout__title">{t('auth.dentalLab')}</h1>
              <p className="auth-layout__subtitle">{t('auth.managementSystem')}</p>
            </>
          )}
        </div>

        <div className="auth-layout__card">
          <Outlet />
        </div>

        <p className="auth-layout__footer">
          {t('auth.copyright', { year: new Date().getFullYear() })}
        </p>
      </div>
    </div>
  );
}


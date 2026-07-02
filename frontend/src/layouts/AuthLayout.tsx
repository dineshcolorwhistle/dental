import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="auth-layout">
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
          <h1 className="auth-layout__title">{t('auth.dentalLab')}</h1>
          <p className="auth-layout__subtitle">{t('auth.managementSystem')}</p>
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

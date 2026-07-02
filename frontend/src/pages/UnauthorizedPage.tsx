import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="error-page">
      <div className="error-page__content">
        <div className="error-page__icon">
          <ShieldX size={64} />
        </div>
        <h1 className="error-page__code">403</h1>
        <h2 className="error-page__title">{t('errors.accessDenied')}</h2>
        <p className="error-page__message">
          {t('errors.accessDeniedMessage')}
        </p>
        <button
          className="btn btn--primary"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={18} />
          <span>{t('common.backToDashboard')}</span>
        </button>
      </div>
    </div>
  );
}

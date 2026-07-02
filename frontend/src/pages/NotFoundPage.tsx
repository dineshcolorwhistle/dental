import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="error-page">
      <div className="error-page__content">
        <div className="error-page__icon">
          <FileQuestion size={64} />
        </div>
        <h1 className="error-page__code">404</h1>
        <h2 className="error-page__title">{t('errors.pageNotFound')}</h2>
        <p className="error-page__message">
          {t('errors.pageNotFoundMessage')}
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

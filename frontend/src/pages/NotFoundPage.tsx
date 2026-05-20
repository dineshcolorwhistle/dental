import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="error-page">
      <div className="error-page__content">
        <div className="error-page__icon">
          <FileQuestion size={64} />
        </div>
        <h1 className="error-page__code">404</h1>
        <h2 className="error-page__title">Page Not Found</h2>
        <p className="error-page__message">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          className="btn btn--primary"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={18} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );
}

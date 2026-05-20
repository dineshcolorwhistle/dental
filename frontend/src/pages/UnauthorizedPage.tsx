import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';

export function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="error-page">
      <div className="error-page__content">
        <div className="error-page__icon">
          <ShieldX size={64} />
        </div>
        <h1 className="error-page__code">403</h1>
        <h2 className="error-page__title">Access Denied</h2>
        <p className="error-page__message">
          You don't have permission to access this page. Please contact your
          administrator if you believe this is a mistake.
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

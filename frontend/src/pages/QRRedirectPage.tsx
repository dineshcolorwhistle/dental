import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { workOrderService } from '../services';

export function QRRedirectPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid QR code token.');
      return;
    }

    let isMounted = true;

    workOrderService.getByQrToken(token)
      .then((workOrder) => {
        if (!isMounted) return;
        navigate(`/work-orders/${workOrder.id}`, { replace: true });
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to validate QR token', err);
        const errMsg = err?.response?.data?.message || 'Failed to validate QR token. Please ensure you have permission to access this work order.';
        setError(errMsg);
      });

    return () => {
      isMounted = false;
    };
  }, [token, navigate]);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--danger-bg, rgba(239, 68, 68, 0.08))',
            color: 'var(--danger, #EF4444)',
            padding: '1.25rem',
            borderRadius: '50%',
            marginBottom: '1.5rem',
            border: '1px solid rgba(239, 68, 68, 0.15)',
          }}
        >
          <AlertTriangle size={36} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)', marginBottom: '0.75rem' }}>
          Verification Failed
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', fontSize: '0.9375rem', lineHeight: '1.6', marginBottom: '1.75rem' }}>
          {error}
        </p>
        <button
          className="btn btn--outline"
          onClick={() => navigate('/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1rem',
      }}
    >
      <Loader2 size={44} className="spinner" style={{ color: 'var(--accent-primary, #6FAED9)' }} />
      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-heading)' }}>
        Validating QR Code
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        Verifying authorization and loading work order details...
      </p>
    </div>
  );
}

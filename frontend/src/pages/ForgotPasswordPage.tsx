import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authService } from '../services';
import { getSubdomain } from '../utils/subdomain';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error(t('validation.emailRequired'));
      return;
    }

    try {
      setIsSubmitting(true);
      const subdomain = getSubdomain();
      await authService.forgotPassword({ email, subdomain });
      setSuccess(true);
      toast.success(t('forgotPassword.successTitle'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('forgotPassword.requestFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="login-page">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <CheckCircle2 size={48} style={{ color: 'var(--success)', marginBottom: '1rem', display: 'inline-block' }} />
          <h2 className="login-page__heading">{t('forgotPassword.successTitle')}</h2>
          <p className="login-page__subheading" style={{ marginTop: '0.5rem' }}>
            {t('forgotPassword.successMessage')}
          </p>
        </div>
        <button
          className="btn btn--primary btn--full"
          onClick={() => navigate('/login')}
        >
          {t('forgotPassword.backToLogin')}
        </button>
      </div>
    );
  }

  return (
    <div className="login-page">
      <h2 className="login-page__heading">{t('forgotPassword.title')}</h2>
      <p className="login-page__subheading">
        {t('forgotPassword.subtitle')}
      </p>

      <form className="login-page__form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            {t('forgotPassword.emailAddress')}
          </label>
          <div className="form-input-wrapper">
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full"
          disabled={isSubmitting || !email}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          {isSubmitting ? (
            <div className="btn__spinner" />
          ) : (
            <>
              <Mail size={18} />
              <span>{t('forgotPassword.sendResetLink')}</span>
            </>
          )}
        </button>

        <button
          type="button"
          className="btn btn--ghost btn--full"
          style={{ marginTop: '1rem', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          onClick={() => navigate('/login')}
          disabled={isSubmitting}
        >
          <ArrowLeft size={18} />
          <span>{t('forgotPassword.backToLogin')}</span>
        </button>
      </form>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authService } from '../services';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error(t('resetPassword.invalidToken'));
      navigate('/login');
      return;
    }

    const verifyToken = async () => {
      try {
        setIsValidating(true);
        const res = await authService.validateResetToken(token);
        if (res && res.valid) {
          setIsTokenValid(true);
        } else {
          setIsTokenValid(false);
        }
      } catch (err) {
        setIsTokenValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    verifyToken();
  }, [token, navigate, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error(t('resetPassword.passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('resetPassword.passwordsDoNotMatch'));
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.resetPassword({ token: token!, newPassword: password });
      setSuccess(true);
      toast.success(t('resetPassword.resetSuccess'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('resetPassword.resetFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="login-page animate-fade-in" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
        <div className="btn__spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }} />
        <h2 className="login-page__heading">{t('common.loading')}</h2>
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="login-page animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <AlertCircle size={48} style={{ color: 'var(--danger)', marginBottom: '1rem', display: 'inline-block' }} />
          <h2 className="login-page__heading">{t('errors.verificationFailed')}</h2>
          <p className="login-page__subheading" style={{ marginTop: '0.5rem' }}>
            {t('resetPassword.tokenExpiredOrInvalid')}
          </p>
        </div>
        <button
          className="btn btn--primary btn--full"
          onClick={() => navigate('/forgot-password')}
        >
          {t('resetPassword.requestNewLink')}
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-page animate-fade-in">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <CheckCircle2 size={48} style={{ color: 'var(--success)', marginBottom: '1rem', display: 'inline-block' }} />
          <h2 className="login-page__heading">{t('resetPassword.passwordResetComplete')}</h2>
          <p className="login-page__subheading">
            {t('resetPassword.passwordSetSuccess')}
          </p>
        </div>
        <button
          className="btn btn--primary btn--full"
          onClick={() => navigate('/login')}
        >
          {t('resetPassword.proceedToLogin')}
        </button>
      </div>
    );
  }

  return (
    <div className="login-page animate-fade-in">
      <h2 className="login-page__heading">{t('resetPassword.setYourPassword')}</h2>
      <p className="login-page__subheading">
        {t('resetPassword.createNewPassword')}
      </p>

      <form className="login-page__form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password" className="form-label">
            {t('resetPassword.newPassword')}
          </label>
          <div className="form-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder={t('resetPassword.minChars')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
            <button
              type="button"
              className="form-input-icon-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password" className="form-label">
            {t('resetPassword.confirmPassword')}
          </label>
          <div className="form-input-wrapper">
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder={t('resetPassword.confirmPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full"
          disabled={isSubmitting || !password || !confirmPassword}
        >
          {isSubmitting ? (
            <div className="btn__spinner" />
          ) : (
            <>
              <Lock size={18} />
              <span>{t('resetPassword.setPassword')}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

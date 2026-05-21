import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../services';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid or missing password reset token');
      navigate('/login');
    }
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.resetPassword({ token: token!, newPassword: password });
      setSuccess(true);
      toast.success('Password reset successfully!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="login-page">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <CheckCircle2 size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
          <h2 className="login-page__heading">Password Reset Complete</h2>
          <p className="login-page__subheading">
            Your password has been set successfully. You can now log into your account.
          </p>
        </div>
        <button
          className="btn btn--primary btn--full"
          onClick={() => navigate('/login')}
        >
          Proceed to Login
        </button>
      </div>
    );
  }

  return (
    <div className="login-page">
      <h2 className="login-page__heading">Set Your Password</h2>
      <p className="login-page__subheading">
        Please create a new password to secure your account.
      </p>

      <form className="login-page__form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password" className="form-label">
            New Password
          </label>
          <div className="form-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Min. 8 characters"
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
            Confirm Password
          </label>
          <div className="form-input-wrapper">
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Confirm new password"
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
              <span>Set Password</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

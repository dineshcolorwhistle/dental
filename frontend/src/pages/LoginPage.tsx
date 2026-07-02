import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loginSchema = z.object({
    email: z.string().email(t('validation.emailRequired')),
    password: z.string().min(6, t('validation.passwordMinLength')),
    subdomain: z.string().optional(),
  });

  type LoginFormData = z.infer<typeof loginSchema>;

  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect');
  const from = redirectParam || (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      subdomain: '',
    },
  });

  const getSubdomain = () => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Ignore IP addresses and single-segment hosts like "localhost"
    if (parts.length <= 1 || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      return undefined;
    }
    
    // If it's a localhost with a subdomain (e.g. smilelab.localhost)
    if (parts.length === 2 && parts[1] === 'localhost') {
      return parts[0];
    }

    // For staging/dev domains like dental.agentwhistle.com or smile.dental.agentwhistle.com
    if (hostname.endsWith('.agentwhistle.com')) {
      if (parts.length >= 4) {
        return parts[0];
      }
      return undefined;
    }
    
    // For standard domains like subdomain.dental.com
    if (parts.length >= 3) {
      return parts[0];
    }
    
    return undefined;
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const extractedSubdomain = getSubdomain();
      await login({
        email: data.email,
        password: data.password,
        subdomain: extractedSubdomain,
      });
      toast.success(t('auth.loginSuccess'));
      navigate(from, { replace: true });
    } catch (error: any) {
      const message =
        error?.response?.data?.message || t('auth.invalidCredentials');
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <h2 className="login-page__heading">{t('auth.welcomeBack')}</h2>
      <p className="login-page__subheading">
        {t('auth.signInSubtitle')}
      </p>

      <form className="login-page__form" onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            {t('auth.emailAddress')}
          </label>
          <input
            id="email"
            type="email"
            className={`form-input ${errors.email ? 'form-input--error' : ''}`}
            placeholder="you@example.com"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email && (
            <span className="form-error">
              <AlertCircle size={14} />
              {errors.email.message}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            {t('auth.password')}
          </label>
          <div className="form-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${errors.password ? 'form-input--error' : ''}`}
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
            />
            <button
              type="button"
              className="form-input-icon-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <span className="form-error">
              <AlertCircle size={14} />
              {errors.password.message}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="btn btn--primary btn--full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="btn__spinner" />
          ) : (
            <>
              <LogIn size={18} />
              <span>{t('auth.signIn')}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

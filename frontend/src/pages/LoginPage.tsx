import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getSubdomain } from '../utils/subdomain';


export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roleSelectionData, setRoleSelectionData] = useState<{
    roles: ('OWNER' | 'ADMIN')[];
    email: string;
    password: string;
    subdomain?: string;
  } | null>(null);

  const loginSchema = z.object({
    email: z.string().email(t('validation.emailRequired')),
    password: z.string().min(6, t('validation.passwordMinLength')),
    subdomain: z.string().optional(),
  });

  type LoginFormData = z.infer<typeof loginSchema>;



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

  // Remove local getSubdomain, import from utils instead

  const getErrorMessage = (error: any) => {
    const serverMessage = error?.response?.data?.message;
    if (serverMessage === 'Only Super Admins can log in through the primary domain') {
      return t('auth.errors.primaryDomainOnlySuperAdmin');
    }
    if (serverMessage === 'Super Admins cannot log in through tenant subdomains') {
      return t('auth.errors.superAdminSubdomainDenied');
    }
    if (serverMessage === 'You do not have access to this tenant subdomain') {
      return t('auth.errors.tenantSubdomainOnlyTenantUsers');
    }
    if (serverMessage === 'Invalid tenant') {
      return t('auth.errors.invalidTenant');
    }
    if (serverMessage === 'Tenant is inactive or suspended') {
      return t('auth.errors.tenantInactive');
    }
    if (serverMessage === 'Account is inactive') {
      return t('auth.errors.accountInactive');
    }
    if (serverMessage === 'Selected role is not available for this account') {
      return t('auth.errors.roleNotAvailable');
    }
    if (serverMessage === 'Invalid credentials') {
      return t('auth.invalidCredentials');
    }
    return serverMessage || t('auth.invalidCredentials');
  };



  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const extractedSubdomain = getSubdomain();
      const res = await login({
        email: data.email,
        password: data.password,
        subdomain: extractedSubdomain,
      });

      if (res && res.requiresRoleSelection) {
        setRoleSelectionData({
          roles: res.roles,
          email: data.email,
          password: data.password,
          subdomain: extractedSubdomain,
        });
      } else {
        toast.success(t('auth.loginSuccess'));
        const targetPath = '/dashboard';
        navigate(targetPath, { replace: true });
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleSelect = async (role: 'OWNER' | 'ADMIN') => {
    if (!roleSelectionData) return;
    setIsSubmitting(true);
    try {
      await login({
        email: roleSelectionData.email,
        password: roleSelectionData.password,
        subdomain: roleSelectionData.subdomain,
        role: role,
      });
      toast.success(t('auth.loginSuccess'));
      const targetPath = '/dashboard';
      navigate(targetPath, { replace: true });
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (roleSelectionData) {
    return (
      <div className="login-page">
        <h2 className="login-page__heading">{t('auth.selectRole')}</h2>
        <p className="login-page__subheading">
          {t('auth.selectRoleSubtitle')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
          {roleSelectionData.roles.map((role) => (
            <button
              key={role}
              type="button"
              className="btn btn--primary btn--full animate-fade-in"
              style={{
                padding: '1.25rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, var(--accent-primary, #3B82F6), var(--accent-secondary, #1D4ED8))',
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)',
                transition: 'all 0.2s ease-in-out',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
              }}
              onClick={() => handleRoleSelect(role)}
              disabled={isSubmitting}
            >
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                {t(`enums.userRole.${role}`)}
              </span>
              <LogIn size={18} />
            </button>
          ))}

          <button
            type="button"
            className="btn btn--ghost btn--full"
            style={{ marginTop: '1rem', border: '1px solid var(--border)', cursor: 'pointer' }}
            onClick={() => setRoleSelectionData(null)}
            disabled={isSubmitting}
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label htmlFor="password" className="form-label" style={{ marginBottom: 0 }}>
              {t('auth.password')}
            </label>
            <Link
              to="/forgot-password"
              style={{ fontSize: '0.875rem', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 500, textDecoration: 'none' }}
            >
              {t('forgotPassword.title')}
            </Link>
          </div>
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

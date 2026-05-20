import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  subdomain: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginMode, setLoginMode] = useState<'super_admin' | 'tenant'>('super_admin');

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

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

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      await login({
        email: data.email,
        password: data.password,
        subdomain: loginMode === 'tenant' ? data.subdomain : undefined,
      });
      toast.success('Login successful!');
      navigate(from, { replace: true });
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'Invalid credentials. Please try again.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <h2 className="login-page__heading">Welcome back</h2>
      <p className="login-page__subheading">
        Sign in to your account to continue
      </p>

      {/* Login Mode Toggle */}
      <div className="login-page__mode-toggle">
        <button
          type="button"
          className={`login-page__mode-btn ${loginMode === 'super_admin' ? 'login-page__mode-btn--active' : ''}`}
          onClick={() => setLoginMode('super_admin')}
        >
          Platform Admin
        </button>
        <button
          type="button"
          className={`login-page__mode-btn ${loginMode === 'tenant' ? 'login-page__mode-btn--active' : ''}`}
          onClick={() => setLoginMode('tenant')}
        >
          Lab Login
        </button>
      </div>

      <form className="login-page__form" onSubmit={handleSubmit(onSubmit)}>
        {loginMode === 'tenant' && (
          <div className="form-group">
            <label htmlFor="subdomain" className="form-label">
              Lab Subdomain
            </label>
            <div className="form-input-wrapper">
              <input
                id="subdomain"
                type="text"
                className={`form-input ${errors.subdomain ? 'form-input--error' : ''}`}
                placeholder="e.g. smilelab"
                {...register('subdomain')}
              />
              <span className="form-input-suffix">.dental.com</span>
            </div>
            {errors.subdomain && (
              <span className="form-error">
                <AlertCircle size={14} />
                {errors.subdomain.message}
              </span>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Address
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
            Password
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
              <span>Sign In</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

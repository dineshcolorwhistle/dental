import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { toast } from 'react-hot-toast';
import { authService, type AuthUser, type LoginPayload } from '../services';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount and sync in background
  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');

    let isMounted = true;

    if (stored && token) {
      try {
        const parsedUser = JSON.parse(stored);
        setUser(parsedUser);

        // Fetch fresh profile in background to self-heal stale cached session details (e.g. branchName)
        authService.getProfile()
          .then((profile) => {
            if (!isMounted) return;
            const updatedUser: AuthUser = {
              id: profile.id,
              email: profile.email,
              firstName: profile.firstName,
              lastName: profile.lastName,
              role: profile.role,
              tenantId: profile.tenantId,
              tenantName: profile.tenant?.name || null,
              branchId: profile.branchId,
              branchName: profile.branch?.name || null,
              maxAdmins: profile.tenant?.maxAdmins || null,
              maxTechnicians: profile.tenant?.maxTechnicians || null,
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);
          })
          .catch((err) => {
            console.error('Failed to sync user profile in background:', err);
          });
      } catch {
        localStorage.removeItem('user');
      }
    }

    setIsLoading(false);

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await authService.login(payload);

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
    }
  }, []);

  // Idle session timeout logic
  useEffect(() => {
    if (!user) return;

    // Get timeout from environment variable (default: 1 hour in ms = 3600000)
    const envTimeout = import.meta.env.VITE_IDLE_TIMEOUT;
    const timeoutDuration = envTimeout ? parseInt(envTimeout, 10) : 3600000;

    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        logout().then(() => {
          toast.error('You have been logged out due to inactivity.', {
            id: 'idle-timeout-toast', // Prevent multiple duplicate toasts
          });
        });
      }, timeoutDuration);
    };

    // Events to monitor for activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Initialize timer
    resetTimer();

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

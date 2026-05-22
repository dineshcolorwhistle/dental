import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components';
import { AuthLayout, DashboardLayout } from './layouts';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { TenantsPage } from './pages/TenantsPage';
import { BranchesPage } from './pages/BranchesPage';
import { AdminsPage } from './pages/AdminsPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { TechniciansPage } from './pages/TechniciansPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                fontSize: '0.875rem',
              },
              success: {
                iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-surface)' },
              },
              error: {
                iconTheme: { primary: 'var(--danger)', secondary: 'var(--bg-surface)' },
              },
            }}
          />

        <Routes>
          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Protected dashboard routes */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/admins" element={<AdminsPage />} />
            <Route path="/doctors" element={<DoctorsPage />} />
            <Route path="/technicians" element={<TechniciansPage />} />
          </Route>

          {/* Error pages */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;

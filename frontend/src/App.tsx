import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, SocketProvider } from './context';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components';
import { AuthLayout, DashboardLayout } from './layouts';
import { LoginPage } from './pages/LoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { TenantsPage } from './pages/TenantsPage';
import { BranchesPage } from './pages/BranchesPage';
import { AdminsPage } from './pages/AdminsPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { TechniciansPage } from './pages/TechniciansPage';
import { ProsthesisTypesPage } from './pages/ProsthesisTypesPage';
import { ProcessesPage } from './pages/ProcessesPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { TechnicianWorkOrdersPage } from './pages/TechnicianWorkOrdersPage';
import { RequestedWorkOrdersPage } from './pages/RequestedWorkOrdersPage';
import { FinancePage } from './pages/FinancePage';
import { InventoryPage } from './pages/InventoryPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { QRRedirectPage } from './pages/QRRedirectPage';
import { WorkOrderDetailPage } from './pages/WorkOrderDetailPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { ProcessAreasPage } from './pages/ProcessAreasPage';
import { GeneralSettingsPage } from './pages/GeneralSettingsPage';
import { ConnectedClinicsPage } from './pages/ConnectedClinicsPage';


function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
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
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
            <Route
              path="/tenants"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <TenantsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/branches"
              element={
                <ProtectedRoute allowedRoles={['OWNER']}>
                  <BranchesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admins"
              element={
                <ProtectedRoute allowedRoles={['OWNER']}>
                  <AdminsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctors"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <DoctorsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/technicians"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <TechniciansPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/prosthesis-types"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <ProsthesisTypesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/processes"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <ProcessesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/work-orders"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <WorkOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/work-orders/:id"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN', 'TECHNICIAN']}>
                  <WorkOrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tech/work-orders"
              element={
                <ProtectedRoute allowedRoles={['TECHNICIAN']}>
                  <TechnicianWorkOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tech/requested-work-orders"
              element={
                <ProtectedRoute allowedRoles={['TECHNICIAN']}>
                  <RequestedWorkOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <FinancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <ExpensesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/api-keys"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <ApiKeysPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clinics"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <ConnectedClinicsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/process-areas"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <ProcessAreasPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/general"
              element={
                <ProtectedRoute allowedRoles={['OWNER', 'ADMIN']}>
                  <GeneralSettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* QR redirection route — clean fullscreen protected route */}
          <Route
            path="/qr/:token"
            element={
              <ProtectedRoute>
                <QRRedirectPage />
              </ProtectedRoute>
            }
          />

          {/* Error pages */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;

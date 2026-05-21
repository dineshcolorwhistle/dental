import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  LogOut,
  User,
  Menu,
  X,
  ChevronDown,
  Moon,
  Sun,
  Bell,
  Building2,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Owner',
  ADMIN: 'Administrator',
  TECHNICIAN: 'Technician',
  DELIVERY: 'Delivery',
};

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <path d="M24 4C18 4 14 8 12 14C10 20 10 28 14 34C17 38 20 42 24 44C28 42 31 38 34 34C38 28 38 20 36 14C34 8 30 4 24 4Z" fill="url(#sidebar-tooth)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
              <defs>
                <linearGradient id="sidebar-tooth" x1="12" y1="4" x2="36" y2="44">
                  <stop stopColor="#6FAED9"/>
                  <stop offset="1" stopColor="#A9CFE8"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="sidebar__brand-text">DentalLab</span>
          </div>
          <button
            className="sidebar__close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            onClick={() => setSidebarOpen(false)}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>

          {user?.role === 'SUPER_ADMIN' && (
            <NavLink
              to="/tenants"
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Building2 size={20} />
              <span>Tenants</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user-profile">
            <div className="sidebar__user-avatar">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="sidebar__user-details">
              <span className="sidebar__user-name">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="sidebar__user-email">
                {user?.email}
              </span>
            </div>
          </div>
          <button
            className="sidebar__logout-btn-full"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="dashboard-main">
        <header className="topbar">
          <button
            className="topbar__menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <div className="topbar__spacer" />

          <div style={{ display: 'flex', gap: '0.5rem', marginRight: '1rem' }}>
            <button
              className="topbar__menu-btn"
              style={{ display: 'flex' }}
              aria-label="Notifications"
            >
              <Bell size={20} />
            </button>
            <button
              onClick={toggleTheme}
              className="topbar__menu-btn"
              style={{ display: 'flex' }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          <div className="topbar__user" ref={dropdownRef}>
            <button
              className="topbar__user-btn"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <div className="topbar__avatar">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div className="topbar__user-info">
                <span className="topbar__user-name">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="topbar__user-role">
                  {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
                </span>
              </div>
              <ChevronDown size={16} className={`topbar__chevron ${dropdownOpen ? 'topbar__chevron--open' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="topbar__dropdown">
                <button className="topbar__dropdown-item" onClick={() => { setDropdownOpen(false); }}>
                  <User size={16} />
                  <span>Profile</span>
                </button>
                <div className="topbar__dropdown-divider" />
                <button
                  className="topbar__dropdown-item topbar__dropdown-item--danger"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

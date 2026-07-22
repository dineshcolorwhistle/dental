import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useSocket } from '../context';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  LogOut,
  User,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Bell,
  Building2,
  GitBranch,
  Users,
  Stethoscope,
  Sparkles,
  GitMerge,
  ClipboardList,
  PlusCircle,
  Check,
  Trash2,
  Eye,
  DollarSign,
  Package,
  Key,
  Settings as SettingsIcon,
  Layers,
  Truck,
  Sliders,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { notificationService, tenantService, type NotificationItem } from '../services';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ChatWidget } from '../components/ChatWidget';
import toast from 'react-hot-toast';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === null ? true : saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [usersExpanded, setUsersExpanded] = useState(false);
  const location = useLocation();

  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      tenantService.getMyProfile()
        .then((data) => {
          setLogoUrl(data.logoUrl);
        })
        .catch((err) => {
          console.error('Failed to load logo in layout', err);
        });
    }
  }, [user]);

  useEffect(() => {
    const handleLogoUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      setLogoUrl(customEvent.detail);
    };

    window.addEventListener('tenantLogoUpdated', handleLogoUpdate);
    return () => window.removeEventListener('tenantLogoUpdated', handleLogoUpdate);
  }, []);

  const isSettingsRoute = [
    '/branches',
    '/admins',
    '/technicians',
    '/doctors',
    '/prosthesis-types',
    '/processes',
    '/process-areas',
    '/settings/general',
    '/settings/delivery'
  ].some(path => location.pathname.startsWith(path));

  const isUsersRoute = [
    '/admins',
    '/technicians'
  ].some(path => location.pathname.startsWith(path));

  useEffect(() => {
    if (isSettingsRoute) {
      setSettingsExpanded(true);
    }
  }, [location.pathname, isSettingsRoute]);

  useEffect(() => {
    if (isUsersRoute) {
      setUsersExpanded(true);
    }
  }, [location.pathname, isUsersRoute]);

  // Push notifications hook integration
  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    loading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();

  const handleEnablePush = async () => {
    try {
      const success = await subscribePush();
      if (success) {
        toast.success(t('notifications.pushEnabled'));
      } else {
        toast.error(t('notifications.pushDenied'));
      }
    } catch (err: any) {
      toast.error(err.message || t('notifications.pushEnableFailed'));
    }
  };

  const handleDisablePush = async () => {
    try {
      const success = await unsubscribePush();
      if (success) {
        toast.success(t('notifications.pushDisabled'));
      } else {
        toast.error(t('notifications.pushDisableFailed'));
      }
    } catch {
      toast.error(t('notifications.pushDisableFailed'));
    }
  };
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user || user.role === 'SUPER_ADMIN') return;
    try {
      const [notifs, countData] = await Promise.all([
        notificationService.getAll(),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(countData.count);
    } catch {
      // Silently fail — non-critical
    }
  }, [user]);

  const { socket, isConnected } = useSocket();

  useEffect(() => {
    fetchNotifications();

    if (!socket) return;

    // Listen for notification updates in real time
    const handleNotificationCreated = (newNotif: NotificationItem) => {
      setNotifications((prev) => {
        // Prevent duplicate append if re-broadcasted
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev].slice(0, 50);
      });
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification_created', handleNotificationCreated);

    return () => {
      socket.off('notification_created', handleNotificationCreated);
    };
  }, [socket, fetchNotifications]);

  // Refetch when socket connection is established or restored
  useEffect(() => {
    if (isConnected) {
      fetchNotifications();
    }
  }, [isConnected, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await notificationService.delete(id);
      const notifToDelete = notifications.find((n) => n.id === id);
      if (notifToDelete && !notifToDelete.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // Silently fail
    }
  };

  const handleDeleteAllRead = async () => {
    try {
      await notificationService.deleteAllRead();
      setNotifications((prev) => prev.filter((n) => !n.isRead));
      toast.success(t('notifications.deleteReadSuccess'));
    } catch {
      // Silently fail
    }
  };

  const handleViewNotification = (n: NotificationItem) => {
    if (!n.isRead) {
      handleMarkRead(n.id);
    }
    setNotifOpen(false);
    if (n.referenceId) {
      if (user?.role === 'TECHNICIAN') {
        navigate(`/tech/work-orders?selectWo=${n.referenceId}`);
      } else {
        navigate(`/work-orders?selectWo=${n.referenceId}`);
      }
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close notification dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
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
    <div className={`dashboard-layout ${sidebarCollapsed ? 'layout--collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <div className="sidebar__brand">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                style={{
                  width: '32px',
                  height: '32px',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            ) : (
              <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                <path d="M24 4C18 4 14 8 12 14C10 20 10 28 14 34C17 38 20 42 24 44C28 42 31 38 34 34C38 28 38 20 36 14C34 8 30 4 24 4Z" fill="url(#sidebar-tooth)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                <defs>
                  <linearGradient id="sidebar-tooth" x1="12" y1="4" x2="36" y2="44">
                    <stop stopColor="#6FAED9" />
                    <stop offset="1" stopColor="#A9CFE8" />
                  </linearGradient>
                </defs>
              </svg>
            )}
            {!sidebarCollapsed && (
              <span className="sidebar__brand-text" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span>
                  {user?.role === 'SUPER_ADMIN' ? 'DentalLab' : (user?.tenantName || 'DentalLab')}
                </span>
                {(user?.role === 'ADMIN' || user?.role === 'TECHNICIAN') && user?.branchName && (
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: 'var(--accent-primary)',
                    letterSpacing: '0.02em',
                    marginTop: '2px'
                  }}>
                    {user.branchName}
                  </span>
                )}
              </span>
            )}
          </div>
          <button
            type="button"
            className="sidebar__toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            className="sidebar__close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {/* Dashboard menu item visible to SUPER_ADMIN, OWNER, ADMIN, and TECHNICIAN */}
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'TECHNICIAN') && (
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
              data-tooltip={t('navigation.dashboard')}
            >
              <LayoutDashboard size={20} />
              <span>{t('navigation.dashboard')}</span>
            </NavLink>
          )}

          {/* OWNER & ADMIN navigation */}
          {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
            <>

              <NavLink
                to="/work-orders"
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
                data-tooltip={t('navigation.workOrders')}
              >
                <ClipboardList size={20} />
                <span>{t('navigation.workOrders')}</span>
              </NavLink>

              <NavLink
                to="/finance"
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
                data-tooltip={t('navigation.finance')}
              >
                <DollarSign size={20} />
                <span>{t('navigation.finance')}</span>
              </NavLink>

              <NavLink
                to="/inventory"
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
                data-tooltip={t('navigation.inventory')}
              >
                <Package size={20} />
                <span>{t('navigation.inventory')}</span>
              </NavLink>

              <NavLink
                to="/expenses"
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
                data-tooltip={t('navigation.expenses')}
              >
                <DollarSign size={20} />
                <span>{t('navigation.expenses')}</span>
              </NavLink>

              {user?.role === 'ADMIN' && (
                <NavLink
                  to="/api-keys"
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                  }
                  onClick={() => setSidebarOpen(false)}
                  data-tooltip={t('navigation.apiKeys')}
                >
                  <Key size={20} />
                  <span>{t('navigation.apiKeys')}</span>
                </NavLink>
              )}

              <NavLink
                to="/clinics"
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
                data-tooltip={t('navigation.connectedClinics')}
              >
                <Building2 size={20} />
                <span>{t('navigation.connectedClinics')}</span>
              </NavLink>

              {/* Settings Submenu */}
              <div className="sidebar__submenu-container">
                <div
                  className={`sidebar__link sidebar__settings-toggle ${isSettingsRoute ? 'sidebar__link--active-parent' : ''}`}
                  onClick={() => setSettingsExpanded(!settingsExpanded)}
                  style={{ cursor: 'pointer' }}
                  data-tooltip={t('navigation.settings')}
                >
                  <SettingsIcon size={20} />
                  {!sidebarCollapsed && <span>{t('navigation.settings')}</span>}
                  {!sidebarCollapsed && (
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                      {settingsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                  )}
                </div>

                {settingsExpanded && (
                  <div className="sidebar__submenu">
                    {/* Branches - Owner only */}
                    {user?.role === 'OWNER' && (
                      <NavLink
                        to="/branches"
                        className={({ isActive }) =>
                          `sidebar__submenu-link ${isActive ? 'sidebar__submenu-link--active' : ''}`
                        }
                        onClick={() => setSidebarOpen(false)}
                        data-tooltip={t('navigation.branches')}
                      >
                        <GitBranch size={16} />
                        <span>{t('navigation.branches')}</span>
                      </NavLink>
                    )}

                    {/* Users submenu */}
                    <div className="sidebar__sub-submenu-container">
                      <div
                        className={`sidebar__submenu-link sidebar__users-toggle ${isUsersRoute ? 'sidebar__submenu-link--active-parent' : ''}`}
                        onClick={() => setUsersExpanded(!usersExpanded)}
                        style={{ cursor: 'pointer' }}
                        data-tooltip={t('navigation.users')}
                      >
                        <Users size={16} />
                        {!sidebarCollapsed && <span>{t('navigation.users')}</span>}
                        {!sidebarCollapsed && (
                          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                            {usersExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </span>
                        )}
                      </div>

                      {usersExpanded && (
                        <div className="sidebar__sub-submenu" style={{ paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid var(--border)', marginLeft: '1.25rem', marginTop: '2px' }}>
                          {/* Lab Admins - Owner only */}
                          {user?.role === 'OWNER' && (
                            <NavLink
                              to="/admins"
                              className={({ isActive }) =>
                                `sidebar__submenu-link ${isActive ? 'sidebar__submenu-link--active' : ''}`
                              }
                              onClick={() => setSidebarOpen(false)}
                              data-tooltip={t('navigation.labAdmins')}
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            >
                              <span>{t('navigation.labAdmins')}</span>
                            </NavLink>
                          )}
                          <NavLink
                            to="/technicians"
                            className={({ isActive }) =>
                              `sidebar__submenu-link ${isActive ? 'sidebar__submenu-link--active' : ''}`
                            }
                            onClick={() => setSidebarOpen(false)}
                            data-tooltip={t('navigation.technicians')}
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          >
                            <span>{t('navigation.technicians')}</span>
                          </NavLink>
                        </div>
                      )}
                    </div>

                    <NavLink
                      to="/doctors"
                      className={({ isActive }) =>
                        `sidebar__submenu-link ${isActive ? 'sidebar__submenu-link--active' : ''}`
                      }
                      onClick={() => setSidebarOpen(false)}
                      data-tooltip={t('navigation.doctors')}
                    >
                      <Stethoscope size={16} />
                      <span>{t('navigation.doctors')}</span>
                    </NavLink>

                    <NavLink
                      to="/prosthesis-types"
                      className={({ isActive }) =>
                        `sidebar__submenu-link ${isActive ? 'sidebar__submenu-link--active' : ''}`
                      }
                      onClick={() => setSidebarOpen(false)}
                      data-tooltip={t('navigation.prosthesisTypes')}
                    >
                      <Sparkles size={16} />
                      <span>{t('navigation.prosthesisTypes')}</span>
                    </NavLink>

                    <NavLink
                      to="/processes"
                      className={({ isActive }) =>
                        `sidebar__submenu-link ${isActive ? 'sidebar__submenu-link--active' : ''}`
                      }
                      onClick={() => setSidebarOpen(false)}
                      data-tooltip={t('navigation.processes')}
                    >
                      <GitMerge size={16} />
                      <span>{t('navigation.processes')}</span>
                    </NavLink>

                    <NavLink
                      to="/process-areas"
                      className={({ isActive }) =>
                        `sidebar__submenu-link ${isActive ? 'sidebar__submenu-link--active' : ''}`
                      }
                      onClick={() => setSidebarOpen(false)}
                      data-tooltip={t('navigation.processAreas')}
                    >
                      <Layers size={16} />
                      <span>{t('navigation.processAreas')}</span>
                    </NavLink>

                    {/* Delivery Management */}
                    <NavLink
                      to="/settings/delivery"
                      className={({ isActive }) =>
                        `sidebar__submenu-link ${isActive ? 'sidebar__submenu-link--active' : ''}`
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        toast(t('common.comingSoon', { defaultValue: 'Feature coming soon!' }));
                      }}
                      data-tooltip={t('navigation.deliveryManagement')}
                    >
                      <Truck size={16} />
                      <span>{t('navigation.deliveryManagement')}</span>
                    </NavLink>

                    {/* Other Configurations */}
                    <NavLink
                      to="/settings/general"
                      className={({ isActive }) =>
                        `sidebar__submenu-link ${isActive ? 'sidebar__submenu-link--active' : ''}`
                      }
                      onClick={() => setSidebarOpen(false)}
                      data-tooltip={t('navigation.otherConfigurations')}
                    >
                      <Sliders size={16} />
                      <span>{t('navigation.otherConfigurations')}</span>
                    </NavLink>
                  </div>
                )}
              </div>
            </>
          )}

          {user?.role === 'TECHNICIAN' && (
            <>
              <NavLink
                to="/tech/work-orders"
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
                data-tooltip={t('navigation.myWorkOrders')}
              >
                <ClipboardList size={20} />
                <span>{t('navigation.myWorkOrders')}</span>
              </NavLink>
              <NavLink
                to="/tech/requested-work-orders"
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                onClick={() => setSidebarOpen(false)}
                data-tooltip={t('navigation.requestedWorkOrders')}
              >
                <PlusCircle size={20} />
                <span>{t('navigation.requestedWorkOrders')}</span>
              </NavLink>
            </>
          )}

          {user?.role === 'SUPER_ADMIN' && (
            <NavLink
              to="/tenants"
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
              data-tooltip={t('navigation.tenants')}
            >
              <Building2 size={20} />
              <span>{t('navigation.tenants')}</span>
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
              {(user?.role === 'ADMIN' || user?.role === 'TECHNICIAN') && user?.branchName && (
                <div className="sidebar__user-branch" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  backgroundColor: 'var(--accent-primary-light)',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  width: 'fit-content'
                }}>
                  <Building2 size={10} />
                  <span>{user.branchName}</span>
                </div>
              )}
            </div>
          </div>
          <button
            className="sidebar__logout-btn-full"
            onClick={handleLogout}
            aria-label={t('common.logout')}
            data-tooltip={t('common.logout')}
          >
            <LogOut size={16} />
            <span>{t('common.logout')}</span>
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
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                className="topbar__menu-btn"
                style={{ display: 'flex', position: 'relative' }}
                aria-label={t('notifications.title')}
                onClick={() => setNotifOpen(!notifOpen)}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="notif-dropdown__title">{t('notifications.title')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {unreadCount > 0 && (
                        <button className="notif-dropdown__mark-all" onClick={handleMarkAllRead}>
                          <Check size={12} />
                          {t('notifications.markAllRead')}
                        </button>
                      )}
                      {notifications.some((n) => n.isRead) && (
                        <button
                          className="notif-dropdown__mark-all"
                          onClick={handleDeleteAllRead}
                          style={{ color: 'var(--danger, #EF4444)' }}
                          title={t('notifications.deleteAllRead')}
                        >
                          <Trash2 size={12} />
                          {t('notifications.deleteAllRead')}
                        </button>
                      )}
                    </div>
                  </div>
                  {isPushSupported && (
                    <>
                      {!isPushSubscribed ? (
                        <div className="push-banner">
                          <span className="push-banner__text">
                            {t('notifications.enableDesktopPush')}
                          </span>
                          <button
                            className="push-banner__btn"
                            onClick={handleEnablePush}
                            disabled={pushLoading}
                          >
                            {pushLoading ? t('notifications.enabling') : t('notifications.enableNotifications')}
                          </button>
                        </div>
                      ) : (
                        <div className="push-status-bar">
                          <span>{t('notifications.pushActive')}</span>
                          <button
                            className="push-status-bar__toggle"
                            onClick={handleDisablePush}
                            disabled={pushLoading}
                          >
                            {t('common.disable')}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <div className="notif-dropdown__list">
                    {notifications.length === 0 ? (
                      <div className="notif-dropdown__empty">
                        <Bell size={20} style={{ opacity: 0.3 }} />
                        <span>{t('notifications.noNotifications')}</span>
                      </div>
                    ) : (
                      notifications.slice(0, 20).map((n) => (
                        <div
                          key={n.id}
                          className={`notif-dropdown__item ${!n.isRead ? 'notif-dropdown__item--unread' : ''}`}
                          style={{ position: 'relative', paddingRight: '4.5rem', cursor: n.referenceId ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (n.referenceId) {
                              handleViewNotification(n);
                            } else if (!n.isRead) {
                              handleMarkRead(n.id);
                            }
                          }}
                        >
                          <div className="notif-dropdown__item-title">{n.title}</div>
                          <div className="notif-dropdown__item-msg">{n.message}</div>
                          <div className="notif-dropdown__item-time">
                            {new Date(n.createdAt).toLocaleDateString(undefined, {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                          <div
                            style={{
                              position: 'absolute',
                              right: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {n.referenceId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewNotification(n);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '4px',
                                  borderRadius: '4px',
                                  opacity: 0.7,
                                  transition: 'opacity 0.2s',
                                  color: 'var(--accent-primary, #3B82F6)',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                                title={t('notifications.viewDetails')}
                              >
                                <Eye size={14} />
                              </button>
                            )}
                            {n.isRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNotification(n.id);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '4px',
                                  borderRadius: '4px',
                                  opacity: 0.6,
                                  transition: 'opacity 0.2s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                                title={t('notifications.deleteNotification')}
                              >
                                <Trash2 size={13} style={{ color: '#EF4444' }} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <LanguageSwitcher />
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
                  {t(`enums.userRole.${user?.role ?? ''}`)}
                </span>
              </div>
              <ChevronDown size={16} className={`topbar__chevron ${dropdownOpen ? 'topbar__chevron--open' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="topbar__dropdown">
                <button className="topbar__dropdown-item" onClick={() => { setDropdownOpen(false); }}>
                  <User size={16} />
                  <span>{t('common.profile')}</span>
                </button>
                <div className="topbar__dropdown-divider" />
                <button
                  className="topbar__dropdown-item topbar__dropdown-item--danger"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet />
        </main>
        <ChatWidget />
      </div>
    </div>
  );
}

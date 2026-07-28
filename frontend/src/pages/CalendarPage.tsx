import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Search,
  List,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  CircleDot,
  PlayCircle,
  ShieldCheck,
  X,
  Eye,
  Loader2,
  User,
  GitBranch,
} from 'lucide-react';
import {
  workOrderService,
  doctorService,
  branchService,
  type WorkOrderListItem,
  type DoctorListItem,
  type BranchListItem,
} from '../services';
import { SearchableSelect, ViewWorkOrderModal } from '../components';
import { useAuth } from '../context';

type ViewMode = 'month' | 'week' | 'day';

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  CREATED: { color: '#4B5563', bg: 'var(--bg-secondary, #F3F4F6)', border: '#D1D5DB', icon: <CircleDot size={12} /> },
  ASSIGNED: { color: '#2563EB', bg: 'rgba(59, 130, 246, 0.08)', border: '#BFDBFE', icon: <Clock size={12} /> },
  IN_PROGRESS: { color: '#D97706', bg: 'rgba(245, 158, 11, 0.08)', border: '#FDE68A', icon: <PlayCircle size={12} /> },
  INTERNAL_VERIFICATION: { color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.08)', border: '#DDD6FE', icon: <ShieldCheck size={12} /> },
  EXTERNAL_VERIFICATION: { color: '#4F46E5', bg: 'rgba(79, 70, 229, 0.08)', border: '#C7D2FE', icon: <ShieldCheck size={12} /> },
  COMPLETED: { color: '#059669', bg: 'rgba(16, 185, 129, 0.08)', border: '#A7F3D0', icon: <CheckCircle2 size={12} /> },
  FAILED: { color: '#DC2626', bg: 'rgba(239, 68, 68, 0.08)', border: '#FECACA', icon: <AlertCircle size={12} /> },
  CANCELLED: { color: '#EA580C', bg: 'rgba(234, 88, 12, 0.08)', border: '#FFEDD5', icon: <X size={12} /> },
};

const getLocalDateKey = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDeliveryDateKey = (deliveryDateStr?: string | null): string | null => {
  if (!deliveryDateStr) return null;
  const d = new Date(deliveryDateStr);
  if (isNaN(d.getTime())) return null;
  return getLocalDateKey(d);
};

export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const [workOrders, setWorkOrders] = useState<WorkOrderListItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');

  // Modals
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [dayModal, setDayModal] = useState<{ isOpen: boolean; date: Date | null; workOrders: WorkOrderListItem[] }>({
    isOpen: false,
    date: null,
    workOrders: [],
  });

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [woData, docsData, branchData] = await Promise.all([
        workOrderService.getAll(selectedBranchId !== 'ALL' ? selectedBranchId : undefined),
        doctorService.getAll().catch(() => []),
        user?.role === 'OWNER' ? branchService.getAll().catch(() => []) : Promise.resolve([]),
      ]);
      setWorkOrders(woData);
      setDoctors(docsData);
      setBranches(branchData);
    } catch (err) {
      console.error('Failed to load calendar data', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, user?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Options for SearchableSelect filters
  const statusOptions = useMemo(() => [
    { value: 'ALL', label: t('calendar.allStatuses') },
    ...Object.keys(STATUS_CONFIG).map((st) => ({
      value: st,
      label: t(`enums.workOrderStatus.${st}`, { defaultValue: st }),
    })),
  ], [t]);

  const doctorOptions = useMemo(() => [
    { value: 'ALL', label: t('calendar.allDoctors') },
    ...doctors.map((doc) => ({
      value: doc.id,
      label: doc.name,
    })),
  ], [doctors, t]);

  const branchOptions = useMemo(() => [
    { value: 'ALL', label: t('calendar.allBranches') },
    ...branches.map((b) => ({
      value: b.id,
      label: b.name,
    })),
  ], [branches, t]);

  // Filtered work orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      if (!wo.deliveryDate) return false;

      // Status filter
      if (selectedStatus !== 'ALL' && wo.status !== selectedStatus) return false;

      // Doctor filter
      if (selectedDoctorId !== 'ALL' && wo.doctorId !== selectedDoctorId) return false;

      // Branch filter
      if (selectedBranchId !== 'ALL' && wo.branchId !== selectedBranchId) return false;

      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesFolio = wo.folioNumber.toLowerCase().includes(query);
        const matchesPatient = (wo.patient || '').toLowerCase().includes(query);
        const matchesDoctor = (wo.doctor?.name || '').toLowerCase().includes(query);
        const matchesProsthesis = (wo.prosthesisType?.name || '').toLowerCase().includes(query);
        if (!matchesFolio && !matchesPatient && !matchesDoctor && !matchesProsthesis) {
          return false;
        }
      }

      return true;
    });
  }, [workOrders, selectedStatus, selectedDoctorId, selectedBranchId, searchTerm]);

  // Group work orders by delivery date key (YYYY-MM-DD)
  const workOrdersByDate = useMemo(() => {
    const map: Record<string, WorkOrderListItem[]> = {};
    filteredWorkOrders.forEach((wo) => {
      const key = getDeliveryDateKey(wo.deliveryDate);
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(wo);
      }
    });
    return map;
  }, [filteredWorkOrders]);

  // Month navigation logic
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() - 1);
      }
      return newDate;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      return newDate;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Locale-aware month & day formatters
  const locale = i18n.language?.startsWith('es') ? 'es-MX' : 'en-US';

  const currentFormattedLabel = useMemo(() => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    } else if (viewMode === 'day') {
      return currentDate.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else {
      // Week View
      const startOfWeek = new Date(currentDate);
      const dayOfWeek = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      const startStr = startOfWeek.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
      const endStr = endOfWeek.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
  }, [currentDate, viewMode, locale]);

  // Month Grid calculation
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Previous month padding
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }

    // Next month padding to complete grid
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({ date: nextDate, isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  // Week Grid calculation
  const weekGridDays = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Day names header
  const dayNamesHeader = useMemo(() => {
    const tempDate = new Date(2026, 7, 2); // August 2, 2026 is Sunday
    const names = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(tempDate);
      d.setDate(d.getDate() + i);
      names.push(d.toLocaleDateString(locale, { weekday: 'short' }));
    }
    return names;
  }, [locale]);

  // Stats calculation kept intact for data model/integrity (Hidden in UI per user request)
  const stats = useMemo(() => {
    const todayKey = getLocalDateKey(new Date());
    let total = filteredWorkOrders.length;
    let pending = 0;
    let completed = 0;
    let overdue = 0;

    filteredWorkOrders.forEach((wo) => {
      if (wo.status === 'COMPLETED') {
        completed++;
      } else if (wo.status === 'CANCELLED') {
        // Ignored in active pending
      } else {
        pending++;
        const dateKey = getDeliveryDateKey(wo.deliveryDate);
        if (dateKey && dateKey < todayKey) {
          overdue++;
        }
      }
    });

    return { total, pending, completed, overdue };
  }, [filteredWorkOrders]);

  const todayKeyStr = getLocalDateKey(new Date());

  return (
    <div className="admins-page" style={{ gap: '1.25rem' }}>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-header__title" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <CalendarIcon size={26} className="text-primary" style={{ color: 'var(--primary, #3B82F6)' }} />
            {t('calendar.title')}
          </h1>
          <p className="page-header__subtitle">
            {t('calendar.subtitle')}
          </p>
        </div>

        {/* Action Controls & Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Quick List View Button */}
          <button
            onClick={() => navigate('/work-orders')}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}
          >
            <List size={16} />
            <span>{t('calendar.listView')}</span>
          </button>

          {/* Today Button */}
          <button
            onClick={handleToday}
            className="btn btn-outline"
            style={{ height: '38px' }}
          >
            {t('calendar.today')}
          </button>

          {/* Month/Week Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px', backgroundColor: 'var(--bg-surface)' }}>
            <button
              onClick={handlePrev}
              className="btn btn-icon"
              style={{ padding: '6px', height: '32px', width: '32px' }}
              title={t('calendar.previous')}
            >
              <ChevronLeft size={18} />
            </button>

            <span style={{ fontWeight: 600, fontSize: '0.875rem', padding: '0 0.75rem', textTransform: 'capitalize', color: 'var(--text-primary)', minWidth: '130px', textAlign: 'center' }}>
              {currentFormattedLabel}
            </span>

            <button
              onClick={handleNext}
              className="btn btn-icon"
              style={{ padding: '6px', height: '32px', width: '32px' }}
              title={t('calendar.next')}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* View Mode Switcher Segment */}
          <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
            {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8125rem',
                  fontWeight: viewMode === mode ? 600 : 500,
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: viewMode === mode ? 'var(--bg-surface)' : 'transparent',
                  color: viewMode === mode ? 'var(--primary, #3B82F6)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {t(`calendar.views.${mode}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards - Hidden as requested by user (code kept intact above) */}
      <div style={{ display: 'none' }}>
        <span>{stats.total} {stats.pending} {stats.completed} {stats.overdue}</span>
      </div>

      {/* Professional Search & Searchable Filters Toolbar */}
      <div className="table-toolbar" style={{ gap: '0.875rem', flexWrap: 'wrap' }}>
        {/* Search input wrap */}
        <div className="search-input-wrap" style={{ flex: '1 1 240px', maxWidth: '340px' }}>
          <Search size={16} className="search-input__icon" />
          <input
            id="input-calendar-search"
            type="text"
            className="form-input search-input"
            placeholder={t('calendar.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="search-input__clear" onClick={() => setSearchTerm('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Filters with Search */}
        <div className="table-toolbar__filters" style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Status Searchable Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', width: '180px' }}>
            <Filter size={15} style={{ color: 'var(--text-secondary)' }} />
            <div style={{ flex: 1 }}>
              <SearchableSelect
                options={statusOptions}
                value={selectedStatus}
                onChange={setSelectedStatus}
                placeholder={t('calendar.allStatuses')}
              />
            </div>
          </div>

          {/* Doctor Searchable Filter */}
          {doctors.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', width: '180px' }}>
              <User size={15} style={{ color: 'var(--text-secondary)' }} />
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={doctorOptions}
                  value={selectedDoctorId}
                  onChange={setSelectedDoctorId}
                  placeholder={t('calendar.allDoctors')}
                />
              </div>
            </div>
          )}

          {/* Branch Searchable Filter */}
          {branches.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', width: '180px' }}>
              <GitBranch size={15} style={{ color: 'var(--text-secondary)' }} />
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={branchOptions}
                  value={selectedBranchId}
                  onChange={setSelectedBranchId}
                  placeholder={t('calendar.allBranches')}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Calendar Container */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '2rem' }}>
          <Loader2 size={36} className="spinner" style={{ color: 'var(--primary, #3B82F6)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>{t('common.loading')}</p>
        </div>
      ) : (
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)' }}>
          {/* Month View Grid */}
          {viewMode === 'month' && (
            <div>
              {/* Days Header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {dayNamesHeader.map((dName, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.625rem 0.5rem',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {dName}
                  </div>
                ))}
              </div>

              {/* Month Days Cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(125px, auto)' }}>
                {monthGridDays.map((cell, idx) => {
                  const dateKey = getLocalDateKey(cell.date);
                  const isToday = dateKey === todayKeyStr;
                  const dayOrders = workOrdersByDate[dateKey] || [];
                  const displayOrders = dayOrders.slice(0, 3);
                  const extraCount = dayOrders.length - 3;

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.5rem',
                        borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: isToday ? 'rgba(59, 130, 246, 0.04)' : cell.isCurrentMonth ? 'var(--bg-surface)' : 'var(--bg-secondary)',
                        opacity: cell.isCurrentMonth ? 1 : 0.45,
                        minHeight: '125px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.375rem',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Cell Day Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: isToday ? 700 : 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: isToday ? 'var(--primary, #3B82F6)' : 'transparent',
                            color: isToday ? '#FFFFFF' : 'var(--text-primary)',
                            boxShadow: isToday ? '0 2px 6px rgba(59,130,246,0.3)' : 'none',
                          }}
                        >
                          {cell.date.getDate()}
                        </span>

                        {dayOrders.length > 0 && (
                          <span
                            onClick={() => setDayModal({ isOpen: true, date: cell.date, workOrders: dayOrders })}
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: 'var(--primary, #3B82F6)',
                              cursor: 'pointer',
                              padding: '1px 6px',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(59, 130, 246, 0.12)',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                            }}
                            title={t('calendar.ordersScheduled', { count: dayOrders.length })}
                          >
                            {dayOrders.length}
                          </span>
                        )}
                      </div>

                      {/* Work Order Cards / Badges */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                        {displayOrders.map((wo) => {
                          const config = STATUS_CONFIG[wo.status] || STATUS_CONFIG.CREATED;
                          return (
                            <div
                              key={wo.id}
                              onClick={() => setSelectedWorkOrderId(wo.id)}
                              style={{
                                padding: '4px 6px',
                                borderRadius: '5px',
                                backgroundColor: config.bg,
                                borderLeft: `3px solid ${config.color}`,
                                borderTop: `1px solid ${config.border}`,
                                borderRight: `1px solid ${config.border}`,
                                borderBottom: `1px solid ${config.border}`,
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                                <span style={{ fontSize: '0.75rem' }}>{wo.folioNumber}</span>
                                <span style={{ color: config.color, display: 'flex', alignItems: 'center' }}>
                                  {config.icon}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {wo.patient ? wo.patient : wo.doctor?.name || t('calendar.noDeliveryDate')}
                              </div>
                            </div>
                          );
                        })}

                        {extraCount > 0 && (
                          <button
                            onClick={() => setDayModal({ isOpen: true, date: cell.date, workOrders: dayOrders })}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary, #3B82F6)',
                              fontSize: '0.7188rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left',
                              padding: '2px 4px',
                            }}
                          >
                            {t('calendar.moreOrders', { count: extraCount })}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Week View Grid */}
          {viewMode === 'week' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {weekGridDays.map((wDate, idx) => {
                  const dateKey = getLocalDateKey(wDate);
                  const isToday = dateKey === todayKeyStr;
                  const dayName = wDate.toLocaleDateString(locale, { weekday: 'short' });

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.75rem',
                        textAlign: 'center',
                        borderRight: idx === 6 ? 'none' : '1px solid var(--border)',
                        backgroundColor: isToday ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: '0.7188rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>{dayName}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: isToday ? 'var(--primary, #3B82F6)' : 'var(--text-primary)', marginTop: '2px' }}>{wDate.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: '420px' }}>
                {weekGridDays.map((wDate, idx) => {
                  const dateKey = getLocalDateKey(wDate);
                  const dayOrders = workOrdersByDate[dateKey] || [];

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '0.5rem',
                        borderRight: idx === 6 ? 'none' : '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      {dayOrders.length === 0 ? (
                        <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          —
                        </div>
                      ) : (
                        dayOrders.map((wo) => {
                          const config = STATUS_CONFIG[wo.status] || STATUS_CONFIG.CREATED;
                          return (
                            <div
                              key={wo.id}
                              onClick={() => setSelectedWorkOrderId(wo.id)}
                              style={{
                                padding: '0.625rem',
                                borderRadius: '6px',
                                backgroundColor: config.bg,
                                borderLeft: `4px solid ${config.color}`,
                                borderTop: `1px solid ${config.border}`,
                                borderRight: `1px solid ${config.border}`,
                                borderBottom: `1px solid ${config.border}`,
                                cursor: 'pointer',
                                fontSize: '0.8125rem',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                transition: 'transform 0.12s ease',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                                <span>{wo.folioNumber}</span>
                                <span style={{ color: config.color }}>{config.icon}</span>
                              </div>
                              {wo.patient && <div style={{ fontSize: '0.75rem', fontWeight: 500 }}>{wo.patient}</div>}
                              {wo.doctor && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{wo.doctor.name}</div>}
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                                {wo.prosthesisType?.name}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day View Grid */}
          {viewMode === 'day' && (
            <div style={{ padding: '1.5rem' }}>
              {(() => {
                const dateKey = getLocalDateKey(currentDate);
                const dayOrders = workOrdersByDate[dateKey] || [];

                if (dayOrders.length === 0) {
                  return (
                    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <CalendarIcon size={44} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                      <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 500 }}>{t('calendar.noOrdersOnDate')}</p>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                    {dayOrders.map((wo) => {
                      const config = STATUS_CONFIG[wo.status] || STATUS_CONFIG.CREATED;
                      return (
                        <div
                          key={wo.id}
                          onClick={() => setSelectedWorkOrderId(wo.id)}
                          style={{
                            padding: '1.125rem',
                            borderRadius: '10px',
                            backgroundColor: config.bg,
                            borderLeft: `5px solid ${config.color}`,
                            borderTop: `1px solid ${config.border}`,
                            borderRight: `1px solid ${config.border}`,
                            borderBottom: `1px solid ${config.border}`,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.625rem',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)' }}>{wo.folioNumber}</span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: config.color,
                                padding: '3px 9px',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(255,255,255,0.85)',
                              }}
                            >
                              {config.icon}
                              {t(`enums.workOrderStatus.${wo.status}`)}
                            </span>
                          </div>

                          {wo.patient && (
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {wo.patient}
                            </div>
                          )}

                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div><strong>{t('common.doctor')}:</strong> {wo.doctor?.name || 'N/A'}</div>
                            <div><strong>{t('dashboard.prosthesis')}:</strong> {wo.prosthesisType?.name || 'N/A'}</div>
                            {wo.branch && <div><strong>{t('common.branch')}:</strong> {wo.branch.name}</div>}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                            <button
                              className="btn btn-outline"
                              style={{ fontSize: '0.75rem', padding: '4px 10px', height: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <Eye size={14} />
                              {t('common.viewDetails')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Day Details Modal */}
      {dayModal.isOpen && dayModal.date && (
        <div className="modal-overlay" onClick={() => setDayModal({ isOpen: false, date: null, workOrders: [] })}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '650px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                {t('calendar.dayDetailsTitle', {
                  date: dayModal.date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
                })}
              </h3>
              <button
                className="modal-close"
                onClick={() => setDayModal({ isOpen: false, date: null, workOrders: [] })}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {dayModal.workOrders.map((wo) => {
                const config = STATUS_CONFIG[wo.status] || STATUS_CONFIG.CREATED;
                return (
                  <div
                    key={wo.id}
                    onClick={() => {
                      setDayModal({ isOpen: false, date: null, workOrders: [] });
                      setSelectedWorkOrderId(wo.id);
                    }}
                    style={{
                      padding: '0.875rem',
                      borderRadius: '8px',
                      backgroundColor: config.bg,
                      border: `1px solid ${config.border}`,
                      borderLeft: `4px solid ${config.color}`,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'transform 0.12s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                        {wo.folioNumber} {wo.patient ? `— ${wo.patient}` : ''}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        {wo.doctor?.name} | {wo.prosthesisType?.name}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: config.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255,255,255,0.85)',
                      }}
                    >
                      {config.icon}
                      {t(`enums.workOrderStatus.${wo.status}`)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Work Order Detail View Modal */}
      {selectedWorkOrderId && (
        <ViewWorkOrderModal
          isOpen={!!selectedWorkOrderId}
          onClose={() => setSelectedWorkOrderId(null)}
          workOrderId={selectedWorkOrderId}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
}

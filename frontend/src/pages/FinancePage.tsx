import { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  Coins,
  AlertCircle,
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Percent,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { financeService, branchService } from '../services';
import type { FinanceStats, PendingPaymentWorkOrder } from '../services';
import { useAuth } from '../context';

interface BranchItem {
  id: string;
  name: string;
  code: string;
}

type DateRangeType = 'current-month' | 'previous-month' | 'last-3-months' | 'last-6-months' | 'current-year' | 'custom';

export function FinancePage() {
  const { user } = useAuth();
  // --- State Variables ---
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]); // Empty means ALL
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('current-month');
  
  // Custom Date inputs
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Finance Stats data
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Pending Payments list
  const [pendingWOs, setPendingWOs] = useState<PendingPaymentWorkOrder[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLimit] = useState(10);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingLoading, setPendingLoading] = useState(false);

  // UI state for dropdowns
  const [branchFilterOpen, setBranchFilterOpen] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // Tooltip state for custom charts
  const [lineTooltip, setLineTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    quoted: number;
    paid: number;
    visible: boolean;
  }>({ x: 0, y: 0, label: '', quoted: 0, paid: 0, visible: false });

  const [barTooltip, setBarTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: number;
    visible: boolean;
  }>({ x: 0, y: 0, label: '', value: 0, visible: false });

  const [multiBarTooltip, setMultiBarTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    paid: number;
    outstanding: number;
    visible: boolean;
  }>({ x: 0, y: 0, label: '', paid: 0, outstanding: 0, visible: false });

  // --- Date Range Calculations ---
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (dateRangeType) {
      case 'current-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'previous-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'last-3-months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'last-6-months':
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'current-year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
        } else {
          // Fallback to current month if custom dates are empty
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }
        break;
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [dateRangeType, customStartDate, customEndDate]);

  // --- Fetch Initial Data ---
  useEffect(() => {
    if (user?.role !== 'OWNER') return;

    branchService.getAll()
      .then((data) => {
        setBranches(data.map(b => ({ id: b.id, name: b.name, code: b.code })));
      })
      .catch((err) => {
        console.error('Failed to load branches', err);
        toast.error('Failed to load branches');
      });
  }, [user?.role]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setBranchFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Fetch Financial Statistics & Pending Payments ---
  const fetchData = async () => {
    setStatsLoading(true);
    try {
      const branchIdsParam = selectedBranches.length > 0 ? selectedBranches.join(',') : 'ALL';
      const statsData = await financeService.getStats({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        branchIds: branchIdsParam,
      });
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch financial statistics', err);
      toast.error('Failed to load financial statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchPendingPayments = async () => {
    setPendingLoading(true);
    try {
      const branchIdsParam = selectedBranches.length > 0 ? selectedBranches.join(',') : 'ALL';
      const pendingData = await financeService.getPendingPayments({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        branchIds: branchIdsParam,
        page: pendingPage,
        limit: pendingLimit,
        search: pendingSearch,
      });
      setPendingWOs(pendingData.data);
      setPendingTotal(pendingData.meta.total);
    } catch (err) {
      console.error('Failed to fetch pending payments', err);
      toast.error('Failed to load pending payments list');
    } finally {
      setPendingLoading(false);
    }
  };

  // Trigger fetch when parameters change
  useEffect(() => {
    fetchData();
  }, [dateRange, selectedBranches]);

  useEffect(() => {
    fetchPendingPayments();
  }, [dateRange, selectedBranches, pendingPage, pendingSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingSearch(e.target.value);
    setPendingPage(1);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleBranchSelect = (id: string) => {
    setSelectedBranches((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
    setPendingPage(1);
  };

  const clearBranchFilter = () => {
    setSelectedBranches([]);
    setPendingPage(1);
  };

  // --- SVG Charts Computations ---
  
  // 1. Line Chart: Monthly Revenue Trend
  const lineChartData = useMemo(() => {
    if (!stats || stats.monthlyTrends.length === 0) return null;
    const trends = stats.monthlyTrends;
    const padding = 40;
    const chartWidth = 600;
    const chartHeight = 220;
    
    const xStep = trends.length > 1 ? (chartWidth - padding * 2) / (trends.length - 1) : 0;
    const maxVal = Math.max(
      ...trends.map((t) => Math.max(t.quotedAmount, t.paidAmount)),
      1000,
    );
    const yMax = maxVal * 1.15; // 15% headroom
    
    const pointsQuoted = trends.map((t, idx) => ({
      x: padding + idx * xStep,
      y: chartHeight - padding - ((t.quotedAmount / yMax) * (chartHeight - padding * 2)),
      val: t.quotedAmount,
      label: t.label,
      paid: t.paidAmount
    }));

    const pointsPaid = trends.map((t, idx) => ({
      x: padding + idx * xStep,
      y: chartHeight - padding - ((t.paidAmount / yMax) * (chartHeight - padding * 2)),
      val: t.paidAmount,
      label: t.label,
      quoted: t.quotedAmount
    }));

    // Generate Path descriptions
    const createSmoothPath = (pts: { x: number; y: number }[]) => {
      if (pts.length === 0) return '';
      if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
      let path = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const cpX1 = pts[i].x + xStep / 3;
        const cpY1 = pts[i].y;
        const cpX2 = pts[i + 1].x - xStep / 3;
        const cpY2 = pts[i + 1].y;
        path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${pts[i + 1].x} ${pts[i + 1].y}`;
      }
      return path;
    };

    const pathQuoted = createSmoothPath(pointsQuoted);
    const pathPaid = createSmoothPath(pointsPaid);

    // Area path closed under line
    const areaQuoted = pathQuoted ? `${pathQuoted} L ${pointsQuoted[pointsQuoted.length - 1].x} ${chartHeight - padding} L ${pointsQuoted[0].x} ${chartHeight - padding} Z` : '';
    const areaPaid = pathPaid ? `${pathPaid} L ${pointsPaid[pointsPaid.length - 1].x} ${chartHeight - padding} L ${pointsPaid[0].x} ${chartHeight - padding} Z` : '';

    // Y Axis Grid lines (4 intervals)
    const gridLines: { y: number; val: number }[] = [];
    for (let i = 0; i <= 4; i++) {
      const ratio = i / 4;
      gridLines.push({
        y: chartHeight - padding - ratio * (chartHeight - padding * 2),
        val: ratio * yMax,
      });
    }

    return {
      trends,
      padding,
      chartWidth,
      chartHeight,
      pointsQuoted,
      pointsPaid,
      pathQuoted,
      pathPaid,
      areaQuoted,
      areaPaid,
      gridLines,
    };
  }, [stats]);

  // 2. Bar Chart: Revenue by Branch
  const revenueByBranchChart = useMemo(() => {
    if (!stats || stats.branchPerformance.length === 0) return null;
    const branchesPerf = stats.branchPerformance;
    const padding = 50;
    const chartWidth = 550;
    const chartHeight = 220;

    const maxVal = Math.max(...branchesPerf.map((b) => b.quotedAmount), 1000);
    const yMax = maxVal * 1.15;

    const barWidth = Math.min(45, (chartWidth - padding * 2) / (branchesPerf.length * 1.8));
    const step = (chartWidth - padding * 2) / branchesPerf.length;

    const bars = branchesPerf.map((b, idx) => {
      const h = ((b.quotedAmount / yMax) * (chartHeight - padding * 2));
      const x = padding + idx * step + (step - barWidth) / 2;
      const y = chartHeight - padding - h;
      return {
        x,
        y,
        w: barWidth,
        h,
        label: b.branchName,
        value: b.quotedAmount,
      };
    });

    const gridLines: { y: number; val: number }[] = [];
    for (let i = 0; i <= 4; i++) {
      const ratio = i / 4;
      gridLines.push({
        y: chartHeight - padding - ratio * (chartHeight - padding * 2),
        val: ratio * yMax,
      });
    }

    return {
      bars,
      padding,
      chartWidth,
      chartHeight,
      gridLines,
    };
  }, [stats]);

  // 3. Stacked/Grouped Bar: Collection vs Outstanding Amount
  const collectionVsOutstandingChart = useMemo(() => {
    if (!stats || stats.branchPerformance.length === 0) return null;
    const branchesPerf = stats.branchPerformance;
    const padding = 50;
    const chartWidth = 550;
    const chartHeight = 220;

    // We draw group bars: Paid and Outstanding side-by-side
    const maxVal = Math.max(...branchesPerf.map((b) => Math.max(b.paidAmount, b.outstandingAmount)), 1000);
    const yMax = maxVal * 1.15;

    const groupWidth = (chartWidth - padding * 2) / branchesPerf.length;
    const barWidth = Math.min(20, groupWidth / 3);

    const bars = branchesPerf.map((b, idx) => {
      const hPaid = ((b.paidAmount / yMax) * (chartHeight - padding * 2));
      const hOut = ((b.outstandingAmount / yMax) * (chartHeight - padding * 2));
      
      const xGroup = padding + idx * groupWidth;
      const xPaid = xGroup + (groupWidth - barWidth * 2 - 4) / 2;
      const xOut = xPaid + barWidth + 4;

      const yPaid = chartHeight - padding - hPaid;
      const yOut = chartHeight - padding - hOut;

      return {
        label: b.branchName,
        paid: b.paidAmount,
        outstanding: b.outstandingAmount,
        paidBar: { x: xPaid, y: yPaid, w: barWidth, h: hPaid },
        outBar: { x: xOut, y: yOut, w: barWidth, h: hOut },
      };
    });

    const gridLines: { y: number; val: number }[] = [];
    for (let i = 0; i <= 4; i++) {
      const ratio = i / 4;
      gridLines.push({
        y: chartHeight - padding - ratio * (chartHeight - padding * 2),
        val: ratio * yMax,
      });
    }

    return {
      bars,
      padding,
      chartWidth,
      chartHeight,
      gridLines,
    };
  }, [stats]);

  // 4. Donut Chart: Payment Status Distribution
  const donutChartData = useMemo(() => {
    if (!stats) return null;
    const paid = stats.paymentStatusDistribution.paidCount;
    const pending = stats.paymentStatusDistribution.pendingCount;
    const total = paid + pending;
    if (total === 0) return {
      paid: 0,
      pending: 0,
      total: 0,
      paidPct: 0,
      pendingPct: 0,
      radius: 50,
      circum: 2 * Math.PI * 50,
      paidCircum: 0,
      pendingCircum: 2 * Math.PI * 50,
    };

    const paidPct = (paid / total) * 100;
    const pendingPct = (pending / total) * 100;

    const radius = 50;
    const circum = 2 * Math.PI * radius; // ~314.16

    const paidCircum = (paidPct / 100) * circum;
    const pendingCircum = (pendingPct / 100) * circum;

    return {
      paid,
      pending,
      total,
      paidPct,
      pendingPct,
      radius,
      circum,
      paidCircum,
      pendingCircum,
    };
  }, [stats]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
      
      {/* Top Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <TrendingUp size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>Finance Overview</span>
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
            Lab financial health, collections efficiency, and branch revenue summaries
          </p>
        </div>

        {/* Filters Group */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Branch Filter Dropdown */}
          {user?.role === 'OWNER' && (
            <div ref={branchDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setBranchFilterOpen(!branchFilterOpen)}
                className="btn btn--secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <Building2 size={16} />
                <span>
                  {selectedBranches.length === 0
                    ? 'All Branches'
                    : selectedBranches.length === 1
                    ? branches.find(b => b.id === selectedBranches[0])?.name || '1 Branch'
                    : `${selectedBranches.length} Branches`}
                </span>
                {selectedBranches.length > 0 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      clearBranchFilter();
                    }}
                    style={{
                      marginLeft: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--danger)',
                    }}
                    title="Clear branch filter"
                  >
                    <X size={12} />
                  </span>
                )}
              </button>

              {branchFilterOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    minWidth: '220px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '0.5rem',
                    zIndex: 40,
                  }}
                >
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      onClick={() => {
                        clearBranchFilter();
                        setBranchFilterOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        textAlign: 'left',
                        border: 'none',
                        backgroundColor: selectedBranches.length === 0 ? 'rgba(111, 174, 217, 0.1)' : 'transparent',
                        color: selectedBranches.length === 0 ? 'var(--accent-primary)' : 'var(--text-primary)',
                        fontWeight: selectedBranches.length === 0 ? 700 : 500,
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      All Branches
                    </button>
                    {branches.map((b) => {
                      const isSel = selectedBranches.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          onClick={() => handleBranchSelect(b.id)}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            textAlign: 'left',
                            border: 'none',
                            backgroundColor: isSel ? 'rgba(111, 174, 217, 0.1)' : 'transparent',
                            color: isSel ? 'var(--accent-primary)' : 'var(--text-primary)',
                            fontWeight: isSel ? 700 : 500,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'between',
                          }}
                        >
                          <span style={{ flex: 1 }}>{b.name}</span>
                          {isSel && <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date Range Dropdown / Toggle Buttons */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-surface)' }}>
            {(['current-month', 'previous-month', 'last-3-months', 'last-6-months', 'current-year', 'custom'] as const).map((type) => {
              const labels: Record<DateRangeType, string> = {
                'current-month': 'This Month',
                'previous-month': 'Last Month',
                'last-3-months': 'Last 3M',
                'last-6-months': 'Last 6M',
                'current-year': 'Year',
                'custom': 'Custom',
              };

              const isActive = dateRangeType === type;

              return (
                <button
                  key={type}
                  onClick={() => setDateRangeType(type)}
                  style={{
                    border: 'none',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    borderRight: type !== 'custom' ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Custom Date Inputs (Rendered only if Date Range is Custom) */}
      {dateRangeType === 'custom' && (
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'flex-end',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            padding: '1rem',
            borderRadius: '12px',
            width: 'fit-content',
            animation: 'dropdownIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Start Date</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="form-input"
              style={{ padding: '0.375rem 0.75rem', borderRadius: '6px' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>End Date</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="form-input"
              style={{ padding: '0.375rem 0.75rem', borderRadius: '6px' }}
            />
          </div>
          <button
            onClick={() => {
              setCustomStartDate('');
              setCustomEndDate('');
              setDateRangeType('current-month');
            }}
            className="btn btn--secondary"
            style={{
              padding: '0.375rem 0.875rem',
              height: '38px',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: 'var(--danger)',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
            title="Reset Date Filter"
          >
            <X size={14} />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* KPI Widgets Grid */}
      {statsLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="shimmer" style={{ height: '108px', borderRadius: '16px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }} />
          ))}
        </div>
      ) : stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          
          {/* Card: Total Quoted (Revenue) */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(111, 174, 217, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Revenue</span>
              <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                {formatCurrency(stats.summary.totalQuotedAmount)}
              </h3>
            </div>
          </div>

          {/* Card: Total Collected (Collections) */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--success-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--success)',
            }}>
              <Coins size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Collected</span>
              <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                {formatCurrency(stats.summary.totalPaidAmount)}
              </h3>
            </div>
          </div>

          {/* Card: Total Outstanding */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--warning-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--warning)',
            }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding</span>
              <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                {formatCurrency(stats.summary.totalOutstandingAmount)}
              </h3>
            </div>
          </div>

          {/* Card: Average Monthly Revenue */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366F1',
            }}>
              <Percent size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collection %</span>
              <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                {stats.summary.collectionPercentage.toFixed(1)}%
              </h3>
            </div>
          </div>

          {/* Card: Top Performing Branch */}
          {user?.role === 'OWNER' && (
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EC4899',
              }}>
                <Building2 size={24} />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top Branch</span>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stats.summary.topPerformingBranch.name}>
                  {stats.summary.topPerformingBranch.name}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {formatCurrency(stats.summary.topPerformingBranch.revenue)}
                </span>
              </div>
            </div>
          )}

          {/* Card: Pending Payment Count */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--danger)',
            }}>
              <TrendingDown size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Payments</span>
              <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                {stats.summary.pendingPaymentCount}
              </h3>
            </div>
          </div>

        </div>
      ) : null}

      {/* Visual Analytics / Charts Grid */}
      {!statsLoading && stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
          
          {/* Chart 1: Monthly Revenue Trend (Line Chart) */}
          {lineChartData && (
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-md)',
              position: 'relative',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} style={{ color: 'var(--accent-primary)' }} />
                <span>Monthly Revenue & Collections Trend</span>
              </h3>
              
              <div style={{ position: 'relative' }}>
                <svg
                  viewBox={`0 0 ${lineChartData.chartWidth} ${lineChartData.chartHeight}`}
                  width="100%"
                  height="100%"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <linearGradient id="gradient-quoted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="gradient-paid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--success)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--success)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {lineChartData.gridLines.map((line, idx) => (
                    <g key={idx}>
                      <line
                        x1={lineChartData.padding}
                        y1={line.y}
                        x2={lineChartData.chartWidth - lineChartData.padding}
                        y2={line.y}
                        stroke="var(--border)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={lineChartData.padding - 8}
                        y={line.y + 4}
                        fill="var(--text-muted)"
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {formatCurrency(line.val)}
                      </text>
                    </g>
                  ))}

                  {/* X Axis Base Line */}
                  <line
                    x1={lineChartData.padding}
                    y1={lineChartData.chartHeight - lineChartData.padding}
                    x2={lineChartData.chartWidth - lineChartData.padding}
                    y2={lineChartData.chartHeight - lineChartData.padding}
                    stroke="var(--border)"
                    strokeWidth="1.5"
                  />

                  {/* Quoted Area & Line */}
                  {lineChartData.areaQuoted && (
                    <path d={lineChartData.areaQuoted} fill="url(#gradient-quoted)" />
                  )}
                  {lineChartData.pathQuoted && (
                    <path
                      d={lineChartData.pathQuoted}
                      fill="none"
                      stroke="var(--accent-primary)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Paid Area & Line */}
                  {lineChartData.areaPaid && (
                    <path d={lineChartData.areaPaid} fill="url(#gradient-paid)" />
                  )}
                  {lineChartData.pathPaid && (
                    <path
                      d={lineChartData.pathPaid}
                      fill="none"
                      stroke="var(--success)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Hover interactive Quoted points */}
                  {lineChartData.pointsQuoted.map((pt, idx) => (
                    <circle
                      key={`q-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="var(--bg-surface)"
                      stroke="var(--accent-primary)"
                      strokeWidth="2.5"
                      style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                      onMouseEnter={(e) => {
                        const target = e.currentTarget;
                        target.setAttribute('r', '6');
                        setLineTooltip({
                          x: pt.x,
                          y: pt.y - 12,
                          label: pt.label,
                          quoted: pt.val,
                          paid: pt.paid,
                          visible: true,
                        });
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.setAttribute('r', '4');
                        setLineTooltip((prev) => ({ ...prev, visible: false }));
                      }}
                    />
                  ))}

                  {/* Hover interactive Paid points */}
                  {lineChartData.pointsPaid.map((pt, idx) => (
                    <circle
                      key={`p-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r="4"
                      fill="var(--bg-surface)"
                      stroke="var(--success)"
                      strokeWidth="2.5"
                      style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                      onMouseEnter={(e) => {
                        const target = e.currentTarget;
                        target.setAttribute('r', '6');
                        setLineTooltip({
                          x: pt.x,
                          y: pt.y - 12,
                          label: pt.label,
                          quoted: pt.quoted,
                          paid: pt.val,
                          visible: true,
                        });
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.setAttribute('r', '4');
                        setLineTooltip((prev) => ({ ...prev, visible: false }));
                      }}
                    />
                  ))}

                  {/* X Axis Labels */}
                  {lineChartData.pointsQuoted.map((pt, idx) => (
                    <text
                      key={`lbl-${idx}`}
                      x={pt.x}
                      y={lineChartData.chartHeight - lineChartData.padding + 16}
                      fill="var(--text-secondary)"
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {pt.label}
                    </text>
                  ))}
                </svg>

                {/* Floating Tooltip HTML Overlay */}
                {lineTooltip.visible && (
                  <div style={{
                    position: 'absolute',
                    left: `${(lineTooltip.x / lineChartData.chartWidth) * 100}%`,
                    top: `${(lineTooltip.y / lineChartData.chartHeight) * 100}%`,
                    transform: 'translate(-50%, -100%)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-md)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    pointerEvents: 'none',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{lineTooltip.label}</span>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.6875rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />
                        <span style={{ color: 'var(--text-muted)' }}>Revenue:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(lineTooltip.quoted)}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                        <span style={{ color: 'var(--text-muted)' }}>Collected:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(lineTooltip.paid)}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chart Legend */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--accent-primary)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Revenue (Quoted Amount)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--success)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Collections (Paid Amount)</span>
                </div>
              </div>

            </div>
          )}

          {/* Chart 2: Revenue by Branch (Bar Chart) */}
          {user?.role === 'OWNER' && revenueByBranchChart && (
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-md)',
              position: 'relative',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} style={{ color: 'var(--accent-primary)' }} />
                <span>Revenue by Branch</span>
              </h3>

              <div style={{ position: 'relative' }}>
                <svg
                  viewBox={`0 0 ${revenueByBranchChart.chartWidth} ${revenueByBranchChart.chartHeight}`}
                  width="100%"
                  height="100%"
                  style={{ overflow: 'visible' }}
                >
                  {/* Grid Lines */}
                  {revenueByBranchChart.gridLines.map((line, idx) => (
                    <g key={idx}>
                      <line
                        x1={revenueByBranchChart.padding}
                        y1={line.y}
                        x2={revenueByBranchChart.chartWidth - revenueByBranchChart.padding}
                        y2={line.y}
                        stroke="var(--border)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={revenueByBranchChart.padding - 8}
                        y={line.y + 4}
                        fill="var(--text-muted)"
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {formatCurrency(line.val)}
                      </text>
                    </g>
                  ))}

                  {/* X Axis */}
                  <line
                    x1={revenueByBranchChart.padding}
                    y1={revenueByBranchChart.chartHeight - revenueByBranchChart.padding}
                    x2={revenueByBranchChart.chartWidth - revenueByBranchChart.padding}
                    y2={revenueByBranchChart.chartHeight - revenueByBranchChart.padding}
                    stroke="var(--border)"
                    strokeWidth="1.5"
                  />

                  {/* Bars */}
                  {revenueByBranchChart.bars.map((bar, idx) => (
                    <g key={idx}>
                      <rect
                        x={bar.x}
                        y={bar.y}
                        width={bar.w}
                        height={Math.max(bar.h, 2)}
                        rx="4"
                        ry="4"
                        fill="var(--accent-primary)"
                        style={{ cursor: 'pointer', transition: 'fill 0.2s' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.setAttribute('fill', 'var(--accent-primary-hover)');
                          setBarTooltip({
                            x: bar.x + bar.w / 2,
                            y: bar.y - 8,
                            label: bar.label,
                            value: bar.value,
                            visible: true,
                          });
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.setAttribute('fill', 'var(--accent-primary)');
                          setBarTooltip((prev) => ({ ...prev, visible: false }));
                        }}
                      />
                      <text
                        x={bar.x + bar.w / 2}
                        y={revenueByBranchChart.chartHeight - revenueByBranchChart.padding + 16}
                        fill="var(--text-secondary)"
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {bar.label.length > 10 ? `${bar.label.substring(0, 8)}..` : bar.label}
                      </text>
                    </g>
                  ))}
                </svg>

                {/* Floating Tooltip HTML Overlay */}
                {barTooltip.visible && (
                  <div style={{
                    position: 'absolute',
                    left: `${(barTooltip.x / revenueByBranchChart.chartWidth) * 100}%`,
                    top: `${(barTooltip.y / revenueByBranchChart.chartHeight) * 100}%`,
                    transform: 'translate(-50%, -100%)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-md)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    pointerEvents: 'none',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}>
                    <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{barTooltip.label}</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{formatCurrency(barTooltip.value)}</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Chart 3: Collection vs Outstanding Amount (Grouped Bar Chart) */}
          {user?.role === 'OWNER' && collectionVsOutstandingChart && (
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-md)',
              position: 'relative',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Coins size={18} style={{ color: 'var(--success)' }} />
                <span>Collections vs Outstanding by Branch</span>
              </h3>

              <div style={{ position: 'relative' }}>
                <svg
                  viewBox={`0 0 ${collectionVsOutstandingChart.chartWidth} ${collectionVsOutstandingChart.chartHeight}`}
                  width="100%"
                  height="100%"
                  style={{ overflow: 'visible' }}
                >
                  {/* Grid Lines */}
                  {collectionVsOutstandingChart.gridLines.map((line, idx) => (
                    <g key={idx}>
                      <line
                        x1={collectionVsOutstandingChart.padding}
                        y1={line.y}
                        x2={collectionVsOutstandingChart.chartWidth - collectionVsOutstandingChart.padding}
                        y2={line.y}
                        stroke="var(--border)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={collectionVsOutstandingChart.padding - 8}
                        y={line.y + 4}
                        fill="var(--text-muted)"
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="end"
                      >
                        {formatCurrency(line.val)}
                      </text>
                    </g>
                  ))}

                  {/* X Axis */}
                  <line
                    x1={collectionVsOutstandingChart.padding}
                    y1={collectionVsOutstandingChart.chartHeight - collectionVsOutstandingChart.padding}
                    x2={collectionVsOutstandingChart.chartWidth - collectionVsOutstandingChart.padding}
                    y2={collectionVsOutstandingChart.chartHeight - collectionVsOutstandingChart.padding}
                    stroke="var(--border)"
                    strokeWidth="1.5"
                  />

                  {/* Grouped Bars */}
                  {collectionVsOutstandingChart.bars.map((g, idx) => (
                    <g key={idx} style={{ cursor: 'pointer' }} onMouseEnter={() => {
                      setMultiBarTooltip({
                        x: (g.paidBar.x + g.outBar.x + g.paidBar.w) / 2,
                        y: Math.min(g.paidBar.y, g.outBar.y) - 8,
                        label: g.label,
                        paid: g.paid,
                        outstanding: g.outstanding,
                        visible: true,
                      });
                    }} onMouseLeave={() => {
                      setMultiBarTooltip((prev) => ({ ...prev, visible: false }));
                    }}>
                      {/* Paid Bar (Green) */}
                      <rect
                        x={g.paidBar.x}
                        y={g.paidBar.y}
                        width={g.paidBar.w}
                        height={Math.max(g.paidBar.h, 2)}
                        rx="3"
                        ry="3"
                        fill="var(--success)"
                        opacity="0.85"
                      />

                      {/* Outstanding Bar (Yellow/Orange) */}
                      <rect
                        x={g.outBar.x}
                        y={g.outBar.y}
                        width={g.outBar.w}
                        height={Math.max(g.outBar.h, 2)}
                        rx="3"
                        ry="3"
                        fill="var(--warning)"
                        opacity="0.85"
                      />

                      <text
                        x={(g.paidBar.x + g.outBar.x + g.paidBar.w) / 2}
                        y={collectionVsOutstandingChart.chartHeight - collectionVsOutstandingChart.padding + 16}
                        fill="var(--text-secondary)"
                        fontSize="9"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {g.label.length > 10 ? `${g.label.substring(0, 8)}..` : g.label}
                      </text>
                    </g>
                  ))}
                </svg>

                {/* Floating Tooltip HTML Overlay */}
                {multiBarTooltip.visible && (
                  <div style={{
                    position: 'absolute',
                    left: `${(multiBarTooltip.x / collectionVsOutstandingChart.chartWidth) * 100}%`,
                    top: `${(multiBarTooltip.y / collectionVsOutstandingChart.chartHeight) * 100}%`,
                    transform: 'translate(-50%, -100%)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-md)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    pointerEvents: 'none',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}>
                    <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{multiBarTooltip.label}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.6875rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                        <span style={{ color: 'var(--text-muted)' }}>Paid:</span>
                        <strong style={{ color: 'var(--success)' }}>{formatCurrency(multiBarTooltip.paid)}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--warning)' }} />
                        <span style={{ color: 'var(--text-muted)' }}>Outstanding:</span>
                        <strong style={{ color: 'var(--warning)' }}>{formatCurrency(multiBarTooltip.outstanding)}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chart Legend */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--success)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Paid (Collections)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--warning)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Outstanding</span>
                </div>
              </div>

            </div>
          )}

          {/* Chart 4: Donut Chart - Payment Status Distribution */}
          {donutChartData && donutChartData.total > 0 && (
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Percent size={18} style={{ color: 'var(--accent-primary)' }} />
                <span>Payment Status Distribution</span>
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flex: 1, flexWrap: 'wrap', gap: '1rem' }}>
                
                {/* SVG Donut */}
                <div style={{ position: 'relative', width: '140px', height: '140px' }}>
                  <svg viewBox="0 0 120 120" width="100%" height="100%">
                    {/* Circle Background */}
                    <circle
                      cx="60"
                      cy="60"
                      r={donutChartData.radius}
                      fill="transparent"
                      stroke="var(--border)"
                      strokeWidth="12"
                    />

                    {/* Paid Stroke (Green) */}
                    <circle
                      cx="60"
                      cy="60"
                      r={donutChartData.radius}
                      fill="transparent"
                      stroke="var(--success)"
                      strokeWidth="12"
                      strokeDasharray={donutChartData.circum}
                      strokeDashoffset={0}
                      transform="rotate(-90 60 60)"
                      strokeLinecap="round"
                    />

                    {/* Pending Stroke (Yellow) - overlays after Paid */}
                    <circle
                      cx="60"
                      cy="60"
                      r={donutChartData.radius}
                      fill="transparent"
                      stroke="var(--warning)"
                      strokeWidth="12"
                      strokeDasharray={donutChartData.circum}
                      strokeDashoffset={donutChartData.paidCircum}
                      transform="rotate(-90 60 60)"
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Central Text */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                  }}>
                    <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-heading)', lineHeight: '1' }}>
                      {donutChartData.total}
                    </span>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>
                      Orders
                    </span>
                  </div>
                </div>

                {/* Legend & Stats Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '150px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--success)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                      <span>Paid Work Orders</span>
                    </div>
                    <div style={{ paddingLeft: '1.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <strong>{donutChartData.paid}</strong> ({donutChartData.paidPct.toFixed(1)}%)
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--warning)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--warning)' }} />
                      <span>Pending Payment</span>
                    </div>
                    <div style={{ paddingLeft: '1.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <strong>{donutChartData.pending}</strong> ({donutChartData.pendingPct.toFixed(1)}%)
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      ) : null}

      {/* Branch Performance Comparison Table */}
      {user?.role === 'OWNER' && !statsLoading && stats && stats.branchPerformance.length > 0 && (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-md)',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} style={{ color: 'var(--accent-primary)' }} />
            <span>Branch Financial Performance</span>
          </h3>

          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(111, 174, 217, 0.04)' }}>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Branch</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quoted (Revenue)</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Collected (Paid)</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Outstanding</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>Collection %</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>Paid WO</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>Pending WO</th>
                </tr>
              </thead>
              <tbody>
                {stats.branchPerformance.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: idx < stats.branchPerformance.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.branchName}</td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(item.quotedAmount)}</td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(item.paidAmount)}</td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--warning)', fontWeight: 600 }}>{formatCurrency(item.outstandingAmount)}</td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 700 }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: item.collectionPercentage >= 80 ? 'var(--success-bg)' : item.collectionPercentage >= 50 ? 'var(--warning-bg)' : 'rgba(239, 68, 68, 0.08)',
                        color: item.collectionPercentage >= 80 ? 'var(--success)' : item.collectionPercentage >= 50 ? 'var(--warning)' : 'var(--danger)',
                        fontSize: '0.75rem',
                      }}>
                        {item.collectionPercentage.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{item.paidWorkOrdersCount}</td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{item.pendingPaymentWorkOrdersCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Payment Work Orders List */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Coins size={18} style={{ color: 'var(--danger)' }} />
              <span>Pending Payment Work Orders Tracker</span>
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
              Work orders with outstanding balances created in the filtered range
            </p>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search by Patient, Doctor or Folio..."
              value={pendingSearch}
              onChange={handleSearchChange}
              className="form-input"
              style={{ paddingLeft: '2.25rem', borderRadius: '8px', fontSize: '0.875rem', width: '100%', height: '38px' }}
            />
          </div>
        </div>

        {/* Table list */}
        {pendingLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '200px', gap: '12px' }}>
            <div className="loading-spinner" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading pending work orders...</span>
          </div>
        ) : pendingWOs.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
            <Coins size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>No pending payment work orders found matching filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(111, 174, 217, 0.04)' }}>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Folio</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Patient</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Doctor/Clinic</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Branch</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quoted</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Paid</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Outstanding</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>Est. Due Date</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>WO Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWOs.map((wo, idx) => {
                    const statusLabels: Record<string, string> = {
                      CREATED: 'Created',
                      ASSIGNED: 'Assigned',
                      IN_PROGRESS: 'In Progress',
                      INTERNAL_VERIFICATION: 'Int. QC',
                      EXTERNAL_VERIFICATION: 'Ext. QC',
                      COMPLETED: 'Completed',
                      FAILED: 'Failed',
                      CANCELLED: 'Cancelled',
                    };

                    let badgeColor = 'var(--text-muted)';
                    let badgeBg = 'rgba(148, 163, 184, 0.08)';

                    if (wo.status === 'COMPLETED') {
                      badgeColor = 'var(--success)';
                      badgeBg = 'var(--success-bg)';
                    } else if (['IN_PROGRESS', 'ASSIGNED', 'CREATED'].includes(wo.status)) {
                      badgeColor = 'var(--accent-primary)';
                      badgeBg = 'rgba(111, 174, 217, 0.12)';
                    } else if (['INTERNAL_VERIFICATION', 'EXTERNAL_VERIFICATION'].includes(wo.status)) {
                      badgeColor = 'var(--warning)';
                      badgeBg = 'var(--warning-bg)';
                    } else if (wo.status === 'FAILED') {
                      badgeColor = 'var(--danger)';
                      badgeBg = 'var(--danger-bg)';
                    }

                    return (
                      <tr key={wo.id} style={{ borderBottom: idx < pendingWOs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {wo.folioNumber}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {wo.patient}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)' }}>
                          <div style={{ fontWeight: 500 }}>{wo.doctorName}</div>
                          {wo.clinicName && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{wo.clinicName}</div>}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                          {wo.branchName}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          {formatCurrency(wo.totalQuote)}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--success)', fontWeight: 600 }}>
                          {formatCurrency(wo.initialPayment)}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--danger)', fontWeight: 700 }}>
                          {formatCurrency(wo.outstandingAmount)}
                        </td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                          {new Date(wo.dueDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '100px',
                            backgroundColor: badgeBg,
                            color: badgeColor,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            display: 'inline-block',
                          }}>
                            {statusLabels[wo.status] || wo.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            {pendingTotal > pendingLimit && (
              <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Showing <strong>{((pendingPage - 1) * pendingLimit) + 1}</strong> to <strong>{Math.min(pendingPage * pendingLimit, pendingTotal)}</strong> of <strong>{pendingTotal}</strong> pending work orders
                </span>
                
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    disabled={pendingPage === 1}
                    onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      cursor: pendingPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: pendingPage === 1 ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {[...Array(Math.ceil(pendingTotal / pendingLimit))].map((_, idx) => {
                    const pageNum = idx + 1;
                    const isCur = pageNum === pendingPage;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPendingPage(pageNum)}
                        style={{
                          border: isCur ? '1.5px solid var(--accent-primary)' : '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          backgroundColor: isCur ? 'var(--accent-primary)' : 'var(--bg-surface)',
                          color: isCur ? '#fff' : 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    disabled={pendingPage >= Math.ceil(pendingTotal / pendingLimit)}
                    onClick={() => setPendingPage(p => Math.min(Math.ceil(pendingTotal / pendingLimit), p + 1))}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      cursor: pendingPage >= Math.ceil(pendingTotal / pendingLimit) ? 'not-allowed' : 'pointer',
                      opacity: pendingPage >= Math.ceil(pendingTotal / pendingLimit) ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
}

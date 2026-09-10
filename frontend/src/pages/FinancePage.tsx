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
  Users,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { financeService, branchService, workOrderService } from '../services';
import type {
  FinanceStats,
  PendingPaymentWorkOrder,
  DoctorBalanceItem,
  DoctorBalanceWorkOrder,
} from '../services';
import { useAuth } from '../context';
import { DateRangePicker } from '../components';

interface PaymentHistoryItem {
  amount: number;
  notes?: string;
  date: string;
}

const parseNotesAndPayments = (notesString: string | null | undefined): { userNotes: string; payments: PaymentHistoryItem[] } => {
  if (!notesString) return { userNotes: '', payments: [] };
  const startTag = '<!-- PAYMENTS_START -->';
  const endTag = '<!-- PAYMENTS_END -->';
  const startIndex = notesString.indexOf(startTag);
  const endIndex = notesString.indexOf(endTag);
  if (startIndex !== -1 && endIndex !== -1) {
    const userNotes = notesString.substring(0, startIndex).trim();
    const jsonStr = notesString.substring(startIndex + startTag.length, endIndex).trim();
    try {
      const payments = JSON.parse(jsonStr);
      return { userNotes, payments: Array.isArray(payments) ? payments : [] };
    } catch {
      return { userNotes, payments: [] };
    }
  }
  return { userNotes: notesString.trim(), payments: [] };
};

const stringifyNotesAndPayments = (userNotes: string, payments: PaymentHistoryItem[]): string => {
  const cleanedNotes = userNotes.trim();
  if (payments.length === 0) return cleanedNotes;
  return `${cleanedNotes}\n\n<!-- PAYMENTS_START -->${JSON.stringify(payments)}<!-- PAYMENTS_END -->`;
};

interface BranchItem {
  id: string;
  name: string;
  code: string;
}

export function FinancePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  // --- Active Tab: Overview vs Doctor Balances ---
  const [activeFinanceTab, setActiveFinanceTab] = useState<'OVERVIEW' | 'DOCTOR_BALANCES'>('OVERVIEW');

  // --- State Variables ---
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]); // Empty means ALL

  const [startDateFilter, setStartDateFilter] = useState<string>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const day = String(start.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [endDateFilter, setEndDateFilter] = useState<string>(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const year = end.getFullYear();
    const month = String(end.getMonth() + 1).padStart(2, '0');
    const day = String(end.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [datePreset, setDatePreset] = useState<string>('thisMonth');

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

  // Doctor Balances list & summary
  const [doctorBalances, setDoctorBalances] = useState<DoctorBalanceItem[]>([]);
  const [doctorBalancesSummary, setDoctorBalancesSummary] = useState<{
    totalOutstanding: number;
    totalQuoted: number;
    totalPaid: number;
    totalDoctorsWithPending: number;
    totalDoctors: number;
  } | null>(null);
  const [doctorBalancesLoading, setDoctorBalancesLoading] = useState(false);
  const [doctorBalancesSearch, setDoctorBalancesSearch] = useState('');
  const [onlyWithPendingFilter, setOnlyWithPendingFilter] = useState(false);

  // Doctor Statement Modal
  const [selectedDoctorStatement, setSelectedDoctorStatement] = useState<DoctorBalanceItem | null>(null);
  const [statementTab, setStatementTab] = useState<'UNPAID' | 'ALL'>('UNPAID');
  const [statementProcessingId, setStatementProcessingId] = useState<string | null>(null);

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
    const [sYear, sMonth, sDay] = startDateFilter.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);

    const [eYear, eMonth, eDay] = endDateFilter.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [startDateFilter, endDateFilter]);

  // --- Fetch Initial Data ---
  useEffect(() => {
    if (user?.role !== 'OWNER') return;

    branchService.getAll()
      .then((data) => {
        setBranches(data.map(b => ({ id: b.id, name: b.name, code: b.code })));
      })
      .catch((err) => {
        console.error('Failed to load branches', err);
        toast.error(t('branches.failedLoad', { defaultValue: 'Failed to load branches' }));
      });
  }, [user?.role, t]);

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
      toast.error(t('finance.failedLoadStats', { defaultValue: 'Failed to load financial statistics' }));
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
      toast.error(t('finance.failedLoadPending', { defaultValue: 'Failed to load pending payments list' }));
    } finally {
      setPendingLoading(false);
    }
  };

  const fetchDoctorBalances = async () => {
    setDoctorBalancesLoading(true);
    try {
      const branchIdsParam = selectedBranches.length > 0 ? selectedBranches.join(',') : 'ALL';
      const res = await financeService.getDoctorBalances({
        branchIds: branchIdsParam,
        search: doctorBalancesSearch,
        onlyWithPending: onlyWithPendingFilter,
      });
      setDoctorBalances(res.data);
      setDoctorBalancesSummary(res.summary);
    } catch (err) {
      console.error('Failed to load doctor balances', err);
      toast.error(t('financePage.failedLoad', { defaultValue: 'Failed to load doctor balances' }));
    } finally {
      setDoctorBalancesLoading(false);
    }
  };

  const handleStatementMarkAsPaid = async (wo: DoctorBalanceWorkOrder) => {
    try {
      setStatementProcessingId(wo.id);
      const { userNotes, payments } = parseNotesAndPayments('');
      const newPayments = [
        ...payments,
        {
          amount: wo.balance,
          notes: 'Full payment settlement from doctor statement',
          date: new Date().toISOString(),
        },
      ];
      const serializedNotes = stringifyNotesAndPayments(userNotes, newPayments);

      await workOrderService.update(wo.id, {
        initialPayment: wo.totalQuote,
        notes: serializedNotes,
      });

      toast.success(t('workOrders.markAsPaidSuccess'));
      fetchDoctorBalances();
      fetchData();
      fetchPendingPayments();

      setSelectedDoctorStatement((prev) => {
        if (!prev) return null;
        const updatedAll = prev.allWorkOrders.map((w) =>
          w.id === wo.id ? { ...w, initialPayment: w.totalQuote, balance: 0, isPaid: true } : w,
        );
        const updatedPending = prev.pendingWorkOrders.filter((w) => w.id !== wo.id);
        const newPaid = prev.totalPaid + wo.balance;
        const newPending = Math.max(0, prev.totalQuoted - newPaid);
        return {
          ...prev,
          totalPaid: newPaid,
          pendingBalance: newPending,
          paidOrdersCount: prev.paidOrdersCount + 1,
          unpaidOrdersCount: Math.max(0, prev.unpaidOrdersCount - 1),
          allWorkOrders: updatedAll,
          pendingWorkOrders: updatedPending,
        };
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('workOrders.markAsPaidError'));
    } finally {
      setStatementProcessingId(null);
    }
  };

  // Trigger fetch when parameters change
  useEffect(() => {
    fetchData();
  }, [dateRange, selectedBranches]);

  useEffect(() => {
    fetchPendingPayments();
  }, [dateRange, selectedBranches, pendingPage, pendingSearch]);

  useEffect(() => {
    fetchDoctorBalances();
  }, [selectedBranches, doctorBalancesSearch, onlyWithPendingFilter]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingSearch(e.target.value);
    setPendingPage(1);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(i18n.language?.startsWith('es') ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: i18n.language?.startsWith('es') ? 'MXN' : 'MXN',
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
            <span>{t('finance.overviewTitle', { defaultValue: 'Finance Overview' })}</span>
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
            {t('finance.overviewSubtitle', { defaultValue: 'Lab financial health, collections efficiency, and branch revenue summaries' })}
          </p>
        </div>

        {/* Filters Group */}
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          
          {/* Branch Filter Dropdown */}
          {user?.role === 'OWNER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t('common.branch', { defaultValue: 'Branch' })}:</span>
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
                    height: '38px',
                  }}
                >
                  <Building2 size={16} />
                  <span>
                    {selectedBranches.length === 0
                      ? t('common.allBranches')
                      : selectedBranches.length === 1
                      ? branches.find(b => b.id === selectedBranches[0])?.name || t('branches.oneSelected', { defaultValue: '1 Branch' })
                      : t('branches.nSelected', { count: selectedBranches.length, defaultValue: `${selectedBranches.length} Branches` })}
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
                      title={t('branches.clearFilter', { defaultValue: 'Clear branch filter' })}
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
                        {t('common.allBranches')}
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
            </div>
          )}

          {/* Date Range Picker */}
          <DateRangePicker
            startDate={startDateFilter}
            endDate={endDateFilter}
            presetType={datePreset}
            allowedPresets={['thisMonth', 'lastMonth', 'last3Months', 'last6Months', 'thisYear', 'custom']}
            onChange={(start, end, preset) => {
              setStartDateFilter(start);
              setEndDateFilter(end);
              setDatePreset(preset);
            }}
          />

        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeFinanceTab === 'OVERVIEW' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveFinanceTab('OVERVIEW')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '10px' }}
        >
          <TrendingUp size={16} />
          <span>{t('finance.overviewTab', { defaultValue: 'Overview' })}</span>
        </button>
        <button
          className={`btn ${activeFinanceTab === 'DOCTOR_BALANCES' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => {
            setActiveFinanceTab('DOCTOR_BALANCES');
            fetchDoctorBalances();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '10px', position: 'relative' }}
        >
          <Users size={16} />
          <span>{t('finance.doctorBalancesTab', { defaultValue: 'Doctor & Clinic Balances' })}</span>
          {doctorBalancesSummary && doctorBalancesSummary.totalDoctorsWithPending > 0 && (
            <span style={{
              backgroundColor: activeFinanceTab === 'DOCTOR_BALANCES' ? 'rgba(255, 255, 255, 0.25)' : 'var(--danger)',
              color: '#FFFFFF',
              fontSize: '0.6875rem',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: '10px',
            }}>
              {doctorBalancesSummary.totalDoctorsWithPending}
            </span>
          )}
        </button>
      </div>

      {activeFinanceTab === 'OVERVIEW' && (
        <>
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('finance.totalRevenue', { defaultValue: 'Total Revenue' })}</span>
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('finance.totalCollected', { defaultValue: 'Total Collected' })}</span>
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('finance.outstanding', { defaultValue: 'Outstanding' })}</span>
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('finance.collectionPercentage', { defaultValue: 'Collection %' })}</span>
              <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                {stats.summary.collectionPercentage.toFixed(1)}%
              </h3>
            </div>
          </div>



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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('finance.pendingPayments', { defaultValue: 'Pending Payments' })}</span>
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
                <span>{t('finance.monthlyTrendTitle', { defaultValue: 'Monthly Revenue & Collections Trend' })}</span>
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
                        <span style={{ color: 'var(--text-muted)' }}>{t('finance.revenue', { defaultValue: 'Revenue' })}:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(lineTooltip.quoted)}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                        <span style={{ color: 'var(--text-muted)' }}>{t('finance.collected', { defaultValue: 'Collected' })}:</span>
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
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('finance.revenueQuotedDesc', { defaultValue: 'Revenue (Quoted Amount)' })}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--success)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('finance.collectionsPaidDesc', { defaultValue: 'Collections (Paid Amount)' })}</span>
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
                <span>{t('finance.revenueByBranch', { defaultValue: 'Revenue by Branch' })}</span>
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
                <span>{t('finance.collectionVsOutstandingByBranch', { defaultValue: 'Collections vs Outstanding by Branch' })}</span>
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
                        <span style={{ color: 'var(--text-muted)' }}>{t('common.paid', { defaultValue: 'Paid' })}:</span>
                        <strong style={{ color: 'var(--success)' }}>{formatCurrency(multiBarTooltip.paid)}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--warning)' }} />
                        <span style={{ color: 'var(--text-muted)' }}>{t('finance.outstanding', { defaultValue: 'Outstanding' })}:</span>
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
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('finance.paidCollections', { defaultValue: 'Paid (Collections)' })}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--warning)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('finance.outstanding')}</span>
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
                <span>{t('finance.paymentStatusDistribution', { defaultValue: 'Payment Status Distribution' })}</span>
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
                      {t('finance.orders', { defaultValue: 'Orders' })}
                    </span>
                  </div>
                </div>

                {/* Legend & Stats Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '150px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--success)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                      <span>{t('finance.paidWorkOrders', { defaultValue: 'Paid Work Orders' })}</span>
                    </div>
                    <div style={{ paddingLeft: '1.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <strong>{donutChartData.paid}</strong> ({donutChartData.paidPct.toFixed(1)}%)
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--warning)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--warning)' }} />
                      <span>{t('finance.pendingPayment', { defaultValue: 'Pending Payment' })}</span>
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
            <span>{t('finance.branchPerformance', { defaultValue: 'Branch Financial Performance' })}</span>
          </h3>

          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(111, 174, 217, 0.04)' }}>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('common.branch')}</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('finance.quotedRevenue', { defaultValue: 'Quoted (Revenue)' })}</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('finance.collectedPaid', { defaultValue: 'Collected (Paid)' })}</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('finance.outstanding')}</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{t('finance.collectionPercentage')}</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{t('finance.paidWO', { defaultValue: 'Paid WO' })}</th>
                  <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{t('finance.pendingWO', { defaultValue: 'Pending WO' })}</th>
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
              <span>{t('finance.pendingTrackerTitle', { defaultValue: 'Pending Payment Work Orders Tracker' })}</span>
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
              {t('finance.pendingTrackerSubtitle', { defaultValue: 'Work orders with outstanding balances created in the filtered range' })}
            </p>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder={t('finance.searchPendingPlaceholder', { defaultValue: 'Search by Patient, Doctor or Folio...' })}
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
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('finance.loadingPending', { defaultValue: 'Loading pending work orders...' })}</span>
          </div>
        ) : pendingWOs.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
            <Coins size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>{t('finance.noPendingWOs', { defaultValue: 'No pending payment work orders found matching filters.' })}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(111, 174, 217, 0.04)' }}>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('workOrders.folio')}</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('workOrders.patient')}</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('workOrders.doctorClinic', { defaultValue: 'Doctor/Clinic' })}</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('common.branch')}</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('finance.quoted', { defaultValue: 'Quoted' })}</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('common.paid')}</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('finance.outstanding')}</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('workOrders.estDueDate', { defaultValue: 'Est. Due Date' })}</th>
                    <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('workOrders.status', { defaultValue: 'WO Status' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWOs.map((wo, idx) => {
                    const statusLabels: Record<string, string> = {
                      CREATED: t('enums.workOrderStatus.CREATED'),
                      ASSIGNED: t('enums.workOrderStatus.ASSIGNED'),
                      IN_PROGRESS: t('enums.workOrderStatus.IN_PROGRESS'),
                      INTERNAL_VERIFICATION: t('enums.workOrderStatus.INTERNAL_VERIFICATION'),
                      EXTERNAL_VERIFICATION: t('enums.workOrderStatus.EXTERNAL_VERIFICATION'),
                      COMPLETED: t('enums.workOrderStatus.COMPLETED'),
                      FAILED: t('enums.workOrderStatus.FAILED'),
                      CANCELLED: t('enums.workOrderStatus.CANCELLED'),
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
                          {new Date(wo.dueDate).toLocaleDateString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-US', {
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginTop: '0.5rem', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', justifySelf: 'start' }}>
                  {t('finance.showingPendingRange', { start: ((pendingPage - 1) * pendingLimit) + 1, end: Math.min(pendingPage * pendingLimit, pendingTotal), total: pendingTotal, defaultValue: `Showing ${((pendingPage - 1) * pendingLimit) + 1} to ${Math.min(pendingPage * pendingLimit, pendingTotal)} of ${pendingTotal} pending work orders` })}
                </span>
                
                <div style={{ display: 'flex', gap: '0.25rem', justifySelf: 'center' }}>
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
                <div style={{ justifySelf: 'end' }} />
              </div>
            )}

          </div>
        )}
      </div>
        </>
      )}

      {/* DOCTOR & CLINIC BALANCES TAB */}
      {activeFinanceTab === 'DOCTOR_BALANCES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          {/* Doctor Balances KPI Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {/* Card 1: Total Outstanding */}
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
                <AlertCircle size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('finance.totalOutstandingBal', { defaultValue: 'Total Outstanding Balance' })}
                </span>
                <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--danger)', margin: '2px 0 0 0' }}>
                  {formatCurrency(doctorBalancesSummary?.totalOutstanding || 0)}
                </h3>
              </div>
            </div>

            {/* Card 2: Doctors with Pending Balance */}
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
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D97706',
              }}>
                <Users size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('finance.debtorDoctors', { defaultValue: 'Doctors with Pending Balance' })}
                </span>
                <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                  {doctorBalancesSummary?.totalDoctorsWithPending || 0} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {doctorBalancesSummary?.totalDoctors || 0}</span>
                </h3>
              </div>
            </div>

            {/* Card 3: Total Quoted */}
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
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('finance.quotedRevenue', { defaultValue: 'Quoted (Revenue)' })}
                </span>
                <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                  {formatCurrency(doctorBalancesSummary?.totalQuoted || 0)}
                </h3>
              </div>
            </div>

            {/* Card 4: Total Collected */}
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
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('finance.totalCollected', { defaultValue: 'Total Collected' })}
                </span>
                <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                  {formatCurrency(doctorBalancesSummary?.totalPaid || 0)}
                </h3>
              </div>
            </div>
          </div>

          {/* Doctor & Clinic Accounts Receivable Table */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-md)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={20} style={{ color: 'var(--accent-primary)' }} />
                  <span>{t('finance.doctorBalances', { defaultValue: 'Doctor & Clinic Balances' })}</span>
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                  {t('finance.doctorBalancesSubtitle', { defaultValue: 'Accounts receivable and pending payment balances by doctor & clinic' })}
                </p>
              </div>

              {/* Search and Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '280px' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder={t('finance.searchDoctorOrClinic', { defaultValue: 'Search doctor or clinic...' })}
                    value={doctorBalancesSearch}
                    onChange={(e) => setDoctorBalancesSearch(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '2.25rem', borderRadius: '8px', fontSize: '0.875rem', width: '100%', height: '38px' }}
                  />
                  {doctorBalancesSearch && (
                    <button
                      onClick={() => setDoctorBalancesSearch('')}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Only with Pending Toggle */}
                <button
                  className={`btn ${onlyWithPendingFilter ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setOnlyWithPendingFilter(!onlyWithPendingFilter)}
                  style={{ height: '38px', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Coins size={15} />
                  <span>{t('finance.onlyWithPending', { defaultValue: 'Only with Pending Balance' })}</span>
                </button>
              </div>
            </div>

            {/* Table */}
            {doctorBalancesLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '220px', gap: '12px' }}>
                <div className="loading-spinner" />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('common.loading')}</span>
              </div>
            ) : doctorBalances.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                <Users size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>
                  {t('finance.noDoctorBalancesFound', { defaultValue: 'No doctor balance records found matching filters.' })}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(111, 174, 217, 0.04)' }}>
                      <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('workOrders.doctor')}</th>
                      <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('doctors.clinic')}</th>
                      {user?.role === 'OWNER' && (
                        <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('common.branch')}</th>
                      )}
                      <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{t('finance.totalOrders', { defaultValue: 'Total Orders' })}</th>
                      <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('finance.quoted')}</th>
                      <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('finance.collected')}</th>
                      <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 700 }}>{t('finance.outstanding')}</th>
                      <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{t('common.status')}</th>
                      <th style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctorBalances.map((doc, idx) => {
                      const hasBalance = doc.pendingBalance > 0;
                      return (
                        <tr key={doc.doctorId} style={{ borderBottom: idx < doctorBalances.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{doc.doctorName}</div>
                            {doc.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doc.phone}</div>}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                            {doc.clinicName ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Building2 size={14} style={{ color: 'var(--text-muted)' }} />
                                <span>{doc.clinicName}</span>
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          {user?.role === 'OWNER' && (
                            <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                              {doc.branchName}
                            </td>
                          )}
                          <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(148, 163, 184, 0.1)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}>
                              {doc.totalOrders}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {formatCurrency(doc.totalQuoted)}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--success)', fontWeight: 600 }}>
                            {formatCurrency(doc.totalPaid)}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 800, fontSize: '0.9375rem', color: hasBalance ? 'var(--danger)' : 'var(--success)' }}>
                            {hasBalance ? formatCurrency(doc.pendingBalance) : formatCurrency(0)}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                            {hasBalance ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#D97706',
                                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                whiteSpace: 'nowrap',
                              }}>
                                {doc.unpaidOrdersCount} {t('workOrders.pending')}
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: 'var(--success)',
                                backgroundColor: 'var(--success-bg)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                whiteSpace: 'nowrap',
                              }}>
                                <Check size={12} strokeWidth={2.5} />
                                {t('financePage.settled', { defaultValue: 'Settled' })}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                            <button
                              className="btn btn--outline btn--sm"
                              onClick={() => {
                                setSelectedDoctorStatement(doc);
                                setStatementTab(doc.pendingBalance > 0 ? 'UNPAID' : 'ALL');
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            >
                              <FileText size={14} />
                              <span>{t('finance.viewStatement', { defaultValue: 'View Orders' })}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DOCTOR STATEMENT MODAL */}
      {selectedDoctorStatement && (
        <div className="modal-overlay" onClick={() => setSelectedDoctorStatement(null)}>
          <div className="modal" style={{ maxWidth: '840px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="modal__title" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={20} style={{ color: 'var(--accent-primary)' }} />
                  <span>{selectedDoctorStatement.doctorName}</span>
                </h3>
                {selectedDoctorStatement.clinicName && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {selectedDoctorStatement.clinicName}
                  </p>
                )}
              </div>
              <button
                className="btn-close"
                onClick={() => setSelectedDoctorStatement(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal__body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Financial Balance Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                backgroundColor: 'var(--bg-overlay, rgba(148, 163, 184, 0.06))',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '1rem',
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('finance.quotedRevenue', { defaultValue: 'Total Quoted' })}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(selectedDoctorStatement.totalQuoted)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{t('finance.totalCollected', { defaultValue: 'Total Collected' })}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(selectedDoctorStatement.totalPaid)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>{t('finance.totalOutstandingBal', { defaultValue: 'Outstanding Balance' })}</div>
                  <div style={{ fontSize: '1.375rem', fontWeight: 900, color: selectedDoctorStatement.pendingBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {formatCurrency(selectedDoctorStatement.pendingBalance)}
                  </div>
                </div>
              </div>

              {/* Tabs inside modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={`btn btn--sm ${statementTab === 'UNPAID' ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => setStatementTab('UNPAID')}
                  >
                    <span>{t('workOrders.pending')} ({selectedDoctorStatement.unpaidOrdersCount})</span>
                  </button>
                  <button
                    className={`btn btn--sm ${statementTab === 'ALL' ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => setStatementTab('ALL')}
                  >
                    <span>{t('common.all')} ({selectedDoctorStatement.totalOrders})</span>
                  </button>
                </div>
              </div>

              {/* Work Orders Statement List */}
              {(() => {
                const listToDisplay = statementTab === 'UNPAID' ? selectedDoctorStatement.pendingWorkOrders : selectedDoctorStatement.allWorkOrders;
                if (listToDisplay.length === 0) {
                  return (
                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '10px', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={32} style={{ color: 'var(--success)', marginBottom: '0.5rem' }} />
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                        {t('finance.noPendingWOs', { defaultValue: 'No work orders with pending balance.' })}
                      </p>
                    </div>
                  );
                }
                return (
                  <div style={{ maxHeight: '380px', overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-surface)', zIndex: 10 }}>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{t('workOrders.folio')}</th>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{t('workOrders.patient')}</th>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{t('finance.quoted')}</th>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{t('finance.collected')}</th>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 700 }}>{t('finance.outstanding')}</th>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', textAlign: 'right' }}>{t('common.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listToDisplay.map((wo, i) => (
                          <tr key={wo.id} style={{ borderBottom: i < listToDisplay.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700 }}>{wo.folioNumber}</td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{wo.patient || '—'}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{formatCurrency(wo.totalQuote)}</td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(wo.initialPayment)}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: wo.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                              {formatCurrency(wo.balance)}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              {wo.balance > 0 ? (
                                <button
                                  className="btn btn--sm"
                                  style={{
                                    backgroundColor: 'var(--success, #10B981)',
                                    color: '#ffffff',
                                    fontSize: '0.75rem',
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  onClick={() => handleStatementMarkAsPaid(wo)}
                                  disabled={statementProcessingId === wo.id}
                                >
                                  {statementProcessingId === wo.id ? (
                                    <><Loader2 size={12} className="spinner" /><span>{t('common.saving')}</span></>
                                  ) : (
                                    <><CreditCard size={12} /><span>{t('workOrders.markAsPaid')}</span></>
                                  )}
                                </button>
                              ) : (
                                <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Check size={12} strokeWidth={2.5} /> {t('financePage.settled', { defaultValue: 'Settled' })}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

            </div>

            <div className="modal__footer" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setSelectedDoctorStatement(null)}
              >
                {t('common.close', { defaultValue: 'Close' })}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

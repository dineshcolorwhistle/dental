import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Trash2,
  Phone,
  Mail,
  User,
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  MessageSquare,
  Eye,
  AlertCircle,
  RefreshCw,
  X,
  Send,
  Heart,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { interestRequestService } from '../services';
import type { InterestRequestItem } from '../services';

const STATUS_TABS = ['ALL', 'PENDING', 'CONTACTED', 'CONVERTED', 'DISCARDED'] as const;

const STATUS_BADGE: Record<string, { color: string; bg: string }> = {
  PENDING: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  CONTACTED: { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  CONVERTED: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  DISCARDED: { color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)' },
};

export function InterestRequestsPage() {
  const { t, i18n } = useTranslation();
  const [requests, setRequests] = useState<InterestRequestItem[]>([]);
  const [allRequests, setAllRequests] = useState<InterestRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Detail Modal state
  const [selectedLead, setSelectedLead] = useState<InterestRequestItem | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<InterestRequestItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch all requests for stats
      const allData = await interestRequestService.getAll();
      setAllRequests(allData);

      // Fetch filtered requests for current table
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const filteredData = await interestRequestService.getAll(params);
      setRequests(filteredData);
    } catch (err: any) {
      console.error('Failed to fetch interest requests', err);
      const msg = err?.response?.data?.message || t('errors.fetchFailed', { defaultValue: 'Failed to load data.' });
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await interestRequestService.updateStatus(id, newStatus);
      toast.success(t('interestRequests.statusUpdated'));
      if (selectedLead && selectedLead.id === id) {
        setSelectedLead({ ...selectedLead, status: newStatus as any });
      }
      fetchData();
    } catch {
      toast.error(t('errors.updateFailed', { defaultValue: 'Failed to update status.' }));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await interestRequestService.remove(deleteTarget.id);
      toast.success(t('interestRequests.deleteSuccess'));
      setDeleteTarget(null);
      if (selectedLead && selectedLead.id === deleteTarget.id) {
        setSelectedLead(null);
      }
      fetchData();
    } catch {
      toast.error(t('errors.deleteFailed', { defaultValue: 'Failed to delete.' }));
    } finally {
      setDeleting(false);
    }
  };

  // Stats calculation
  const totalCount = allRequests.length;
  const pendingCount = allRequests.filter((r) => r.status === 'PENDING').length;
  const contactedCount = allRequests.filter((r) => r.status === 'CONTACTED').length;
  const convertedCount = allRequests.filter((r) => r.status === 'CONVERTED').length;
  const discardedCount = allRequests.filter((r) => r.status === 'DISCARDED').length;

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'ALL': return totalCount;
      case 'PENDING': return pendingCount;
      case 'CONTACTED': return contactedCount;
      case 'CONVERTED': return convertedCount;
      case 'DISCARDED': return discardedCount;
      default: return 0;
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="page-header__left">
          <h1 className="page-header__title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Heart size={24} style={{ color: 'var(--accent-primary)' }} />
            <span>{t('interestRequests.title')}</span>
          </h1>
          <p className="page-header__subtitle">{t('interestRequests.subtitle')}</p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <StatCard
          title={t('interestRequests.statsTotal')}
          count={totalCount}
          icon={<MessageSquare size={20} style={{ color: 'var(--accent-primary)' }} />}
          color="var(--accent-primary)"
        />
        <StatCard
          title={t('interestRequests.statsPending')}
          count={pendingCount}
          icon={<Clock size={20} style={{ color: '#F59E0B' }} />}
          color="#F59E0B"
        />
        <StatCard
          title={t('interestRequests.statsContacted')}
          count={contactedCount}
          icon={<Phone size={20} style={{ color: '#3B82F6' }} />}
          color="#3B82F6"
        />
        <StatCard
          title={t('interestRequests.statsConverted')}
          count={convertedCount}
          icon={<CheckCircle2 size={20} style={{ color: '#10B981' }} />}
          color="#10B981"
        />
      </div>

      {/* Control Bar: Search & Filter Tabs */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem',
        }}>
          {/* Filter Tabs */}
          <div style={{
            display: 'flex', gap: '0.4rem', flexWrap: 'wrap',
            backgroundColor: 'var(--bg-overlay, rgba(148, 163, 184, 0.06))',
            padding: '4px', borderRadius: '12px',
            border: '1px solid var(--border)',
          }}>
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab;
              const count = getTabCount(tab);
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: active ? 700 : 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    boxShadow: active ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span>{t(`interestRequests.filter${tab.charAt(0) + tab.slice(1).toLowerCase()}`)}</span>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 800, padding: '1px 6px',
                    borderRadius: '10px',
                    backgroundColor: active ? 'rgba(111, 174, 217, 0.15)' : 'rgba(148, 163, 184, 0.12)',
                    color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Field */}
          <div style={{
            position: 'relative', width: '100%', maxWidth: '340px',
          }}>
            <Search size={16} style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              placeholder={t('interestRequests.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '0.55rem 2.25rem 0.55rem 2.25rem',
                borderRadius: '10px', border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-overlay, rgba(15, 23, 42, 0.2))',
                color: 'var(--text-primary)', fontSize: '0.8125rem',
                outline: 'none', transition: 'border-color 0.2s',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table / State Container */}
      {loading ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '4rem 2rem', backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)', borderRadius: '16px',
        }}>
          <Loader2 size={40} className="spinner" style={{ color: 'var(--accent-primary)' }} />
          <span style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {t('common.loading')}
          </span>
        </div>
      ) : errorMsg ? (
        /* Error Banner */
        <div style={{
          padding: '2rem', textAlign: 'center',
          backgroundColor: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '16px', color: 'var(--danger)',
        }}>
          <AlertCircle size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.8 }} />
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700 }}>
            {errorMsg}
          </h3>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Please check permissions or network connection.
          </p>
          <button
            className="btn btn--outline btn--sm"
            onClick={fetchData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} />
            <span>{t('interestRequests.retry')}</span>
          </button>
        </div>
      ) : requests.length === 0 ? (
        /* Empty State */
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border)',
          borderRadius: '16px', color: 'var(--text-muted)',
        }}>
          <MessageSquare size={44} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
            {t('interestRequests.noResults')}
          </h3>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            New inquiries submitted from public QR tracking pages will appear here.
          </p>
        </div>
      ) : (
        /* Data Table */
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" id="interest-requests-table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.875rem 1.25rem' }}>{t('interestRequests.name')}</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>{t('interestRequests.email')}</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>{t('interestRequests.phone')}</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>{t('interestRequests.workOrder')}</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>{t('interestRequests.lab')}</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>{t('interestRequests.date')}</th>
                  <th style={{ padding: '0.875rem 1.25rem' }}>{t('interestRequests.status')}</th>
                  <th style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>{t('interestRequests.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const badge = STATUS_BADGE[req.status] || STATUS_BADGE.PENDING;
                  const initials = req.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

                  return (
                    <tr key={req.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLead(req)}>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(111, 174, 217, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)',
                            border: '1px solid rgba(111, 174, 217, 0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: '0.75rem', color: 'var(--accent-primary)',
                            flexShrink: 0,
                          }}>
                            {initials || <User size={14} />}
                          </div>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                              {req.name}
                            </span>
                            {req.notes && (
                              <span
                                style={{
                                  display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)',
                                  maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}
                                title={req.notes}
                              >
                                {req.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <a
                          href={`mailto:${req.email}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '0.8125rem', color: 'var(--text-secondary)',
                            textDecoration: 'none',
                          }}
                        >
                          <Mail size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          {req.email}
                        </a>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <a
                          href={`tel:${req.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '0.8125rem', color: 'var(--text-secondary)',
                            textDecoration: 'none',
                          }}
                        >
                          <Phone size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          {req.phone}
                        </a>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        {req.workOrder ? (
                          <div>
                            <span style={{
                              fontWeight: 700, fontSize: '0.8125rem', color: 'var(--accent-primary)',
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '2px 8px', borderRadius: '6px',
                              backgroundColor: 'rgba(111, 174, 217, 0.1)',
                              border: '1px solid rgba(111, 174, 217, 0.2)',
                              fontFamily: 'monospace',
                            }}>
                              <FileText size={12} />
                              {req.workOrder.folioNumber}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {req.workOrder.patient}
                              {req.workOrder.doctor && ` • ${req.workOrder.doctor.name}`}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          <Building2 size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          {req.tenant.name}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          <Calendar size={13} style={{ flexShrink: 0 }} />
                          {new Date(req.createdAt).toLocaleDateString(
                            i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
                            { day: 'numeric', month: 'short', year: 'numeric' },
                          )}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          fontSize: '0.71875rem', fontWeight: 700, padding: '4px 10px',
                          borderRadius: '16px', color: badge.color, backgroundColor: badge.bg,
                          border: `1px solid ${badge.color}30`,
                        }}>
                          {req.status === 'PENDING' && <Clock size={11} />}
                          {req.status === 'CONTACTED' && <Phone size={11} />}
                          {req.status === 'CONVERTED' && <CheckCircle2 size={11} />}
                          {req.status === 'DISCARDED' && <XCircle size={11} />}
                          {t(`interestRequests.status${req.status.charAt(0) + req.status.slice(1).toLowerCase()}`)}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn--ghost btn--sm"
                            style={{ padding: '4px 8px' }}
                            onClick={() => setSelectedLead(req)}
                            title={t('interestRequests.viewDetails')}
                          >
                            <Eye size={14} />
                          </button>
                          {req.status === 'PENDING' && (
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ padding: '4px 8px', color: '#3B82F6' }}
                              onClick={() => handleStatusUpdate(req.id, 'CONTACTED')}
                              title={t('interestRequests.markContacted')}
                            >
                              <Phone size={14} />
                            </button>
                          )}
                          {(req.status === 'PENDING' || req.status === 'CONTACTED') && (
                            <button
                              className="btn btn--ghost btn--sm"
                              style={{ padding: '4px 8px', color: '#10B981' }}
                              onClick={() => handleStatusUpdate(req.id, 'CONVERTED')}
                              title={t('interestRequests.markConverted')}
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          <button
                            className="btn btn--ghost btn--sm"
                            style={{ padding: '4px 8px', color: 'var(--danger)' }}
                            onClick={() => setDeleteTarget(req)}
                            title={t('common.delete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          Lead Detail Slide-Out Modal
         ═══════════════════════════════════════════════════════ */}
      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)} style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '520px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal__header">
              <h3 className="modal__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} style={{ color: 'var(--accent-primary)' }} />
                {t('interestRequests.leadDetails')}
              </h3>
              <button className="modal__close" onClick={() => setSelectedLead(null)} aria-label={t('common.close')}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="modal__body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Contact Info Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem', borderRadius: '12px',
                backgroundColor: 'var(--bg-overlay, rgba(148, 163, 184, 0.06))',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6FAED9, #3B82F6)',
                  color: '#fff', fontWeight: 800, fontSize: '1.125rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {selectedLead.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                    {selectedLead.name}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Submitted on {new Date(selectedLead.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Contact Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="btn btn--outline"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}
                >
                  <Mail size={15} />
                  <span>Send Email</span>
                </a>
                <a
                  href={`tel:${selectedLead.phone}`}
                  className="btn btn--outline"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8125rem' }}
                >
                  <Phone size={15} />
                  <span>Call Lead</span>
                </a>
              </div>

              {/* Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {t('interestRequests.email')}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedLead.email}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {t('interestRequests.phone')}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedLead.phone}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {t('interestRequests.lab')}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedLead.tenant.name}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {t('interestRequests.status')}
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '0.75rem', fontWeight: 700, marginTop: '2px',
                    color: (STATUS_BADGE[selectedLead.status] || STATUS_BADGE.PENDING).color,
                  }}>
                    {t(`interestRequests.status${selectedLead.status.charAt(0) + selectedLead.status.slice(1).toLowerCase()}`)}
                  </span>
                </div>
              </div>

              {/* Linked Work Order section */}
              {selectedLead.workOrder && (
                <div style={{
                  padding: '0.875rem 1rem', borderRadius: '10px',
                  backgroundColor: 'var(--bg-overlay, rgba(148, 163, 184, 0.06))',
                  border: '1px solid var(--border)',
                }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                    {t('interestRequests.workOrder')} Reference
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                      {selectedLead.workOrder.folioNumber}
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      Patient: {selectedLead.workOrder.patient}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  {t('interestRequests.notesHeader')}
                </span>
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: '10px',
                  backgroundColor: 'var(--bg-overlay, rgba(148, 163, 184, 0.06))',
                  border: '1px solid var(--border)',
                  fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                }}>
                  {selectedLead.notes || <em style={{ color: 'var(--text-muted)' }}>{t('interestRequests.noNotes')}</em>}
                </div>
              </div>

              {/* Status Change Buttons */}
              <div style={{
                display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
                paddingTop: '0.5rem', borderTop: '1px solid var(--border)',
              }}>
                <button
                  className="btn btn--outline btn--sm"
                  onClick={() => handleStatusUpdate(selectedLead.id, 'CONTACTED')}
                  disabled={selectedLead.status === 'CONTACTED'}
                  style={{ flex: 1 }}
                >
                  <Phone size={13} />
                  <span>{t('interestRequests.markContacted')}</span>
                </button>
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => handleStatusUpdate(selectedLead.id, 'CONVERTED')}
                  disabled={selectedLead.status === 'CONVERTED'}
                  style={{ flex: 1 }}
                >
                  <CheckCircle2 size={13} />
                  <span>{t('interestRequests.markConverted')}</span>
                </button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleStatusUpdate(selectedLead.id, 'DISCARDED')}
                  disabled={selectedLead.status === 'DISCARDED'}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <XCircle size={13} />
                  <span>{t('interestRequests.markDiscarded')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Overlay */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)} style={{ zIndex: 1200 }}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">{t('interestRequests.deleteTitle')}</h3>
              <button className="modal__close" onClick={() => setDeleteTarget(null)} aria-label={t('common.close')}>
                <X size={18} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                {t('interestRequests.deleteConfirm')}
              </p>
              <div style={{
                padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1.25rem',
                backgroundColor: 'var(--bg-overlay, #f8fafc)', border: '1px solid var(--border)',
              }}>
                <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</strong>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {deleteTarget.email} • {deleteTarget.phone}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  {t('common.cancel')}
                </button>
                <button className="btn btn--danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 size={16} className="spinner" /> : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat Card Helper ────────────────────────────────────

function StatCard({
  title, count, icon, color,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      padding: '1.25rem',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      alignItems: 'center',
      justify: 'space-between',
    }}>
      <div>
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
          {title}
        </span>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)', fontFamily: 'monospace' }}>
          {count}
        </span>
      </div>
      <div style={{
        width: '42px', height: '42px', borderRadius: '12px',
        backgroundColor: `${color}15`, border: `1px solid ${color}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
    </div>
  );
}

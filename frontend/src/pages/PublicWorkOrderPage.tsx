import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2,
  AlertTriangle,
  FileText,
  Stethoscope,
  Sparkles,
  CircleDot,
  Clock,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  Heart,
  Send,
  CheckCheck,
  ChevronRight,
  ShieldCheck,
  Activity,
  Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { interestRequestService } from '../services';
import type { PublicWorkOrder } from '../services';

const STATUS_CONFIG: Record<string, { labelKey: string; color: string; bg: string; icon: React.ReactNode }> = {
  CREATED: { labelKey: 'enums.workOrderStatus.CREATED', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)', icon: <CircleDot size={13} /> },
  ASSIGNED: { labelKey: 'enums.workOrderStatus.ASSIGNED', color: '#60A5FA', bg: 'rgba(96, 165, 250, 0.12)', icon: <Clock size={13} /> },
  IN_PROGRESS: { labelKey: 'enums.workOrderStatus.IN_PROGRESS', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)', icon: <PlayCircle size={13} /> },
  INTERNAL_VERIFICATION: { labelKey: 'enums.workOrderStatus.INTERNAL_VERIFICATION', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.12)', icon: <ShieldCheck size={13} /> },
  EXTERNAL_VERIFICATION: { labelKey: 'enums.workOrderStatus.EXTERNAL_VERIFICATION', color: '#818CF8', bg: 'rgba(129, 140, 248, 0.12)', icon: <ShieldCheck size={13} /> },
  COMPLETED: { labelKey: 'enums.workOrderStatus.COMPLETED', color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)', icon: <CheckCircle2 size={13} /> },
  FAILED: { labelKey: 'enums.workOrderStatus.FAILED', color: '#F87171', bg: 'rgba(248, 113, 113, 0.12)', icon: <AlertCircle size={13} /> },
  CANCELLED: { labelKey: 'enums.workOrderStatus.CANCELLED', color: '#FB923C', bg: 'rgba(251, 146, 60, 0.12)', icon: <X size={13} /> },
};

const PROCESS_STATUS_CONFIG: Record<string, { labelKey: string; color: string; bg: string; border: string }> = {
  NOT_STARTED: { labelKey: 'enums.processStatus.NOT_STARTED', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.15)' },
  IN_PROGRESS: { labelKey: 'enums.processStatus.IN_PROGRESS', color: '#FBBF24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)' },
  PAUSED: { labelKey: 'enums.processStatus.PAUSED', color: '#C084FC', bg: 'rgba(192, 132, 252, 0.12)', border: 'rgba(192, 132, 252, 0.3)' },
  COMPLETED: { labelKey: 'enums.processStatus.COMPLETED', color: '#34D399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.3)' },
  FAILED: { labelKey: 'enums.processStatus.FAILED', color: '#F87171', bg: 'rgba(248, 113, 113, 0.12)', border: 'rgba(248, 113, 113, 0.3)' },
  CANCELLED: { labelKey: 'enums.processStatus.CANCELLED', color: '#FB923C', bg: 'rgba(251, 146, 60, 0.12)', border: 'rgba(251, 146, 60, 0.3)' },
};

export function PublicWorkOrderPage() {
  const { t, i18n } = useTranslation();
  const { token } = useParams<{ token: string }>();

  const [workOrder, setWorkOrder] = useState<PublicWorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interest form state
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [interestSubmitted, setInterestSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) {
      setError(t('publicWorkOrder.notFound'));
      setLoading(false);
      return;
    }

    interestRequestService
      .getPublicWorkOrder(token)
      .then((data) => {
        setWorkOrder(data);
        setLoading(false);
      })
      .catch(() => {
        setError(t('publicWorkOrder.notFound'));
        setLoading(false);
      });
  }, [token, t]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t('interestForm.validationName');
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = t('interestForm.validationEmail');
    if (!formData.phone.trim()) errors.phone = t('interestForm.validationPhone');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitInterest = async () => {
    if (!validateForm() || !workOrder) return;
    setSubmitting(true);
    try {
      await interestRequestService.submitInterestRequest({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        notes: formData.notes.trim() || undefined,
        tenantId: workOrder.tenantId,
        workOrderId: workOrder.id,
      });
      setInterestSubmitted(true);
    } catch {
      setFormErrors({ submit: t('interestForm.errorSubmit') });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
        color: '#e2e8f0',
      }}>
        <Loader2 size={48} className="spinner" style={{ color: '#6FAED9' }} />
        <h3 style={{ marginTop: '1.5rem', fontSize: '1.125rem', fontWeight: 700, letterSpacing: '0.02em' }}>
          {t('common.loading')}
        </h3>
      </div>
    );
  }

  // Error / Not Found state
  if (error || !workOrder) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
        color: '#e2e8f0', padding: '2rem', textAlign: 'center',
      }}>
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444',
          padding: '1.5rem', borderRadius: '50%', marginBottom: '1.5rem',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          boxShadow: '0 0 30px rgba(239, 68, 68, 0.15)',
        }}>
          <AlertTriangle size={40} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>
          {t('publicWorkOrder.notFoundTitle')}
        </h2>
        <p style={{ color: '#94a3b8', maxWidth: '420px', fontSize: '0.9375rem', lineHeight: 1.6 }}>
          {t('publicWorkOrder.notFoundDesc')}
        </p>
      </div>
    );
  }

  const sc = STATUS_CONFIG[workOrder.status] || STATUS_CONFIG.CREATED;
  const processes = workOrder.processes || [];

  // Calculate overall process progress percentage
  const completedCount = processes.filter((p) => p.status === 'COMPLETED').length;
  const progressPercent = processes.length > 0 ? Math.round((completedCount / processes.length) * 100) : 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
      color: '#e2e8f0',
      fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* ── Top Header Bar ── */}
      <header style={{
        padding: '0.875rem 1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(15, 23, 42, 0.8)',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {workOrder.tenant.logoUrl ? (
            <img
              src={workOrder.tenant.logoUrl}
              alt={workOrder.tenant.name}
              style={{ height: '34px', borderRadius: '8px', objectFit: 'contain' }}
            />
          ) : (
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #6FAED9 0%, #3B82F6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '0.9375rem', color: '#fff',
              boxShadow: '0 2px 10px rgba(111, 174, 217, 0.3)',
            }}>
              {workOrder.tenant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#f8fafc', display: 'block', lineHeight: 1.2 }}>
              {workOrder.tenant.name}
            </span>
            <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 500 }}>
              {t('publicWorkOrder.title')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LanguageSwitcher />
          <button
            onClick={() => setShowInterestForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.9rem', borderRadius: '20px', border: 'none',
              background: 'linear-gradient(135deg, #6FAED9 0%, #3B82F6 100%)',
              color: '#fff', fontWeight: 700, fontSize: '0.75rem',
              cursor: 'pointer', boxShadow: '0 2px 12px rgba(111, 174, 217, 0.3)',
            }}
          >
            <Heart size={13} />
            <span>{t('interestForm.interestedBtn')}</span>
          </button>
        </div>
      </header>

      {/* ── Main Container (Mobile Responsive Max Width) ── */}
      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '1.25rem 1rem 4rem' }}>

        {/* ── Hero Status Card ── */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          borderRadius: '20px', padding: '1.5rem', marginBottom: '1.25rem',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
        }}>
          {/* Subtle Ambient Glow */}
          <div style={{
            position: 'absolute', top: '-50px', right: '-50px',
            width: '140px', height: '140px', borderRadius: '50%',
            background: `radial-gradient(circle, ${sc.color}30 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('publicWorkOrder.folio')}
              </span>
              <h1 style={{ margin: '0.15rem 0 0', fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                {workOrder.folioNumber}
              </h1>
            </div>

            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '20px',
              color: sc.color, backgroundColor: sc.bg,
              fontSize: '0.78125rem', fontWeight: 700,
              border: `1px solid ${sc.color}30`,
              boxShadow: `0 0 16px ${sc.color}15`,
            }}>
              {sc.icon}
              <span>{t(sc.labelKey)}</span>
            </span>
          </div>

          {/* Quick Info Badges */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {workOrder.boxNumber && (
              <span style={{
                padding: '4px 10px', borderRadius: '8px',
                background: 'rgba(148, 163, 184, 0.08)', border: '1px solid rgba(148, 163, 184, 0.12)',
                fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8',
              }}>
                📦 {t('publicWorkOrder.boxNo')}: {workOrder.boxNumber}
              </span>
            )}
            <span style={{
              padding: '4px 10px', borderRadius: '8px',
              background: 'rgba(111, 174, 217, 0.08)', border: '1px solid rgba(111, 174, 217, 0.15)',
              fontSize: '0.75rem', fontWeight: 600, color: '#6FAED9',
            }}>
              ✨ {workOrder.prosthesisType?.name || 'Prosthesis'}
            </span>
            <span style={{
              padding: '4px 10px', borderRadius: '8px',
              background: 'rgba(148, 163, 184, 0.08)', border: '1px solid rgba(148, 163, 184, 0.12)',
              fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0',
            }}>
              🎨 {workOrder.color}
            </span>
          </div>
        </div>

        {/* ── General Information Grid ── */}
        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.65)', border: '1px solid rgba(148, 163, 184, 0.12)',
          borderRadius: '20px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
        }}>
          <h3 style={{
            margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            borderBottom: '1px solid rgba(148, 163, 184, 0.1)', paddingBottom: '0.65rem',
            color: '#f8fafc', letterSpacing: '0.02em',
          }}>
            <FileText size={16} style={{ color: '#6FAED9' }} />
            {t('publicWorkOrder.generalInfo')}
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '1rem',
          }}>
            <InfoTile
              label={t('publicWorkOrder.patient')}
              value={workOrder.patient}
            />
            <InfoTile
              label={t('publicWorkOrder.doctor')}
              value={workOrder.doctor?.name || '—'}
              sub={workOrder.doctor?.clinicName || undefined}
              icon={<Stethoscope size={11} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#6FAED9' }} />}
            />
            <InfoTile
              label={t('publicWorkOrder.prosthesisType')}
              value={workOrder.prosthesisType?.name || '—'}
              valueColor="#6FAED9"
              icon={<Sparkles size={11} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#6FAED9' }} />}
            />
            <InfoTile
              label={t('publicWorkOrder.createdDate')}
              value={new Date(workOrder.createdAt).toLocaleDateString(
                i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
                { day: 'numeric', month: 'short', year: 'numeric' },
              )}
              icon={<Calendar size={11} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#6FAED9' }} />}
            />
          </div>
        </div>

        {/* ── Specification Section (if present) ── */}
        {workOrder.specification && (
          <div style={{
            backgroundColor: 'rgba(30, 41, 59, 0.65)', border: '1px solid rgba(148, 163, 184, 0.12)',
            borderRadius: '20px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
            backdropFilter: 'blur(12px)',
          }}>
            <h3 style={{
              margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)', paddingBottom: '0.65rem',
              color: '#f8fafc',
            }}>
              <Layers size={16} style={{ color: '#6FAED9' }} />
              {t('publicWorkOrder.specifications')}
            </h3>
            <div style={{
              fontSize: '0.8125rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.6,
              padding: '0.75rem 1rem', borderRadius: '12px',
              backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.08)',
            }}>
              {workOrder.specification}
            </div>
          </div>
        )}

        {/* ── 📱 PROCESS DETAILS & MOBILE TIMELINE SECTION (REDESIGNED) ── */}
        <div style={{
          backgroundColor: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(148, 163, 184, 0.14)',
          borderRadius: '24px', padding: '1.5rem', marginBottom: '1.5rem',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.35)',
        }}>
          {/* Section Header with Overall Progress % */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(148, 163, 184, 0.12)', paddingBottom: '0.875rem',
            marginBottom: '1.25rem',
          }}>
            <div>
              <h3 style={{
                margin: 0, fontSize: '0.9375rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                color: '#f8fafc', letterSpacing: '0.02em',
              }}>
                <Activity size={18} style={{ color: '#6FAED9' }} />
                {t('publicWorkOrder.processFlow')}
              </h3>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500, marginTop: '2px', display: 'block' }}>
                {completedCount} of {processes.length} steps completed ({progressPercent}%)
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '4px 10px', borderRadius: '14px',
              background: 'rgba(111, 174, 217, 0.1)', border: '1px solid rgba(111, 174, 217, 0.2)',
            }}>
              <div style={{
                width: '36px', height: '6px', borderRadius: '3px',
                background: 'rgba(148, 163, 184, 0.2)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, #6FAED9, #10B981)',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6FAED9', fontFamily: 'monospace' }}>
                {progressPercent}%
              </span>
            </div>
          </div>

          {processes.length === 0 ? (
            <div style={{
              padding: '2rem 1rem', textAlign: 'center', color: '#64748b',
              border: '1px dashed rgba(148, 163, 184, 0.2)', borderRadius: '16px',
            }}>
              {t('publicWorkOrder.noProcesses')}
            </div>
          ) : (
            /* 📱 Mobile Responsive Vertical Timeline Stepper */
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '0.25rem' }}>

              {processes.map((proc, idx) => {
                const psc = PROCESS_STATUS_CONFIG[proc.status] || PROCESS_STATUS_CONFIG.NOT_STARTED;
                const isCompleted = proc.status === 'COMPLETED';
                const isActive = proc.status === 'IN_PROGRESS';
                const isLast = idx === processes.length - 1;

                return (
                  <div
                    key={proc.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '1rem',
                      position: 'relative',
                      paddingBottom: isLast ? '0' : '1.25rem',
                    }}
                  >
                    {/* Vertical Connector Line */}
                    {!isLast && (
                      <div style={{
                        position: 'absolute',
                        top: '36px',
                        left: '17px',
                        bottom: '0',
                        width: '2px',
                        background: isCompleted
                          ? 'linear-gradient(to bottom, #10B981 0%, rgba(16, 185, 129, 0.2) 100%)'
                          : isActive
                          ? 'linear-gradient(to bottom, #FBBF24 0%, rgba(148, 163, 184, 0.2) 100%)'
                          : 'rgba(148, 163, 184, 0.12)',
                        zIndex: 1,
                      }} />
                    )}

                    {/* Step Icon Node */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '0.8125rem',
                      backgroundColor: isCompleted
                        ? '#10B981'
                        : isActive
                        ? '#FBBF24'
                        : 'rgba(30, 41, 59, 0.9)',
                      color: (isCompleted || isActive) ? '#0f172a' : '#64748b',
                      border: `2px solid ${
                        isCompleted ? '#10B981' : isActive ? '#FBBF24' : 'rgba(148, 163, 184, 0.2)'
                      }`,
                      boxShadow: isActive
                        ? '0 0 20px rgba(251, 191, 36, 0.4)'
                        : isCompleted
                        ? '0 0 12px rgba(16, 185, 129, 0.2)'
                        : 'none',
                      zIndex: 2,
                      transition: 'all 0.3s ease',
                    }}>
                      {isCompleted ? (
                        <CheckCircle2 size={20} style={{ color: '#0f172a' }} />
                      ) : isActive ? (
                        <PlayCircle size={18} style={{ color: '#0f172a' }} />
                      ) : (
                        idx + 1
                      )}
                    </div>

                    {/* Process Card Content */}
                    <div style={{
                      flex: 1,
                      padding: '0.875rem 1.15rem',
                      borderRadius: '16px',
                      backgroundColor: isActive
                        ? 'rgba(251, 191, 36, 0.07)'
                        : isCompleted
                        ? 'rgba(16, 185, 129, 0.05)'
                        : 'rgba(15, 23, 42, 0.5)',
                      border: `1px solid ${
                        isActive
                          ? 'rgba(251, 191, 36, 0.3)'
                          : isCompleted
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(148, 163, 184, 0.08)'
                      }`,
                      boxShadow: isActive
                        ? '0 4px 20px rgba(251, 191, 36, 0.08)'
                        : '0 2px 10px rgba(0, 0, 0, 0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      flexWrap: 'wrap', gap: '0.5rem',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 700, color: '#64748b',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            {t('publicWorkOrder.step')} {idx + 1}
                          </span>
                          {proc.isVerification && (
                            <span style={{
                              fontSize: '0.625rem', fontWeight: 700, padding: '1px 6px',
                              borderRadius: '4px', background: 'rgba(167, 139, 250, 0.15)',
                              color: '#A78BFA', border: '1px solid rgba(167, 139, 250, 0.2)',
                            }}>
                              Verification
                            </span>
                          )}
                        </div>

                        <h4 style={{
                          margin: '0.15rem 0 0', fontSize: '0.9375rem', fontWeight: isActive ? 800 : 700,
                          color: isActive ? '#FBBF24' : isCompleted ? '#34D399' : '#f1f5f9',
                          lineHeight: 1.3,
                        }}>
                          {proc.processName}
                        </h4>
                      </div>

                      {/* Status Badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '0.71875rem', fontWeight: 700, padding: '4px 12px',
                        borderRadius: '16px', color: psc.color, backgroundColor: psc.bg,
                        border: `1px solid ${psc.border}`, whiteSpace: 'nowrap',
                      }}>
                        {t(psc.labelKey)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 💖 CTA INTEREST BUTTON SECTION ── */}
        <div style={{
          textAlign: 'center', padding: '1rem 0 0.5rem',
        }}>
          <button
            onClick={() => setShowInterestForm(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
              width: '100%', maxWidth: '360px',
              padding: '1rem 2rem', borderRadius: '16px', border: 'none',
              background: 'linear-gradient(135deg, #6FAED9 0%, #3B82F6 100%)',
              color: '#fff', fontWeight: 800, fontSize: '1rem',
              cursor: 'pointer', boxShadow: '0 8px 30px rgba(111, 174, 217, 0.4)',
              transition: 'all 0.25 ease',
              letterSpacing: '0.01em',
            }}
          >
            <Heart size={20} />
            <span>{t('interestForm.interestedBtn')}</span>
            <ChevronRight size={18} />
          </button>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
            {t('interestForm.subtitle')}
          </p>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center', paddingTop: '2rem', marginTop: '1rem',
          borderTop: '1px solid rgba(148, 163, 184, 0.08)',
          fontSize: '0.75rem', color: '#475569',
        }}>
          {t('publicWorkOrder.poweredBy')} <strong style={{ color: '#64748b' }}>{workOrder.tenant.name}</strong>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════
          Interest Form Modal Overlay
         ═══════════════════════════════════════════════════════ */}
      {showInterestForm && (
        <div
          className="modal-overlay"
          onClick={() => { if (!submitting) { setShowInterestForm(false); setInterestSubmitted(false); } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '440px',
              backgroundColor: '#1e293b', borderRadius: '24px',
              border: '1px solid rgba(148, 163, 184, 0.16)',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: '#f8fafc' }}>
                {interestSubmitted ? t('interestForm.successTitle') : t('interestForm.title')}
              </h3>
              <button
                onClick={() => { setShowInterestForm(false); setInterestSubmitted(false); }}
                style={{
                  background: 'none', border: 'none', color: '#94a3b8',
                  cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                }}
                aria-label={t('interestForm.close')}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              {interestSubmitted ? (
                /* Success state */
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 1.25rem',
                    background: 'rgba(16, 185, 129, 0.12)', border: '2px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 24px rgba(16, 185, 129, 0.2)',
                  }}>
                    <CheckCheck size={34} style={{ color: '#34D399' }} />
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 800, color: '#f8fafc' }}>
                    {t('interestForm.successTitle')}
                  </h4>
                  <p style={{ color: '#cbd5e1', fontSize: '0.9375rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                    {t('interestForm.successMessage')}
                  </p>
                  <button
                    onClick={() => { setShowInterestForm(false); setInterestSubmitted(false); }}
                    style={{
                      width: '100%', padding: '0.875rem', borderRadius: '14px', border: 'none',
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      color: '#fff', fontWeight: 800, fontSize: '0.9375rem', cursor: 'pointer',
                    }}
                  >
                    {t('interestForm.close')}
                  </button>
                </div>
              ) : (
                /* Form */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: '0 0 0.25rem', lineHeight: 1.5 }}>
                    {t('interestForm.subtitle')}
                  </p>

                  <FormField
                    label={t('interestForm.name')}
                    placeholder={t('interestForm.namePlaceholder')}
                    value={formData.name}
                    onChange={(v) => setFormData({ ...formData, name: v })}
                    error={formErrors.name}
                  />
                  <FormField
                    label={t('interestForm.email')}
                    placeholder={t('interestForm.emailPlaceholder')}
                    value={formData.email}
                    onChange={(v) => setFormData({ ...formData, email: v })}
                    error={formErrors.email}
                    type="email"
                  />
                  <FormField
                    label={t('interestForm.phone')}
                    placeholder={t('interestForm.phonePlaceholder')}
                    value={formData.phone}
                    onChange={(v) => setFormData({ ...formData, phone: v })}
                    error={formErrors.phone}
                    type="tel"
                  />
                  <FormField
                    label={t('interestForm.notes')}
                    placeholder={t('interestForm.notesPlaceholder')}
                    value={formData.notes}
                    onChange={(v) => setFormData({ ...formData, notes: v })}
                    textarea
                  />

                  {formErrors.submit && (
                    <p style={{ color: '#F87171', fontSize: '0.8125rem', margin: 0 }}>
                      {formErrors.submit}
                    </p>
                  )}

                  <button
                    onClick={handleSubmitInterest}
                    disabled={submitting}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      width: '100%', padding: '0.875rem', borderRadius: '14px', border: 'none',
                      background: submitting
                        ? 'rgba(111, 174, 217, 0.3)'
                        : 'linear-gradient(135deg, #6FAED9 0%, #3B82F6 100%)',
                      color: '#fff', fontWeight: 800, fontSize: '0.9375rem',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      marginTop: '0.25rem',
                      boxShadow: '0 4px 20px rgba(111, 174, 217, 0.3)',
                    }}
                  >
                    {submitting ? (
                      <Loader2 size={18} className="spinner" />
                    ) : (
                      <Send size={16} />
                    )}
                    {submitting ? t('interestForm.submitting') : t('interestForm.submit')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────

function InfoTile({
  label, value, sub, icon, valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div>
      <span style={{
        display: 'block', fontSize: '0.6875rem', color: '#64748b',
        fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px', letterSpacing: '0.05em',
      }}>
        {icon}{label}
      </span>
      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: valueColor || '#f1f5f9' }}>
        {value}
      </span>
      {sub && (
        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginTop: '1px' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function FormField({
  label, placeholder, value, onChange, error, type = 'text', textarea,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  textarea?: boolean;
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
    border: error ? '1px solid #F87171' : '1px solid rgba(148, 163, 184, 0.15)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)', color: '#f8fafc',
    fontSize: '0.875rem', outline: 'none', transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  };

  return (
    <div>
      <label style={{
        display: 'block', fontSize: '0.8125rem', fontWeight: 700,
        color: '#94a3b8', marginBottom: '0.35rem',
      }}>
        {label}
      </label>
      {textarea ? (
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
      {error && (
        <span style={{ fontSize: '0.75rem', color: '#F87171', marginTop: '4px', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  );
}

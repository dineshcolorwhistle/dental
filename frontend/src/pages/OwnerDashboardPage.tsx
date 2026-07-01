import { useState, useEffect } from 'react';
import { useAuth } from '../context';
import { authService, type TenantLimitsResponse } from '../services';
import {
  Users,
  Wrench,
  Loader2,
  Building2,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

export function OwnerDashboardPage() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<TenantLimitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchLimits = async () => {
    try {
      setLoading(true);
      const data = await authService.getTenantLimits();
      setLimits(data);
    } catch (err) {
      console.error('Failed to load tenant limits:', err);
      toast.error('Failed to retrieve tenant capacity and limits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLimits();
  }, []);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestNote.trim()) {
      toast.error('Please enter details about your request');
      return;
    }

    try {
      setSubmitting(true);
      await authService.requestTenantLimitIncrease(requestNote);
      toast.success('Your limit increase request has been submitted to the Super Admin!');
      setRequestModalOpen(false);
      setRequestNote('');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to submit upgrade request';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const remainingAdmins = limits ? Math.max(0, limits.maxAdmins - limits.currentAdmins) : 0;
  const remainingTechnicians = limits ? Math.max(0, limits.maxTechnicians - limits.currentTechnicians) : 0;

  return (
    <div className="dashboard-page animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header Greeting */}
      <div className="dashboard-page__header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="dashboard-page__title" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px 0' }}>
            {getGreeting()}, {user?.firstName}!
          </h1>
          <p className="dashboard-page__subtitle" style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Dental Laboratory Capacity Console
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '20px',
          backgroundColor: 'rgba(111, 174, 217, 0.08)',
          border: '1px solid rgba(111, 174, 217, 0.15)',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--accent-primary)'
        }}>
          <Building2 size={14} />
          <span>Tenant Configuration Mode</span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} />
        </div>
      ) : (
        <>
          {/* Main Limits Dashboard Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(111, 174, 217, 0.05) 0%, rgba(169, 207, 232, 0.05) 100%)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '2.5rem',
            marginBottom: '2.5rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{
              position: 'absolute',
              top: '-50px',
              right: '-50px',
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--accent-primary-glow) 0%, transparent 70%)',
              pointerEvents: 'none'
            }} />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-heading)' }}>
                  Active Limits & Resource Allocation
                </h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 1.5rem 0', maxWidth: '750px' }}>
                  Monitor and configure the maximum number of administrators and technicians registered under your organization. If you need additional capacity to support your growing team or new branches, you can request a limit upgrade at any time.
                </p>
              </div>
              <button 
                className="btn btn--primary" 
                onClick={() => setRequestModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.625rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, flexShrink: 0 }}
              >
                <Sparkles size={16} />
                <span>Request Limit Increase</span>
              </button>
            </div>

            {/* Grid of Limits */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2rem',
              marginTop: '1rem'
            }}>
              {/* Lab Administrators Stats */}
              <div style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '1.75rem',
                transition: 'all 0.25s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(139, 92, 246, 0.08)',
                    color: '#8B5CF6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Lab Administrators</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Organization-wide admins</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                  <div style={{ padding: '8px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {limits?.currentAdmins}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Assigned</div>
                  </div>
                  <div style={{ padding: '8px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {limits?.maxAdmins}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Total Limit</div>
                  </div>
                  <div style={{ padding: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: remainingAdmins > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                      {remainingAdmins}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Remaining</div>
                  </div>
                </div>

                {/* Progress bar */}
                {limits && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Usage Level</span>
                      <span>{Math.round((limits.currentAdmins / limits.maxAdmins) * 100)}%</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        backgroundColor: '#8B5CF6',
                        width: `${Math.min(100, (limits.currentAdmins / limits.maxAdmins) * 100)}%`,
                        borderRadius: '10px'
                      }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Lab Technicians Stats */}
              <div style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                padding: '1.75rem',
                transition: 'all 0.25s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(236, 72, 153, 0.08)',
                    color: '#EC4899',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Wrench size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Lab Technicians</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned to branch workflows</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                  <div style={{ padding: '8px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {limits?.currentTechnicians}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Assigned</div>
                  </div>
                  <div style={{ padding: '8px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                      {limits?.maxTechnicians}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Total Limit</div>
                  </div>
                  <div style={{ padding: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: remainingTechnicians > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                      {remainingTechnicians}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Remaining</div>
                  </div>
                </div>

                {/* Progress bar */}
                {limits && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>Usage Level</span>
                      <span>{Math.round((limits.currentTechnicians / limits.maxTechnicians) * 100)}%</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        backgroundColor: '#EC4899',
                        width: `${Math.min(100, (limits.currentTechnicians / limits.maxTechnicians) * 100)}%`,
                        borderRadius: '10px'
                      }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Upgrade Request Modal */}
      {requestModalOpen && (
        <div className="modal-overlay" onClick={() => !submitting && setRequestModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
            <div className="modal__header">
              <h2 className="modal__title">Request Limit Increase</h2>
              <button className="modal__close" onClick={() => setRequestModalOpen(false)} disabled={submitting}>
                &times;
              </button>
            </div>
            <form onSubmit={handleRequestSubmit}>
              <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Please detail the capacity upgrades you need (e.g., number of additional Lab Admin or Technician seats required) and any notes for the Super Admin.
                </p>

                <div className="form-group">
                  <label className="form-label" htmlFor="request-message" style={{ fontWeight: 600 }}>
                    Request Details
                  </label>
                  <textarea
                    id="request-message"
                    className="form-input"
                    placeholder="Example: We need to increase our Lab Technician slots from 6 to 10 to support our new team members."
                    rows={4}
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                    style={{ resize: 'vertical', width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '1.25rem 1.75rem', margin: 0 }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setRequestModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={submitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {submitting && <Loader2 className="animate-spin" size={14} />}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useAuth } from '../context';
import {
  DollarSign,
  GitBranch,
  Users,
  Wrench,
  Stethoscope,
  ClipboardList,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Building2,
  Lock
} from 'lucide-react';

export function OwnerDashboardPage() {
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const navigationCards = [
    {
      title: 'Finance & Analytics',
      description: 'Analyze organization-wide revenue, payments, invoicing, and pending bills.',
      path: '/finance',
      icon: <DollarSign size={24} />,
      color: '#10B981', // green
      bgGlow: 'rgba(16, 185, 129, 0.08)',
      borderHover: 'rgba(16, 185, 129, 0.25)',
    },
    {
      title: 'Branch Network',
      description: 'Scope and manage individual lab locations, settings, and branches.',
      path: '/branches',
      icon: <GitBranch size={24} />,
      color: '#3B82F6', // blue
      bgGlow: 'rgba(59, 130, 246, 0.08)',
      borderHover: 'rgba(59, 130, 246, 0.25)',
    },
    {
      title: 'Lab Administrators',
      description: 'Manage administrator accounts and assignments for lab operations.',
      path: '/admins',
      icon: <Users size={24} />,
      color: '#8B5CF6', // purple
      bgGlow: 'rgba(139, 92, 246, 0.08)',
      borderHover: 'rgba(139, 92, 246, 0.25)',
    },
    {
      title: 'Work Orders',
      description: 'Audit cases, production sequences, and patient cases across all branches.',
      path: '/work-orders',
      icon: <ClipboardList size={24} />,
      color: '#F59E0B', // amber
      bgGlow: 'rgba(245, 158, 11, 0.08)',
      borderHover: 'rgba(245, 158, 11, 0.25)',
    },
    {
      title: 'Technician Staff',
      description: 'View technician profiles and active roles within physical labs.',
      path: '/technicians',
      icon: <Wrench size={24} />,
      color: '#EC4899', // pink
      bgGlow: 'rgba(236, 72, 153, 0.08)',
      borderHover: 'rgba(236, 72, 153, 0.25)',
    },
    {
      title: 'Partner Doctors',
      description: 'Review doctor clients, clinics, and work order submissions.',
      path: '/doctors',
      icon: <Stethoscope size={24} />,
      color: '#06B6D4', // cyan
      bgGlow: 'rgba(6, 182, 212, 0.08)',
      borderHover: 'rgba(6, 182, 212, 0.25)',
    },
  ];

  return (
    <div className="dashboard-page animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Header Greeting */}
      <div className="dashboard-page__header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="dashboard-page__title" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px 0' }}>
            {getGreeting()}, {user?.firstName}!
          </h1>
          <p className="dashboard-page__subtitle" style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Owner Business Dashboard Console
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
          <span>Multi-Branch Administrator Mode</span>
        </div>
      </div>

      {/* Under Development Announcement */}
      <div className="dashboard-card" style={{
        background: 'linear-gradient(135deg, rgba(111, 174, 217, 0.05) 0%, rgba(169, 207, 232, 0.05) 100%)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '2.5rem',
        marginBottom: '2.5rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)'
      }}>
        {/* Subtle decorative background glow */}
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

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            backgroundColor: 'rgba(111, 174, 217, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            flexShrink: 0
          }}>
            <TrendingUp size={28} />
          </div>

          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
                Owner Dashboard
              </h2>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: 'var(--warning)',
                padding: '3px 8px',
                borderRadius: '100px',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Under Development
              </span>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 1.25rem 0', maxWidth: '750px' }}>
              We are actively developing a high-fidelity business intelligence dashboard tailored specifically for owners. 
              This interface will exclude daily operational details (such as Lab Admin tasks and verification checklists) 
              to focus strictly on financial analytics, branch performance indicators, revenue health, and strategic reporting.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/finance" className="btn btn--primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                <DollarSign size={16} /> Go to Finance Module
              </Link>
              <Link to="/branches" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                <span>Manage Branches</span> <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Links */}
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-heading)' }}>
        Quick Management Access
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        {navigationCards.map((card, index) => (
          <Link
            key={index}
            to={card.path}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div
              className="dashboard-card"
              style={{
                height: '100%',
                padding: '1.5rem',
                border: '1px solid var(--border)',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-surface)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.borderColor = card.borderHover;
                e.currentTarget.style.boxShadow = `0 8px 24px -4px ${card.bgGlow}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  backgroundColor: card.bgGlow,
                  color: card.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {card.icon}
                </div>
                <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                  {card.title}
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  {card.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Planned Feature Board / Vision */}
      <div className="dashboard-card" style={{
        padding: '1.75rem',
        borderRadius: '16px',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-surface)'
      }}>
        <h3 className="dashboard-card__title" style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', color: 'var(--text-heading)' }}>
          <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
          Owner Analytics Suite — Future Specifications
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem'
        }}>
          {[
            {
              title: 'Multi-Branch Revenue Growth',
              desc: 'Cross-compare branches side-by-side with historical sales indicators.'
            },
            {
              title: 'SLA & Turnaround Intelligence',
              desc: 'Monitor lab technician efficiency rates and production delay alerts.'
            },
            {
              title: 'Product Type Market Popularity',
              desc: 'Analyze which prosthetics are requested most by doctors and clinics.'
            },
            {
              title: 'Profit Margin Estimator',
              desc: 'Factor labor, process complexity, and branch overhead into net margins.'
            }
          ].map((item, idx) => (
            <div key={idx} style={{
              padding: '1rem',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-overlay)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={12} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

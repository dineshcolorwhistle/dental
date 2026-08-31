import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  KeyRound,
  GitBranch,
  Users,
  Cpu,
  ClipboardList,
  FileCheck,
  Truck,
  ArrowRight,
  ExternalLink,
  Plus,
  Compass,
} from 'lucide-react';

type RoleFilter = 'ALL' | 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'TECHNICIAN';

interface SubStep {
  num: string;
  name: string;
  url: string;
  desc: string;
}

interface StepItem {
  id: string;
  number: string;
  title: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'TECHNICIAN';
  roleLabel: string;
  desc: string;
  prereq: string;
  fields?: string[];
  substeps?: SubStep[];
  whatHappens: string;
  actionUrl?: string;
  actionLabel?: string;
  icon: any;
  accentColor: string;
}

export function TenantOnboardingPage() {
  const { t } = useTranslation();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

  const stepsData: StepItem[] = useMemo(() => [
    {
      id: 'step1',
      number: t('tenantOnboarding.steps.step1.number', { defaultValue: '1' }),
      title: t('tenantOnboarding.steps.step1.title', { defaultValue: 'Super Admin creates Tenant' }),
      role: 'SUPER_ADMIN',
      roleLabel: t('tenantOnboarding.roles.SUPER_ADMIN', { defaultValue: 'Super Admin' }),
      desc: t('tenantOnboarding.steps.step1.desc', { defaultValue: 'Super Admin registers the new dental laboratory on the platform and assigns initial user limits.' }),
      prereq: t('tenantOnboarding.steps.step1.prereq', { defaultValue: 'None (initial platform step).' }),
      fields: (t('tenantOnboarding.steps.step1.fields', { returnObjects: true }) as string[]) || ['Lab Name', 'Owner Full Name', 'Owner Email'],
      whatHappens: t('tenantOnboarding.steps.step1.whatHappens', { defaultValue: 'System creates the tenant database boundary and automatically sends an invitation / password reset email to the owner.' }),
      actionUrl: '/tenants',
      actionLabel: t('tenantOnboarding.steps.step1.actionLabel', { defaultValue: 'Go to Tenants' }),
      icon: Building2,
      accentColor: '#3B82F6',
    },
    {
      id: 'step2',
      number: t('tenantOnboarding.steps.step2.number', { defaultValue: '2' }),
      title: t('tenantOnboarding.steps.step2.title', { defaultValue: 'Owner resets password & logs in' }),
      role: 'OWNER',
      roleLabel: t('tenantOnboarding.roles.OWNER', { defaultValue: 'Lab Owner' }),
      desc: t('tenantOnboarding.steps.step2.desc', { defaultValue: 'The lab owner opens the invitation email, clicks the secure link to set their master password, and logs into the platform.' }),
      prereq: t('tenantOnboarding.steps.step2.prereq', { defaultValue: 'Tenant created by Super Admin (Step 1).' }),
      fields: (t('tenantOnboarding.steps.step2.fields', { returnObjects: true }) as string[]) || ['New Password', 'Confirm Password'],
      whatHappens: t('tenantOnboarding.steps.step2.whatHappens', { defaultValue: 'Account is activated and the owner is redirected to the Owner Dashboard.' }),
      actionUrl: '/login',
      actionLabel: t('tenantOnboarding.steps.step2.actionLabel', { defaultValue: 'Go to Login' }),
      icon: KeyRound,
      accentColor: '#8B5CF6',
    },
    {
      id: 'step3',
      number: t('tenantOnboarding.steps.step3.number', { defaultValue: '3' }),
      title: t('tenantOnboarding.steps.step3.title', { defaultValue: 'Owner creates first Branch' }),
      role: 'OWNER',
      roleLabel: t('tenantOnboarding.roles.OWNER', { defaultValue: 'Lab Owner' }),
      desc: t('tenantOnboarding.steps.step3.desc', { defaultValue: 'The owner creates at least one physical branch/facility. Staff, technicians, and work orders must belong to a branch.' }),
      prereq: t('tenantOnboarding.steps.step3.prereq', { defaultValue: 'Owner authenticated into the platform (Step 2).' }),
      fields: (t('tenantOnboarding.steps.step3.fields', { returnObjects: true }) as string[]) || ['Branch Name', 'Branch Code', 'Phone', 'Address'],
      whatHappens: t('tenantOnboarding.steps.step3.whatHappens', { defaultValue: 'Establishes the operational base for staff assignments and case routing.' }),
      actionUrl: '/branches',
      actionLabel: t('tenantOnboarding.steps.step3.actionLabel', { defaultValue: 'Go to Branches' }),
      icon: GitBranch,
      accentColor: '#06B6D4',
    },
    {
      id: 'step4',
      number: t('tenantOnboarding.steps.step4.number', { defaultValue: '4' }),
      title: t('tenantOnboarding.steps.step4.title', { defaultValue: 'Owner creates Lab Admin(s)' }),
      role: 'OWNER',
      roleLabel: t('tenantOnboarding.roles.OWNER', { defaultValue: 'Lab Owner' }),
      desc: t('tenantOnboarding.steps.step4.desc', { defaultValue: 'The owner invites Lab Administrators to handle daily order intake, technician task assignment, and clinic communication.' }),
      prereq: t('tenantOnboarding.steps.step4.prereq', { defaultValue: 'At least one Branch created (Step 3).' }),
      fields: (t('tenantOnboarding.steps.step4.fields', { returnObjects: true }) as string[]) || ['First Name', 'Last Name', 'Email', 'Assigned Branch'],
      whatHappens: t('tenantOnboarding.steps.step4.whatHappens', { defaultValue: 'Administrator receives an email invite with an activation link to set their password.' }),
      actionUrl: '/admins',
      actionLabel: t('tenantOnboarding.steps.step4.actionLabel', { defaultValue: 'Go to Admins' }),
      icon: Users,
      accentColor: '#10B981',
    },
    {
      id: 'step5',
      number: t('tenantOnboarding.steps.step5.number', { defaultValue: '5' }),
      title: t('tenantOnboarding.steps.step5.title', { defaultValue: 'Setup Production Master Data' }),
      role: 'ADMIN',
      roleLabel: t('tenantOnboarding.roles.ADMIN', { defaultValue: 'Lab Admin' }),
      desc: t('tenantOnboarding.steps.step5.desc', { defaultValue: 'Before creating work orders, the lab must configure its production catalog in this exact sequence:' }),
      prereq: t('tenantOnboarding.steps.step5.prereq', { defaultValue: 'Branch (Step 3) and Lab Admin (Step 4) created.' }),
      substeps: (t('tenantOnboarding.steps.step5.substeps', { returnObjects: true }) as SubStep[]) || [
        { num: '5.1', name: 'Technicians', url: '/technicians', desc: 'Add technicians with their assigned branch and specialties.' },
        { num: '5.2', name: 'Process Areas', url: '/process-areas', desc: 'Create workstation departments (e.g., CAD/CAM, Ceramics, QC).' },
        { num: '5.3', name: 'Processes', url: '/processes', desc: 'Define individual work stages (e.g., Scan, Design, Mill, Glaze) linked to areas.' },
        { num: '5.4', name: 'Prosthesis Types', url: '/prosthesis-types', desc: 'Define product catalog (e.g., Zirconia Crown) with base price and stage workflow.' },
        { num: '5.5', name: 'Doctors & Clinics', url: '/doctors', desc: 'Register prescribing dentists and clinics with contact info.' },
      ],
      whatHappens: t('tenantOnboarding.steps.step5.whatHappens', { defaultValue: 'Configures all product templates and technician routing required to generate work orders.' }),
      icon: Cpu,
      accentColor: '#F59E0B',
    },
    {
      id: 'step6',
      number: t('tenantOnboarding.steps.step6.number', { defaultValue: '6' }),
      title: t('tenantOnboarding.steps.step6.title', { defaultValue: 'Create Work Order & Assign Technicians' }),
      role: 'ADMIN',
      roleLabel: t('tenantOnboarding.roles.ADMIN', { defaultValue: 'Lab Admin' }),
      desc: t('tenantOnboarding.steps.step6.desc', { defaultValue: 'Admin creates a work order for a doctor, selects prosthesis, tooth/shade, delivery date, and assigns technicians to each stage.' }),
      prereq: t('tenantOnboarding.steps.step6.prereq', { defaultValue: 'Doctor, Prosthesis Type, and Technicians configured (Step 5).' }),
      fields: (t('tenantOnboarding.steps.step6.fields', { returnObjects: true }) as string[]) || ['Doctor / Clinic', 'Patient ID', 'Prosthesis Type', 'Teeth & Shade', 'Delivery Date', 'Technician per Stage'],
      whatHappens: t('tenantOnboarding.steps.step6.whatHappens', { defaultValue: 'Generates a sequential Work Order number and unique QR tracking code for workstation tracking.' }),
      actionUrl: '/work-orders',
      actionLabel: t('tenantOnboarding.steps.step6.actionLabel', { defaultValue: 'Go to Work Orders' }),
      icon: ClipboardList,
      accentColor: '#EC4899',
    },
    {
      id: 'step7',
      number: t('tenantOnboarding.steps.step7.number', { defaultValue: '7' }),
      title: t('tenantOnboarding.steps.step7.title', { defaultValue: 'Production Execution & Quality Check' }),
      role: 'TECHNICIAN',
      roleLabel: t('tenantOnboarding.roles.TECHNICIAN', { defaultValue: 'Technician' }),
      desc: t('tenantOnboarding.steps.step7.desc', { defaultValue: 'Technicians scan the case QR code or view assigned orders, update stage status (In Progress -> Completed), and Admin performs QC inspection.' }),
      prereq: t('tenantOnboarding.steps.step7.prereq', { defaultValue: 'Work Order created and assigned (Step 6).' }),
      fields: (t('tenantOnboarding.steps.step7.fields', { returnObjects: true }) as string[]) || ['Stage Status (In Progress / Completed)', 'Technical Notes / Lot #', 'QC Fit & Margin Verification'],
      whatHappens: t('tenantOnboarding.steps.step7.whatHappens', { defaultValue: 'Tracks stage cycle times, alerts next technician, and advances the work order toward completion.' }),
      actionUrl: '/work-orders',
      actionLabel: t('tenantOnboarding.steps.step7.actionLabel', { defaultValue: 'View Work Orders' }),
      icon: FileCheck,
      accentColor: '#6366F1',
    },
    {
      id: 'step8',
      number: t('tenantOnboarding.steps.step8.number', { defaultValue: '8' }),
      title: t('tenantOnboarding.steps.step8.title', { defaultValue: 'Packaging, Delivery & Invoicing' }),
      role: 'ADMIN',
      roleLabel: t('tenantOnboarding.roles.ADMIN', { defaultValue: 'Lab Admin' }),
      desc: t('tenantOnboarding.steps.step8.desc', { defaultValue: 'The completed restoration is packaged, dispatched with delivery confirmation slip, marked Completed, and billed in Finance.' }),
      prereq: t('tenantOnboarding.steps.step8.prereq', { defaultValue: 'Work Order completed and QC approved (Step 7).' }),
      fields: (t('tenantOnboarding.steps.step8.fields', { returnObjects: true }) as string[]) || ['Delivery Manifest & Signature', 'Invoice Itemization & Payment'],
      whatHappens: t('tenantOnboarding.steps.step8.whatHappens', { defaultValue: 'Finalizes the case lifecycle, updates turnaround metrics, and logs the invoice in accounts receivable.' }),
      actionUrl: '/finance',
      actionLabel: t('tenantOnboarding.steps.step8.actionLabel', { defaultValue: 'Go to Finance' }),
      icon: Truck,
      accentColor: '#14B8A6',
    },
  ], [t]);

  const filteredSteps = useMemo(() => {
    if (roleFilter === 'ALL') return stepsData;
    return stepsData.filter((step) => step.role === roleFilter);
  }, [stepsData, roleFilter]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { bg: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6' };
      case 'OWNER':
        return { bg: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6' };
      case 'ADMIN':
        return { bg: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' };
      case 'TECHNICIAN':
        return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10B981' };
      default:
        return { bg: 'rgba(111, 174, 217, 0.12)', color: 'var(--accent-primary)' };
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* ─── Simple & Clean Page Header ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Compass size={28} style={{ color: 'var(--accent-primary)' }} />
            <span>{t('tenantOnboarding.title', { defaultValue: 'Tenant Onboarding Guide' })}</span>
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0', lineHeight: 1.5 }}>
            {t('tenantOnboarding.subtitle', { defaultValue: 'Step-by-step prerequisite and workflow guide for onboarding a new dental lab tenant onto the platform.' })}
          </p>
        </div>

        <Link
          to="/tenants"
          className="btn btn--primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: 600 }}
        >
          <Plus size={18} />
          <span>{t('tenantOnboarding.createTenant', { defaultValue: 'Create Tenant' })}</span>
        </Link>
      </div>

      {/* ─── Compact Role Filter Tabs ─── */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {[
          { key: 'ALL', label: t('tenantOnboarding.filterAll', { defaultValue: 'All Steps' }), count: 8 },
          { key: 'SUPER_ADMIN', label: t('tenantOnboarding.roles.SUPER_ADMIN', { defaultValue: 'Super Admin' }), count: 1 },
          { key: 'OWNER', label: t('tenantOnboarding.roles.OWNER', { defaultValue: 'Lab Owner' }), count: 3 },
          { key: 'ADMIN', label: t('tenantOnboarding.roles.ADMIN', { defaultValue: 'Lab Admin' }), count: 3 },
          { key: 'TECHNICIAN', label: t('tenantOnboarding.roles.TECHNICIAN', { defaultValue: 'Technician' }), count: 1 },
        ].map((tab) => {
          const active = roleFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRoleFilter(tab.key as RoleFilter)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: active ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: active ? 700 : 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '9999px',
                  backgroundColor: active ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-overlay, rgba(148, 163, 184, 0.15))',
                  color: active ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Informative Linear Steps List ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredSteps.map((step) => {
          const roleBadge = getRoleBadge(step.role);
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'flex-start',
              }}
            >
              {/* Step Number & Icon Badge */}
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: `${step.accentColor}18`,
                  color: step.accentColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}
              >
                <StepIcon size={22} />
              </div>

              {/* Step Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Header: Title + Role Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: step.accentColor }}>
                      STEP {step.number}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {step.title}
                    </h3>
                  </div>

                  <span
                    style={{
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.65rem',
                      borderRadius: '9999px',
                      backgroundColor: roleBadge.bg,
                      color: roleBadge.color,
                    }}
                  >
                    {step.roleLabel}
                  </span>
                </div>

                {/* Description */}
                <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {step.desc}
                </p>

                {/* Sub-steps (for Step 5 Production Master Data) */}
                {step.substeps && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      marginBottom: '1rem',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-overlay, rgba(148, 163, 184, 0.05))',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {step.substeps.map((sub, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.825rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: step.accentColor, width: '26px' }}>{sub.num}</span>
                          <strong style={{ color: 'var(--text-heading)' }}>{sub.name}:</strong>
                          <span style={{ color: 'var(--text-secondary)' }}>{sub.desc}</span>
                        </div>
                        <Link
                          to={sub.url}
                          style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                        >
                          <span>Open</span>
                          <ExternalLink size={11} />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                {/* Prerequisites & Required Fields Row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.85rem', fontSize: '0.8125rem' }}>
                  {/* Prerequisites */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-heading)', minWidth: '110px' }}>
                      {t('tenantOnboarding.prerequisites', { defaultValue: 'Prerequisites' })}:
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{step.prereq}</span>
                  </div>

                  {/* Required Fields */}
                  {step.fields && step.fields.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-heading)', minWidth: '110px' }}>
                        {t('tenantOnboarding.requiredFields', { defaultValue: 'Required Fields' })}:
                      </span>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {step.fields.map((f, fIdx) => (
                          <span
                            key={fIdx}
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-overlay, rgba(148, 163, 184, 0.1))',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* What happens next */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-heading)', minWidth: '110px' }}>
                      {t('tenantOnboarding.whatHappens', { defaultValue: 'What Happens Next' })}:
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{step.whatHappens}</span>
                  </div>
                </div>

                {/* Action Link Button */}
                {step.actionUrl && step.actionLabel && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <Link
                      to={step.actionUrl}
                      className="btn btn--outline"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.8rem',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '8px',
                      }}
                    >
                      <span>{step.actionLabel}</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

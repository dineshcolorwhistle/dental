import React from 'react';
import { Shield, Wrench, Stethoscope, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface RoleBadgeProps {
  role?: string | null;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'xs',
  showIcon = true,
  className = '',
}) => {
  const { t } = useTranslation();
  if (!role) return null;

  const normalized = role.toUpperCase().trim();

  // Role Configurations
  let bg = '#F1F5F9';
  let color = '#475569';
  let border = '#E2E8F0';
  let labelKey = 'userRole.user';
  let defaultLabel = 'User';
  let IconComponent = User;

  if (normalized === 'ADMIN' || normalized === 'SUPER_ADMIN' || normalized === 'OWNER') {
    bg = '#F5F3FF';
    color = '#7C3AED';
    border = '#DDD6FE';
    labelKey = 'enums.userRole.ADMIN';
    defaultLabel = 'Admin';
    IconComponent = Shield;
  } else if (normalized === 'TECHNICIAN') {
    bg = '#EFF6FF';
    color = '#2563EB';
    border = '#BFDBFE';
    labelKey = 'enums.userRole.TECHNICIAN';
    defaultLabel = 'Technician';
    IconComponent = Wrench;
  } else if (normalized === 'DOCTOR') {
    bg = '#ECFDF5';
    color = '#059669';
    border = '#A7F3D0';
    labelKey = 'enums.userRole.DOCTOR';
    defaultLabel = 'Doctor';
    IconComponent = Stethoscope;
  }

  const iconSizes = {
    xs: 10,
    sm: 11,
    md: 13,
  };

  const fontSizes = {
    xs: '0.625rem',
    sm: '0.6875rem',
    md: '0.75rem',
  };

  const paddings = {
    xs: '1px 5px',
    sm: '2px 6px',
    md: '2px 8px',
  };

  return (
    <span
      className={`role-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        borderRadius: '999px',
        fontSize: fontSizes[size],
        fontWeight: 600,
        padding: paddings[size],
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {showIcon && <IconComponent size={iconSizes[size]} />}
      <span>{t(labelKey, { defaultValue: defaultLabel })}</span>
    </span>
  );
};


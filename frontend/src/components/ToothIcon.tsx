import React from 'react';

export interface ToothIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  className?: string;
}

/**
 * Professional Lucide-styled Tooth Icon for Odontogram representation.
 */
export const ToothIcon: React.FC<ToothIconProps> = ({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  className = '',
  style,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      {...props}
    >
      <path d="M12 4.5c-1.35 0-2.2.45-3.15 1.05-1.8 1.15-2.85 3.45-2.85 6.45 0 2.5 1 4.5 1.5 7 .4 2 1.5 3 2.5 3 1.5 0 2-1.5 2-3 0-1.5 0-2 0-3 0-1 1-2 2-2s2 1 2 2c0 1 0 1.5 0 3c0 1.5.5 3 2 3 1 0 2.1-1 2.5-3 .5-2.5 1.5-4.5 1.5-7 0-3-1.05-5.3-2.85-6.45-.95-.6-1.8-1.05-3.15-1.05z" />
    </svg>
  );
};

export const Tooth = ToothIcon;


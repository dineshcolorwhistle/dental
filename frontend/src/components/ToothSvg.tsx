import React from 'react';
import type { ToothPart, ToothPartsMap } from '../services';

interface ToothSvgProps {
  toothNumber: number;
  partsMap?: ToothPartsMap;
  selectedPart?: ToothPart | null;
  activeItem?: {
    itemId: string;
    itemType: 'DIAGNOSTIC' | 'TREATMENT';
    name: string;
    color: string;
    appliesToWholeTooth?: boolean;
  } | null;
  onSelectPart: (toothNumber: number, part: ToothPart) => void;
  onHoverPart?: (toothNumber: number, part: ToothPart | null) => void;
  disabled?: boolean;
}

export function getSurfaceDisplayName(
  toothNumber: number,
  part: ToothPart,
  locale: string = 'en'
): string {
  const isSpanish = locale.startsWith('es');
  const quadrant = Math.floor(toothNumber / 10);
  const isRightQuadrant = quadrant === 1 || quadrant === 4 || quadrant === 5 || quadrant === 8;
  const isUpperArch = quadrant === 1 || quadrant === 2 || quadrant === 5 || quadrant === 6;

  switch (part) {
    case 'center':
      return isSpanish ? 'Oclusal / Incisal' : 'Occlusal / Incisal';
    case 'top':
      return isSpanish ? 'Zona Cervical Superior' : 'Upper Cervical / Apical';
    case 'upper_inner':
      return isUpperArch
        ? isSpanish ? 'Vestibular Superior' : 'Vestibular (Upper)'
        : isSpanish ? 'Lingual Superior' : 'Lingual (Upper)';
    case 'right':
      return isRightQuadrant
        ? isSpanish ? 'Mesial (Hacia línea media)' : 'Mesial (Towards Midline)'
        : isSpanish ? 'Distal (Opuesto a línea media)' : 'Distal (Away from Midline)';
    case 'lower_inner':
      return isUpperArch
        ? isSpanish ? 'Palatino Inferior' : 'Palatal (Lower)'
        : isSpanish ? 'Vestibular Inferior' : 'Vestibular (Lower)';
    case 'bottom':
      return isSpanish ? 'Zona Cervical Inferior' : 'Lower Cervical / Apical';
    case 'left':
      return isRightQuadrant
        ? isSpanish ? 'Distal (Opuesto a línea media)' : 'Distal (Away from Midline)'
        : isSpanish ? 'Mesial (Hacia línea media)' : 'Mesial (Towards Midline)';
    case 'whole':
      return isSpanish ? 'Diente Completo' : 'Whole Tooth';
    default:
      return part;
  }
}

export const ToothSvg: React.FC<ToothSvgProps> = ({
  toothNumber,
  partsMap = {},
  onSelectPart,
  onHoverPart,
  disabled = false,
}) => {
  const wholeToothFinding = partsMap.whole;

  // Helper to determine fill color for each part
  const getPartFill = (part: ToothPart) => {
    if (partsMap[part]?.color) {
      return partsMap[part]!.color;
    }
    if (wholeToothFinding?.color && part !== 'whole') {
      return wholeToothFinding.color;
    }
    return '#FFFFFF';
  };

  const getPartStroke = (part: ToothPart) => {
    if (partsMap[part]?.color || wholeToothFinding?.color) {
      return 'rgba(0,0,0,0.3)';
    }
    return '#64748B'; // slate-500
  };

  const handleClick = (e: React.MouseEvent, part: ToothPart) => {
    e.stopPropagation();
    if (disabled) return;
    onSelectPart(toothNumber, part);
  };

  const handleMouseEnter = (part: ToothPart) => {
    if (onHoverPart) {
      onHoverPart(toothNumber, part);
    }
  };

  const handleMouseLeave = () => {
    if (onHoverPart) {
      onHoverPart(toothNumber, null);
    }
  };

  // Annular sector path builder
  // cx=20, cy=20
  // Inner ring: r_in = 6, r_out = 13.5
  // Angles:
  // Top inner: -135° to -45°
  // Right: -45° to 45°
  // Bottom inner: 45° to 135°
  // Left: 135° to 225°
  // Outer caps:
  // Top: r_in = 14.5, r_out = 18.5, angle -135° to -45°
  // Bottom: r_in = 14.5, r_out = 18.5, angle 45° to 135°

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2px',
        userSelect: 'none',
        width: '46px',
      }}
    >
      {/* Tooth Number */}
      <div
        onClick={(e) => handleClick(e, 'whole')}
        onMouseEnter={() => handleMouseEnter('whole')}
        onMouseLeave={handleMouseLeave}
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: wholeToothFinding ? wholeToothFinding.color : 'var(--text-heading, #1E293B)',
          marginBottom: '2px',
          cursor: disabled ? 'default' : 'pointer',
          padding: '1px 4px',
          borderRadius: '4px',
          backgroundColor: wholeToothFinding ? `${wholeToothFinding.color}15` : 'transparent',
          transition: 'all 0.15s ease',
        }}
        title={`Tooth ${toothNumber} - Click for whole tooth`}
      >
        {toothNumber}
      </div>

      {/* 7-Part SVG Diagram */}
      <svg
        viewBox="0 0 40 48"
        width="44"
        height="48"
        style={{
          overflow: 'visible',
          filter: wholeToothFinding ? `drop-shadow(0 0 2px ${wholeToothFinding.color}80)` : 'none',
        }}
      >
        {/* 1. TOP OUTER CAP (Uppermost section) */}
        {/* r_in = 14.2, r_out = 18.2 from -135° to -45° */}
        <path
          d="M 9.96 9.96 A 14.2 14.2 0 0 1 30.04 9.96 L 32.87 7.13 A 18.2 18.2 0 0 0 7.13 7.13 Z"
          fill={getPartFill('top')}
          stroke={getPartStroke('top')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'top')}
          onMouseEnter={() => handleMouseEnter('top')}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        >
          <title>{`Tooth ${toothNumber} - ${getSurfaceDisplayName(toothNumber, 'top')}`}</title>
        </path>

        {/* 2. UPPER INNER (Ring segment directly above center) */}
        {/* r_in = 5.8, r_out = 13.2 from -135° to -45° */}
        <path
          d="M 15.9 15.9 A 5.8 5.8 0 0 1 24.1 15.9 L 29.33 10.67 A 13.2 13.2 0 0 0 10.67 10.67 Z"
          fill={getPartFill('upper_inner')}
          stroke={getPartStroke('upper_inner')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'upper_inner')}
          onMouseEnter={() => handleMouseEnter('upper_inner')}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        >
          <title>{`Tooth ${toothNumber} - ${getSurfaceDisplayName(toothNumber, 'upper_inner')}`}</title>
        </path>

        {/* 3. RIGHT (Ring segment to the right of center) */}
        {/* r_in = 5.8, r_out = 13.2 from -45° to 45° */}
        <path
          d="M 24.1 15.9 A 5.8 5.8 0 0 1 24.1 24.1 L 29.33 29.33 A 13.2 13.2 0 0 0 29.33 10.67 Z"
          fill={getPartFill('right')}
          stroke={getPartStroke('right')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'right')}
          onMouseEnter={() => handleMouseEnter('right')}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        >
          <title>{`Tooth ${toothNumber} - ${getSurfaceDisplayName(toothNumber, 'right')}`}</title>
        </path>

        {/* 4. LOWER INNER (Ring segment directly below center) */}
        {/* r_in = 5.8, r_out = 13.2 from 45° to 135° */}
        <path
          d="M 24.1 24.1 A 5.8 5.8 0 0 1 15.9 24.1 L 10.67 29.33 A 13.2 13.2 0 0 0 29.33 29.33 Z"
          fill={getPartFill('lower_inner')}
          stroke={getPartStroke('lower_inner')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'lower_inner')}
          onMouseEnter={() => handleMouseEnter('lower_inner')}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        >
          <title>{`Tooth ${toothNumber} - ${getSurfaceDisplayName(toothNumber, 'lower_inner')}`}</title>
        </path>

        {/* 5. LEFT (Ring segment to the left of center) */}
        {/* r_in = 5.8, r_out = 13.2 from 135° to 225° */}
        <path
          d="M 15.9 24.1 A 5.8 5.8 0 0 1 15.9 15.9 L 10.67 10.67 A 13.2 13.2 0 0 0 10.67 29.33 Z"
          fill={getPartFill('left')}
          stroke={getPartStroke('left')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'left')}
          onMouseEnter={() => handleMouseEnter('left')}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        >
          <title>{`Tooth ${toothNumber} - ${getSurfaceDisplayName(toothNumber, 'left')}`}</title>
        </path>

        {/* 6. BOTTOM OUTER CAP (Bottommost section) */}
        {/* r_in = 14.2, r_out = 18.2 from 45° to 135° */}
        <path
          d="M 30.04 30.04 A 14.2 14.2 0 0 1 9.96 30.04 L 7.13 32.87 A 18.2 18.2 0 0 0 32.87 32.87 Z"
          fill={getPartFill('bottom')}
          stroke={getPartStroke('bottom')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'bottom')}
          onMouseEnter={() => handleMouseEnter('bottom')}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        >
          <title>{`Tooth ${toothNumber} - ${getSurfaceDisplayName(toothNumber, 'bottom')}`}</title>
        </path>

        {/* 7. CENTER (Central circle) */}
        <circle
          cx="20"
          cy="20"
          r="5.5"
          fill={getPartFill('center')}
          stroke={getPartStroke('center')}
          strokeWidth="1.1"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'center')}
          onMouseEnter={() => handleMouseEnter('center')}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        >
          <title>{`Tooth ${toothNumber} - ${getSurfaceDisplayName(toothNumber, 'center')}`}</title>
        </circle>

        {/* 8. WHOLE TOOTH STATUS BAR (Horizontal bar underneath) */}
        <rect
          x="8"
          y="42"
          width="24"
          height="4.5"
          rx="2.2"
          fill={wholeToothFinding ? wholeToothFinding.color : '#E2E8F0'}
          stroke={wholeToothFinding ? 'rgba(0,0,0,0.3)' : '#94A3B8'}
          strokeWidth="0.9"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'whole')}
          onMouseEnter={() => handleMouseEnter('whole')}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'all 0.15s ease' }}
        >
          <title>{`Tooth ${toothNumber} - ${getSurfaceDisplayName(toothNumber, 'whole')}`}</title>
        </rect>
      </svg>
    </div>
  );
};


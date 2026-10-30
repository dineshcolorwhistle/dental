import React, { useRef } from 'react';
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
  onHoverPart?: (toothNumber: number, part: ToothPart | null, rect?: DOMRect) => void;
  disabled?: boolean;
  size?: 'md' | 'lg';
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
  size = 'lg',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wholeToothFinding = partsMap.whole;
  const isLg = size === 'lg';
  const containerWidth = isLg ? '54px' : '46px';
  const svgWidth = isLg ? '52' : '44';
  const svgHeight = isLg ? '58' : '48';

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

  const handleMouseEnter = (part: ToothPart, e?: React.MouseEvent) => {
    if (onHoverPart) {
      const rect = containerRef.current?.getBoundingClientRect() || (e?.currentTarget as Element | undefined)?.getBoundingClientRect();
      onHoverPart(toothNumber, part, rect);
    }
  };

  const handleMouseLeave = () => {
    if (onHoverPart) {
      onHoverPart(toothNumber, null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="tooth-container"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '2px',
        userSelect: 'none',
        width: containerWidth,
      }}
    >
      {/* Tooth Number */}
      <div
        onClick={(e) => handleClick(e, 'whole')}
        onMouseEnter={(e) => handleMouseEnter('whole', e)}
        onMouseLeave={handleMouseLeave}
        style={{
          fontSize: isLg ? '0.8125rem' : '0.75rem',
          fontWeight: 700,
          color: wholeToothFinding ? wholeToothFinding.color : 'var(--text-heading, #1E293B)',
          marginBottom: isLg ? '3px' : '2px',
          cursor: disabled ? 'default' : 'pointer',
          padding: isLg ? '1px 5px' : '1px 4px',
          borderRadius: '4px',
          backgroundColor: wholeToothFinding ? `${wholeToothFinding.color}15` : 'transparent',
          transition: 'all 0.15s ease',
        }}
      >
        {toothNumber}
      </div>

      {/* 7-Part SVG Diagram */}
      <svg
        viewBox="0 0 40 48"
        width={svgWidth}
        height={svgHeight}
        style={{
          overflow: 'visible',
          filter: wholeToothFinding ? `drop-shadow(0 0 2px ${wholeToothFinding.color}80)` : 'none',
        }}
      >
        {/* 1. TOP OUTER CAP (Uppermost section) */}
        <path
          d="M 9.96 9.96 A 14.2 14.2 0 0 1 30.04 9.96 L 32.87 7.13 A 18.2 18.2 0 0 0 7.13 7.13 Z"
          fill={getPartFill('top')}
          stroke={getPartStroke('top')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'top')}
          onMouseEnter={(e) => handleMouseEnter('top', e)}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        />

        {/* 2. UPPER INNER (Ring segment directly above center) */}
        <path
          d="M 15.9 15.9 A 5.8 5.8 0 0 1 24.1 15.9 L 29.33 10.67 A 13.2 13.2 0 0 0 10.67 10.67 Z"
          fill={getPartFill('upper_inner')}
          stroke={getPartStroke('upper_inner')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'upper_inner')}
          onMouseEnter={(e) => handleMouseEnter('upper_inner', e)}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        />

        {/* 3. RIGHT (Ring segment to the right of center) */}
        <path
          d="M 24.1 15.9 A 5.8 5.8 0 0 1 24.1 24.1 L 29.33 29.33 A 13.2 13.2 0 0 0 29.33 10.67 Z"
          fill={getPartFill('right')}
          stroke={getPartStroke('right')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'right')}
          onMouseEnter={(e) => handleMouseEnter('right', e)}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        />

        {/* 4. LOWER INNER (Ring segment directly below center) */}
        <path
          d="M 24.1 24.1 A 5.8 5.8 0 0 1 15.9 24.1 L 10.67 29.33 A 13.2 13.2 0 0 0 29.33 29.33 Z"
          fill={getPartFill('lower_inner')}
          stroke={getPartStroke('lower_inner')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'lower_inner')}
          onMouseEnter={(e) => handleMouseEnter('lower_inner', e)}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        />

        {/* 5. LEFT (Ring segment to the left of center) */}
        <path
          d="M 15.9 24.1 A 5.8 5.8 0 0 1 15.9 15.9 L 10.67 10.67 A 13.2 13.2 0 0 0 10.67 29.33 Z"
          fill={getPartFill('left')}
          stroke={getPartStroke('left')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'left')}
          onMouseEnter={(e) => handleMouseEnter('left', e)}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        />

        {/* 6. BOTTOM OUTER CAP (Bottommost section) */}
        <path
          d="M 30.04 30.04 A 14.2 14.2 0 0 1 9.96 30.04 L 7.13 32.87 A 18.2 18.2 0 0 0 32.87 32.87 Z"
          fill={getPartFill('bottom')}
          stroke={getPartStroke('bottom')}
          strokeWidth="1.1"
          strokeLinejoin="round"
          cursor={disabled ? 'default' : 'pointer'}
          onClick={(e) => handleClick(e, 'bottom')}
          onMouseEnter={(e) => handleMouseEnter('bottom', e)}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        />

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
          onMouseEnter={(e) => handleMouseEnter('center', e)}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'fill 0.15s ease' }}
        />

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
          onMouseEnter={(e) => handleMouseEnter('whole', e)}
          onMouseLeave={handleMouseLeave}
          style={{ transition: 'all 0.15s ease' }}
        />
      </svg>
    </div>
  );
};


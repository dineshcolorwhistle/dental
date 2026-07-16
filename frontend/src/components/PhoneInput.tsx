import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface PhoneInputProps {
  id?: string;
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}

const countryCodes = [
  { code: '+52', name: 'México' },
  { code: '+1', name: 'USA / Canada' },
  { code: '+34', name: 'España' },
  { code: '+57', name: 'Colombia' },
  { code: '+54', name: 'Argentina' },
  { code: '+55', name: 'Brasil' },
  { code: '+56', name: 'Chile' },
  { code: '+51', name: 'Perú' },
  { code: '+502', name: 'Guatemala' },
  { code: '+506', name: 'Costa Rica' },
  { code: '+507', name: 'Panamá' },
  { code: '+91', name: 'India' },
];

const parsePhone = (val?: string | null) => {
  if (!val) return { code: '+52', num: '' };

  const sortedCodes = [...countryCodes].sort((a, b) => b.code.length - a.code.length);

  for (const c of sortedCodes) {
    if (val.startsWith(c.code)) {
      return { code: c.code, num: val.substring(c.code.length).trim() };
    }
  }

  if (val.startsWith('+')) {
    const match = val.match(/^(\+\d{1,4})\s*(.*)$/);
    if (match) {
      return { code: match[1], num: match[2] };
    }
  }

  return { code: '+52', num: val };
};

export function PhoneInput({ id, value, onChange, disabled, placeholder, required }: PhoneInputProps) {
  const { code, num } = parsePhone(value);
  const [localCountryCode, setLocalCountryCode] = useState(code);
  const [localNumber, setLocalNumber] = useState(num);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { code: newCode, num: newNum } = parsePhone(value);
    setLocalCountryCode(newCode);
    setLocalNumber(newNum);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCountryChange = (nextCode: string) => {
    setLocalCountryCode(nextCode);
    if (localNumber.trim()) {
      onChange(`${nextCode} ${localNumber.trim()}`);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextNum = e.target.value;
    setLocalNumber(nextNum);
    if (nextNum.trim()) {
      onChange(`${localCountryCode} ${nextNum.trim()}`);
    } else {
      onChange('');
    }
  };

  // Get active list of country codes including custom selection
  const listCodes = [...countryCodes];
  if (localCountryCode && !countryCodes.some((c) => c.code === localCountryCode)) {
    listCodes.push({
      code: localCountryCode,
      name: 'Custom',
    });
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', width: '100%', position: 'relative' }}>
      {/* Custom Country Code Dropdown */}
      <div ref={dropdownRef} style={{ position: 'relative', width: '80px', flexShrink: 0 }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className="form-input"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.625rem 0.5rem 0.625rem 0.75rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            width: '100%',
            gap: '0.25rem',
            backgroundColor: 'var(--bg-overlay)',
          }}
        >
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            {localCountryCode}
          </span>
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform var(--transition-fast)',
            }}
          />
        </button>

        {isOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '260px',
            maxHeight: '220px',
            overflowY: 'auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            padding: '0.375rem',
          }}>
            {listCodes.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  handleCountryChange(c.code);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.8125rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(111, 174, 217, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span>{c.name}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{c.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Phone Number Input */}
      <input
        id={id}
        type="tel"
        className="form-input"
        placeholder={placeholder || '55 1234 5678'}
        value={localNumber}
        onChange={handleNumberChange}
        disabled={disabled}
        required={required}
        style={{ flexGrow: 1 }}
      />
    </div>
  );
}

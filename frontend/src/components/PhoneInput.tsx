import React, { useState, useEffect } from 'react';
import { SearchableSelect } from './SearchableSelect';

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

  useEffect(() => {
    const { code: newCode, num: newNum } = parsePhone(value);
    setLocalCountryCode(newCode);
    setLocalNumber(newNum);
  }, [value]);

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

  // Convert country codes to SearchableSelect options
  const options = countryCodes.map((c) => ({
    value: c.code,
    label: `${c.code} (${c.name})`,
  }));

  // Append current custom code if not in static list
  const dropdownOptions = [...options];
  if (!countryCodes.some((c) => c.code === localCountryCode)) {
    dropdownOptions.push({
      value: localCountryCode,
      label: localCountryCode,
    });
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
      <div style={{ width: '150px', flexShrink: 0 }}>
        <SearchableSelect
          options={dropdownOptions}
          value={localCountryCode}
          onChange={handleCountryChange}
          disabled={disabled}
          placeholder="+52"
        />
      </div>
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

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
}

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  className = '',
  error = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const { t } = useTranslation();

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updateCoords = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Update coords on open, window resize, or scroll events
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      document.addEventListener('scroll', updateCoords, { capture: true });
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      document.removeEventListener('scroll', updateCoords, { capture: true });
    };
  }, [isOpen, updateCoords]);

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search query
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset highlighted index when options filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
      setSearchTerm('');
    }
  }, [isOpen]);

  // Click outside to close (supporting portal dropdown container)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isInsideContainer = containerRef.current && containerRef.current.contains(target);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(target);

      if (!isInsideContainer && !isInsideDropdown) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Keyboard navigation logic
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const option = filteredOptions[highlightedIndex];
        onChange(option.value);
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) => {
          const nextIndex = prev < filteredOptions.length - 1 ? prev + 1 : 0;
          scrollOptionIntoView(nextIndex);
          return nextIndex;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => {
          const nextIndex = prev > 0 ? prev - 1 : filteredOptions.length - 1;
          scrollOptionIntoView(nextIndex);
          return nextIndex;
        });
      }
    }
  };

  const scrollOptionIntoView = (index: number) => {
    if (optionsListRef.current) {
      const optionElements = optionsListRef.current.querySelectorAll('.searchable-select__option');
      const targetElement = optionElements[index] as HTMLElement;
      if (targetElement) {
        targetElement.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const selectOption = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={`searchable-select ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`form-input searchable-select__trigger ${
          error ? 'form-input--error' : ''
        } ${isOpen ? 'searchable-select__trigger--active' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedOption ? 'searchable-select__label' : 'searchable-select__placeholder'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`searchable-select__arrow ${isOpen ? 'searchable-select__arrow--open' : ''}`}
        />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="searchable-select__dropdown"
          style={{
            position: 'fixed',
            top: `${coords.top + 4}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 9999,
          }}
        >
          <div className="searchable-select__search-wrapper">
            <Search size={14} className="searchable-select__search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="searchable-select__search-input"
              placeholder={t('common.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={disabled}
            />
            {searchTerm && (
              <button
                type="button"
                className="searchable-select__search-clear"
                onClick={() => setSearchTerm('')}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div
            ref={optionsListRef}
            className="searchable-select__options"
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <div className="searchable-select__no-results">{t('common.noResults')}</div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    className={`searchable-select__option ${
                      isSelected ? 'searchable-select__option--selected' : ''
                    } ${isHighlighted ? 'searchable-select__option--highlighted' : ''}`}
                    onClick={() => selectOption(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={14} className="searchable-select__check" />}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

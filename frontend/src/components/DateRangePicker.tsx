import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  presetType: string; // 'today', 'thisMonth', 'custom', etc.
  onChange: (startDate: string, endDate: string, presetType: string) => void;
  allowedPresets?: string[];
}

export function DateRangePicker({ startDate, endDate, presetType, onChange, allowedPresets }: DateRangePickerProps) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse YYYY-MM-DD to local Date object
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Format Date object to YYYY-MM-DD (local timezone)
  const formatDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Local state for temporary selections during pick
  const [tempStart, setTempStart] = useState<string | null>(null);
  const [tempEnd, setTempEnd] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Month shown on the left calendar
  const [viewDate, setViewDate] = useState<Date>(() => {
    return startDate ? parseLocalDate(startDate) : new Date();
  });

  // Sync temporary selection when props change
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
    if (startDate) {
      setViewDate(parseLocalDate(startDate));
    }
  }, [startDate, endDate]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset temp selections to prop values on close
        setTempStart(startDate);
        setTempEnd(endDate);
        setHoveredDate(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [startDate, endDate]);

  // Presets definition
  const allPresets = [
    { value: 'today', label: t('expenses.dateFilters.today', { defaultValue: 'Today' }) },
    { value: 'yesterday', label: t('expenses.dateFilters.yesterday', { defaultValue: 'Yesterday' }) },
    { value: 'last7Days', label: t('expenses.dateFilters.last7Days', { defaultValue: 'Last 7 Days' }) },
    { value: 'last30Days', label: t('expenses.dateFilters.last30Days', { defaultValue: 'Last 30 Days' }) },
    { value: 'thisMonth', label: t('expenses.dateFilters.thisMonth', { defaultValue: 'This Month' }) },
    { value: 'lastMonth', label: t('expenses.dateFilters.lastMonth', { defaultValue: 'Last Month' }) },
    { value: 'last3Months', label: t('expenses.dateFilters.last3Months', { defaultValue: 'Last 3 Months' }) },
    { value: 'last6Months', label: t('expenses.dateFilters.last6Months', { defaultValue: 'Last 6 Months' }) },
    { value: 'thisYear', label: t('expenses.dateFilters.thisYear', { defaultValue: 'This Year' }) },
    { value: 'lastYear', label: t('expenses.dateFilters.lastYear', { defaultValue: 'Last Year' }) },
    { value: 'custom', label: t('expenses.dateFilters.custom', { defaultValue: 'Custom Range' }) },
  ];

  const presets = allowedPresets
    ? allPresets.filter((p) => allowedPresets.includes(p.value))
    : allPresets;

  // Get dates for presets
  const getPresetRange = (val: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (val) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case 'last7Days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'last30Days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last3Months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last6Months':
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'lastYear':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        return null;
    }
    return { start, end };
  };

  const handlePresetClick = (val: string) => {
    if (val === 'custom') {
      // Just keep dropdown open and let them click on calendar
      return;
    }
    const range = getPresetRange(val);
    if (range) {
      const sStr = formatDateStr(range.start);
      const eStr = formatDateStr(range.end);
      onChange(sStr, eStr, val);
      setIsOpen(false);
    }
  };

  // Go to previous month
  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  // Go to next month
  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  // Calendar generation logic
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sun, 6 is Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Next month padding (up to 42 days total)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  };

  const handleDateClick = (cellDate: Date) => {
    const cellDateStr = formatDateStr(cellDate);

    if (!tempStart || (tempStart && tempEnd)) {
      // First click: select start date
      setTempStart(cellDateStr);
      setTempEnd(null);
    } else {
      // Second click: select end date
      if (cellDateStr >= tempStart) {
        setTempEnd(cellDateStr);
        onChange(tempStart, cellDateStr, 'custom');
        setIsOpen(false);
      } else {
        // If clicked date is before start date, treat it as new start date
        setTempStart(cellDateStr);
      }
    }
  };

  const handleDateMouseEnter = (cellDate: Date) => {
    if (tempStart && !tempEnd) {
      setHoveredDate(formatDateStr(cellDate));
    }
  };

  const getLeftMonth = () => viewDate;
  const getRightMonth = () => new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);

  const renderMonthCalendar = (monthDate: Date, isRightMonth: boolean) => {
    const days = getDaysInMonth(monthDate);
    const monthName = monthDate.toLocaleDateString(i18n.language?.startsWith('es') ? 'es-MX' : 'en-US', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const year = monthDate.getFullYear();

    const weekdays = i18n.language?.startsWith('es')
      ? ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
      : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
      <div className="drp-calendar">
        <div className="drp-calendar__header">
          {!isRightMonth ? (
            <button type="button" className="drp-calendar__nav-btn" onClick={handlePrevMonth}>
              <ChevronLeft size={16} />
            </button>
          ) : <div style={{ width: '28px' }} />}
          
          <span className="drp-calendar__month-title">
            {capitalizedMonth} {year}
          </span>
          
          {isRightMonth ? (
            <button type="button" className="drp-calendar__nav-btn" onClick={handleNextMonth}>
              <ChevronRight size={16} />
            </button>
          ) : <div style={{ width: '28px' }} />}
        </div>
        
        <div className="drp-calendar__weekdays">
          {weekdays.map((w, idx) => (
            <div key={idx} className="drp-calendar__weekday">
              {w}
            </div>
          ))}
        </div>
        
        <div className="drp-calendar__days">
          {days.map((cell, idx) => {
            const cellStr = formatDateStr(cell.date);
            const isStart = tempStart === cellStr;
            const isEnd = tempEnd === cellStr;
            
            let isRange = false;
            if (tempStart && tempEnd) {
              isRange = cellStr > tempStart && cellStr < tempEnd;
            }

            let isHovered = false;
            if (tempStart && !tempEnd && hoveredDate && cellStr >= tempStart && cellStr <= hoveredDate) {
              isHovered = cellStr > tempStart && cellStr <= hoveredDate;
            }

            return (
              <button
                key={idx}
                type="button"
                className={`drp-calendar__day ${!cell.isCurrentMonth ? 'drp-calendar__day--muted' : ''} ${isStart ? 'drp-calendar__day--start' : ''} ${isEnd ? 'drp-calendar__day--end' : ''} ${isRange ? 'drp-calendar__day--range' : ''} ${isHovered ? 'drp-calendar__day--hovered' : ''}`}
                onClick={() => handleDateClick(cell.date)}
                onMouseEnter={() => handleDateMouseEnter(cell.date)}
              >
                <span>{cell.date.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Localized date formatting for the trigger display
  const formatDateRangeDisplay = () => {
    if (!startDate || !endDate) return t('common.selectOption', { defaultValue: 'Select date range...' });
    const fmt = (dStr: string) => {
      const [y, m, d] = dStr.split('-');
      return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(
        i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
        { year: 'numeric', month: '2-digit', day: '2-digit' }
      );
    };
    return `${fmt(startDate)} ${t('common.to', { defaultValue: 'to' })} ${fmt(endDate)}`;
  };

  return (
    <div className="date-range-picker-wrap" ref={containerRef} style={{ position: 'relative' }}>
      <span className="drp-label" style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>
        {t('expenses.dateFilters.dateRangeLabel', { defaultValue: 'Date Range' })}
      </span>
      <button
        type="button"
        className={`drp-trigger-btn ${isOpen ? 'drp-trigger-btn--active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Calendar size={16} className="drp-trigger-btn__icon" />
        <span className="drp-trigger-btn__text">{formatDateRangeDisplay()}</span>
        <ChevronRight size={14} className="drp-trigger-btn__chevron" style={{ transform: 'rotate(90deg)' }} />
      </button>

      {isOpen && (
        <div className="drp-popover">
          <div className="drp-popover__body">
            {/* Presets List */}
            <div className="drp-presets">
              {presets.map((p) => {
                const isActive = presetType === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    className={`drp-presets__btn ${isActive ? 'drp-presets__btn--active' : ''}`}
                    onClick={() => handlePresetClick(p.value)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Calendars Container */}
            <div className="drp-calendars">
              {renderMonthCalendar(getLeftMonth(), false)}
              {renderMonthCalendar(getRightMonth(), true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

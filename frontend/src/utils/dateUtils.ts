/**
 * Date & Currency Formatting Utilities
 *
 * Centralized utilities for timezone-aware date formatting and currency display.
 * All functions accept a timezone parameter (IANA identifier) to ensure dates
 * are displayed in the tenant's business timezone, not the browser's local timezone.
 */

/**
 * Get the display locale based on the i18n language.
 * Maps app languages to proper Intl locale identifiers.
 */
export function getDisplayLocale(language?: string): string {
  return language?.startsWith('es') ? 'es-MX' : 'en-US';
}

/**
 * Normalizes a date-only string or ISO string to noon UTC.
 * This prevents calendar dates (e.g. "2026-09-02") from shifting backward
 * to the previous day when formatted in negative UTC timezones (like Mexico UTC-6).
 */
export function normalizeCalendarDate(date: string | Date): Date {
  if (typeof date === 'string') {
    // If it's YYYY-MM-DD or YYYY-MM-DDT00:00:00...
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
      const datePart = date.slice(0, 10);
      return new Date(`${datePart}T12:00:00.000Z`);
    }
  }
  return new Date(date);
}

/**
 * Format a calendar date string or Date object for display.
 * Always displays the intended calendar date regardless of local browser timezone.
 */
export function formatDate(
  date: string | Date | null | undefined,
  language: string,
  timezone: string = 'America/Mexico_City',
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '—';

  const locale = getDisplayLocale(language);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
    ...options,
  };

  try {
    const d = normalizeCalendarDate(date);
    return d.toLocaleDateString(locale, defaultOptions);
  } catch {
    return new Date(date).toLocaleDateString(locale, {
      ...defaultOptions,
      timeZone: 'America/Mexico_City',
    });
  }
}

/**
 * Format a date with time for display (for timestamps like createdAt, updatedAt, startedAt).
 * Converts the UTC timestamp to the tenant's business timezone.
 */
export function formatDateTime(
  date: string | Date | null | undefined,
  language: string,
  timezone: string = 'America/Mexico_City',
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '—';

  const locale = getDisplayLocale(language);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    ...options,
  };

  try {
    return new Date(date).toLocaleDateString(locale, defaultOptions);
  } catch {
    return new Date(date).toLocaleDateString(locale, {
      ...defaultOptions,
      timeZone: 'America/Mexico_City',
    });
  }
}

/**
 * Format time only (for timestamps).
 */
export function formatTime(
  date: string | Date | null | undefined,
  language: string,
  timezone: string = 'America/Mexico_City',
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '—';

  const locale = getDisplayLocale(language);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    ...options,
  };

  try {
    return new Date(date).toLocaleTimeString(locale, defaultOptions);
  } catch {
    return new Date(date).toLocaleTimeString(locale, {
      ...defaultOptions,
      timeZone: 'America/Mexico_City',
    });
  }
}

/**
 * Format currency amount for display.
 */
export function formatCurrency(
  amount: number,
  language: string,
  currency: string = 'MXN',
): string {
  const locale = getDisplayLocale(language);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get today's date key (YYYY-MM-DD) in the specified timezone.
 */
export function getTodayKeyInTz(timezone: string = 'America/Mexico_City'): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Get a date key (YYYY-MM-DD) for any Date in the specified timezone.
 */
export function getDateKeyInTz(date: Date, timezone: string = 'America/Mexico_City'): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Default timezone fallback.
 */
export const DEFAULT_TIMEZONE = 'America/Mexico_City';
export const DEFAULT_CURRENCY = 'MXN';

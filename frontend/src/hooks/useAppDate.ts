import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context';
import {
  formatDate as formatDateUtil,
  formatDateTime as formatDateTimeUtil,
  formatTime as formatTimeUtil,
  formatCurrency as formatCurrencyUtil,
  normalizeCalendarDate,
  getTodayKeyInTz,
  getDateKeyInTz,
  DEFAULT_TIMEZONE,
  DEFAULT_CURRENCY,
} from '../utils/dateUtils';

/**
 * Custom hook providing timezone-aware and locale-aware date and currency formatting.
 * Automatically injects the authenticated tenant's timezone (`user?.timezone`) and active language.
 *
 * Use this in all new and existing components to guarantee consistent date handling across the app.
 */
export function useAppDate() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const timezone = user?.timezone || DEFAULT_TIMEZONE;
  const language = i18n.language;

  const formatDate = useCallback(
    (date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => {
      return formatDateUtil(date, language, timezone, options);
    },
    [language, timezone],
  );

  const formatDateTime = useCallback(
    (date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => {
      return formatDateTimeUtil(date, language, timezone, options);
    },
    [language, timezone],
  );

  const formatTime = useCallback(
    (date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => {
      return formatTimeUtil(date, language, timezone, options);
    },
    [language, timezone],
  );

  const formatCurrency = useCallback(
    (amount: number, currency: string = DEFAULT_CURRENCY) => {
      return formatCurrencyUtil(amount, language, currency);
    },
    [language],
  );

  /**
   * Returns today's date formatted as YYYY-MM-DD in the tenant's timezone (ideal for date picker inputs).
   */
  const getTodayKey = useCallback(() => {
    return getTodayKeyInTz(timezone);
  }, [timezone]);

  /**
   * Formats a pure calendar date string (YYYY-MM-DD) into a noon UTC ISO string (`YYYY-MM-DDT12:00:00.000Z`)
   * before sending to the backend API. This prevents negative-UTC timezone backward shifts.
   */
  const toNoonUtc = useCallback((dateStr: string) => {
    if (!dateStr) return '';
    const datePart = dateStr.slice(0, 10);
    return `${datePart}T12:00:00.000Z`;
  }, []);

  return {
    formatDate,
    formatDateTime,
    formatTime,
    formatCurrency,
    getTodayKey,
    toNoonUtc,
    normalizeCalendarDate,
    getDateKeyInTz: (date: Date) => getDateKeyInTz(date, timezone),
    timezone,
    language,
  };
}

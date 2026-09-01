/**
 * Recurrence Utility Module
 *
 * Pure-function engine for computing recurring reminder occurrences.
 * Handles Daily, Weekly, Monthly (day-of-month & positional weekday),
 * and Yearly recurrence with configurable intervals and end conditions.
 *
 * Design principles:
 * - All dates are calendar dates stored at noon UTC (via parseCalendarDate).
 * - Maximum 365 occurrences per series.
 * - Hard cap: never generate dates beyond 3 years from the start date.
 */

export interface RecurrenceConfig {
  recurrence: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: Date;
  repeatInterval: number;
  endType: 'ON_DATE' | 'AFTER' | 'NEVER';
  endDate?: Date | null;
  endAfterOccurrences?: number | null;
  weeklyDays?: number[];
  monthlyPattern?: 'DAY_OF_MONTH' | 'POSITIONAL_WEEKDAY';
  monthlyDayOfMonth?: number;
  monthlyWeekPosition?: 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST';
  monthlyWeekDay?: number;
}

const MAX_OCCURRENCES = 365;
const MAX_YEARS = 3;

/**
 * Get a date that is MAX_YEARS from the given date.
 */
function getMaxDate(from: Date): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + MAX_YEARS);
  return d;
}

/**
 * Create a noon-UTC date from year/month/day.
 */
function makeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

/**
 * Extract year/month/day from a Date (assuming noon UTC storage).
 */
function dateParts(d: Date): { year: number; month: number; day: number } {
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
  };
}

/**
 * Get the YYYY-MM-DD key for a Date (UTC).
 */
function dateKey(d: Date): string {
  const p = dateParts(d);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Get the day of week for a noon-UTC date. 0=Sun, 6=Sat.
 */
function getDayOfWeek(d: Date): number {
  return d.getUTCDay();
}

/**
 * Calculate the Nth weekday of a given month.
 * @param year - Full year
 * @param month - 0-based month
 * @param weekDay - 0=Sun, 6=Sat
 * @param position - FIRST, SECOND, THIRD, FOURTH, LAST
 * @returns Date at noon UTC, or null if not possible
 */
export function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekDay: number,
  position: 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST',
): Date | null {
  if (position === 'LAST') {
    // Start from last day of month and go backwards
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
    const lastDayOfMonth = lastDay.getUTCDate();

    for (let day = lastDayOfMonth; day >= 1; day--) {
      const d = makeDate(year, month, day);
      if (getDayOfWeek(d) === weekDay) {
        return d;
      }
    }
    return null;
  }

  const targetN =
    position === 'FIRST'
      ? 1
      : position === 'SECOND'
        ? 2
        : position === 'THIRD'
          ? 3
          : 4;

  let count = 0;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const d = makeDate(year, month, day);
    if (getDayOfWeek(d) === weekDay) {
      count++;
      if (count === targetN) {
        return d;
      }
    }
  }
  return null; // e.g., no 4th Friday in this month
}

/**
 * Get the next occurrence after `currentDate` for a given recurrence config.
 * Returns null if the series has ended.
 */
export function getNextOccurrence(
  config: RecurrenceConfig,
  currentDate: Date,
): Date | null {
  const maxDate = getMaxDate(config.startDate);

  switch (config.recurrence) {
    case 'DAILY':
      return getNextDaily(config, currentDate, maxDate);
    case 'WEEKLY':
      return getNextWeekly(config, currentDate, maxDate);
    case 'MONTHLY':
      return getNextMonthly(config, currentDate, maxDate);
    case 'YEARLY':
      return getNextYearly(config, currentDate, maxDate);
    default:
      return null;
  }
}

function getNextDaily(
  config: RecurrenceConfig,
  currentDate: Date,
  maxDate: Date,
): Date | null {
  const current = dateParts(currentDate);
  const next = makeDate(current.year, current.month, current.day + config.repeatInterval);

  return isWithinBounds(config, next, maxDate) ? next : null;
}

function getNextWeekly(
  config: RecurrenceConfig,
  currentDate: Date,
  maxDate: Date,
): Date | null {
  const days = config.weeklyDays?.slice().sort((a, b) => a - b) ?? [];
  if (days.length === 0) return null;

  const currentDow = getDayOfWeek(currentDate);
  const current = dateParts(currentDate);

  // Find the next day in the same week (if interval is 1) or
  // handle multi-week intervals properly

  // First, try to find the next day in the current interval-week
  const nextDayInWeek = days.find((d) => d > currentDow);
  if (nextDayInWeek !== undefined) {
    const daysToAdd = nextDayInWeek - currentDow;
    const next = makeDate(current.year, current.month, current.day + daysToAdd);
    if (isWithinBounds(config, next, maxDate)) return next;
    return null;
  }

  // Move to the first day of the next interval-week
  const daysUntilEndOfWeek = 6 - currentDow;
  const daysToNextWeekStart = daysUntilEndOfWeek + 1 + (config.repeatInterval - 1) * 7;
  const nextWeekSunday = makeDate(
    current.year,
    current.month,
    current.day + daysToNextWeekStart,
  );
  const nextWeekSundayDow = getDayOfWeek(nextWeekSunday);

  // Find the first selected day in the next interval-week
  const firstDay = days[0];
  const daysFromSunday = firstDay - nextWeekSundayDow;
  const next = makeDate(
    nextWeekSunday.getUTCFullYear(),
    nextWeekSunday.getUTCMonth(),
    nextWeekSunday.getUTCDate() + (daysFromSunday >= 0 ? daysFromSunday : daysFromSunday + 7),
  );

  return isWithinBounds(config, next, maxDate) ? next : null;
}

function getNextMonthly(
  config: RecurrenceConfig,
  currentDate: Date,
  maxDate: Date,
): Date | null {
  const current = dateParts(currentDate);
  let searchMonth = current.month;
  let searchYear = current.year;

  // Start searching from the next interval month
  searchMonth += config.repeatInterval;
  while (searchMonth > 11) {
    searchMonth -= 12;
    searchYear++;
  }

  // Search up to MAX_OCCURRENCES months ahead to find a valid date
  for (let attempts = 0; attempts < MAX_OCCURRENCES; attempts++) {
    const candidate = getMonthlyCandidate(config, searchYear, searchMonth);

    if (candidate && candidate.getTime() > currentDate.getTime()) {
      if (isWithinBounds(config, candidate, maxDate)) return candidate;
      return null;
    }

    // Move to next interval month
    searchMonth += config.repeatInterval;
    while (searchMonth > 11) {
      searchMonth -= 12;
      searchYear++;
    }

    // Safety: don't search beyond max date
    if (makeDate(searchYear, searchMonth, 1).getTime() > maxDate.getTime()) {
      return null;
    }
  }

  return null;
}

function getMonthlyCandidate(
  config: RecurrenceConfig,
  year: number,
  month: number,
): Date | null {
  if (config.monthlyPattern === 'DAY_OF_MONTH') {
    const dayOfMonth = config.monthlyDayOfMonth ?? 1;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    // Skip months where the day doesn't exist (e.g., day 31 in February)
    if (dayOfMonth > daysInMonth) {
      return null;
    }

    return makeDate(year, month, dayOfMonth);
  }

  if (config.monthlyPattern === 'POSITIONAL_WEEKDAY') {
    const position = config.monthlyWeekPosition ?? 'FIRST';
    const weekDay = config.monthlyWeekDay ?? 1;
    return getNthWeekdayOfMonth(year, month, weekDay, position);
  }

  return null;
}

function getNextYearly(
  config: RecurrenceConfig,
  currentDate: Date,
  maxDate: Date,
): Date | null {
  const start = dateParts(config.startDate);
  const current = dateParts(currentDate);

  let nextYear = current.year + config.repeatInterval;

  // Search up to MAX_YEARS * repeatInterval attempts
  for (let attempts = 0; attempts < MAX_OCCURRENCES; attempts++) {
    const daysInMonth = new Date(
      Date.UTC(nextYear, start.month + 1, 0),
    ).getUTCDate();

    // Skip if the day doesn't exist (e.g., Feb 29 in non-leap year)
    if (start.day <= daysInMonth) {
      const candidate = makeDate(nextYear, start.month, start.day);
      if (candidate.getTime() > currentDate.getTime()) {
        if (isWithinBounds(config, candidate, maxDate)) return candidate;
        return null;
      }
    }

    nextYear += config.repeatInterval;

    if (
      makeDate(nextYear, 0, 1).getTime() > maxDate.getTime()
    ) {
      return null;
    }
  }

  return null;
}

/**
 * Check if a candidate date is within the bounds of the series.
 */
function isWithinBounds(
  config: RecurrenceConfig,
  candidate: Date,
  maxDate: Date,
): boolean {
  if (candidate.getTime() > maxDate.getTime()) return false;

  if (config.endType === 'ON_DATE' && config.endDate) {
    if (candidate.getTime() > config.endDate.getTime()) return false;
  }

  // Note: AFTER check is done at the caller level using completedOccurrences counter
  return true;
}

/**
 * Generate all occurrences for a recurrence series.
 * @param config - The recurrence configuration
 * @param completedOccurrences - How many occurrences have already been completed (for AFTER end type)
 * @param maxCount - Maximum number of occurrences to generate (default 365)
 * @returns Array of occurrence dates
 */
export function generateOccurrences(
  config: RecurrenceConfig,
  completedOccurrences = 0,
  maxCount = MAX_OCCURRENCES,
): Date[] {
  const results: Date[] = [];
  const maxDate = getMaxDate(config.startDate);

  // For AFTER end type, limit total occurrences
  let remainingAfterCount = Infinity;
  if (
    config.endType === 'AFTER' &&
    config.endAfterOccurrences != null
  ) {
    remainingAfterCount = config.endAfterOccurrences - completedOccurrences;
    if (remainingAfterCount <= 0) return results;
  }

  const effectiveMax = Math.min(maxCount, remainingAfterCount);

  // The start date itself is the first occurrence
  if (isWithinBounds(config, config.startDate, maxDate)) {
    results.push(config.startDate);
  }

  let current = config.startDate;

  while (results.length < effectiveMax) {
    const next = getNextOccurrence(config, current);
    if (!next) break;

    // Additional check for AFTER end type
    if (
      config.endType === 'AFTER' &&
      config.endAfterOccurrences != null &&
      results.length + completedOccurrences >= config.endAfterOccurrences
    ) {
      break;
    }

    results.push(next);
    current = next;
  }

  return results;
}

/**
 * Check if a specific date is a valid occurrence in the series.
 * Used by the scheduler to determine if "today" should trigger a notification.
 */
export function isOccurrenceDate(
  config: RecurrenceConfig,
  dateToCheck: Date,
  completedOccurrences = 0,
): boolean {
  const checkKey = dateKey(dateToCheck);
  const maxDate = getMaxDate(config.startDate);

  // Quick bounds check
  if (dateToCheck.getTime() > maxDate.getTime()) return false;
  if (dateToCheck.getTime() < config.startDate.getTime()) return false;

  if (config.endType === 'ON_DATE' && config.endDate) {
    if (dateToCheck.getTime() > config.endDate.getTime()) return false;
  }

  // Check the start date itself
  if (dateKey(config.startDate) === checkKey) return true;

  switch (config.recurrence) {
    case 'DAILY':
      return isDailyOccurrence(config, dateToCheck);
    case 'WEEKLY':
      return isWeeklyOccurrence(config, dateToCheck);
    case 'MONTHLY':
      return isMonthlyOccurrence(config, dateToCheck, completedOccurrences);
    case 'YEARLY':
      return isYearlyOccurrence(config, dateToCheck);
    default:
      return false;
  }
}

function isDailyOccurrence(config: RecurrenceConfig, dateToCheck: Date): boolean {
  const startMs = config.startDate.getTime();
  const checkMs = dateToCheck.getTime();
  const diffDays = Math.round((checkMs - startMs) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return false;
  return diffDays % config.repeatInterval === 0;
}

function isWeeklyOccurrence(config: RecurrenceConfig, dateToCheck: Date): boolean {
  const days = config.weeklyDays ?? [];
  if (days.length === 0) return false;

  const checkDow = getDayOfWeek(dateToCheck);
  if (!days.includes(checkDow)) return false;

  // Check if this week aligns with the interval
  const startMs = config.startDate.getTime();
  const checkMs = dateToCheck.getTime();
  const diffDays = Math.round((checkMs - startMs) / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  return diffWeeks % config.repeatInterval === 0;
}

function isMonthlyOccurrence(
  config: RecurrenceConfig,
  dateToCheck: Date,
  _completedOccurrences: number,
): boolean {
  const check = dateParts(dateToCheck);
  const start = dateParts(config.startDate);

  // Check month interval alignment
  const monthsDiff =
    (check.year - start.year) * 12 + (check.month - start.month);
  if (monthsDiff < 0 || monthsDiff % config.repeatInterval !== 0) return false;

  // Check the specific day
  const candidate = getMonthlyCandidate(config, check.year, check.month);
  if (!candidate) return false;

  return dateKey(candidate) === dateKey(dateToCheck);
}

function isYearlyOccurrence(config: RecurrenceConfig, dateToCheck: Date): boolean {
  const check = dateParts(dateToCheck);
  const start = dateParts(config.startDate);

  // Must be same month and day
  if (check.month !== start.month || check.day !== start.day) return false;

  // Check year interval alignment
  const yearsDiff = check.year - start.year;
  if (yearsDiff < 0) return false;
  return yearsDiff % config.repeatInterval === 0;
}

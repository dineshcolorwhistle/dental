/**
 * Recurrence Utility Module (Frontend)
 *
 * Computes recurring reminder occurrences for calendar projection and schedule views.
 * Mirrors backend recurrence engine for 100% consistency.
 */

export interface RecurrenceConfig {
  recurrence: 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: string; // YYYY-MM-DD
  repeatInterval: number;
  endType: 'ON_DATE' | 'AFTER' | 'NEVER';
  endDate?: string | null; // YYYY-MM-DD
  endAfterOccurrences?: number | null;
  weeklyDays?: number[]; // [0..6] (0=Sun)
  monthlyPattern?: 'DAY_OF_MONTH' | 'POSITIONAL_WEEKDAY';
  monthlyDayOfMonth?: number;
  monthlyWeekPosition?: 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST';
  monthlyWeekDay?: number;
}

const MAX_OCCURRENCES = 365;

function parseDateKey(key: string): { year: number; month: number; day: number } {
  const parts = key.slice(0, 10).split('-').map(Number);
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

function formatDateKey(year: number, month: number, day: number): string {
  const y = year;
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month, day, 12, 0, 0)).getUTCDay();
}

function addDaysToKey(key: string, daysToAdd: number): string {
  const { year, month, day } = parseDateKey(key);
  const d = new Date(Date.UTC(year, month, day + daysToAdd, 12, 0, 0));
  return formatDateKey(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekDay: number,
  position: 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST',
): string | null {
  if (position === 'LAST') {
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0)).getUTCDate();
    for (let day = lastDay; day >= 1; day--) {
      if (getDayOfWeek(year, month, day) === weekDay) {
        return formatDateKey(year, month, day);
      }
    }
    return null;
  }

  const targetN =
    position === 'FIRST' ? 1 : position === 'SECOND' ? 2 : position === 'THIRD' ? 3 : 4;

  let count = 0;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0)).getUTCDate();

  for (let day = 1; day <= daysInMonth; day++) {
    if (getDayOfWeek(year, month, day) === weekDay) {
      count++;
      if (count === targetN) {
        return formatDateKey(year, month, day);
      }
    }
  }
  return null;
}

function getNextOccurrenceKey(config: RecurrenceConfig, currentKey: string, maxKey: string): string | null {
  const { year, month, day } = parseDateKey(currentKey);

  let nextKey: string | null = null;

  if (config.recurrence === 'DAILY') {
    nextKey = addDaysToKey(currentKey, config.repeatInterval);
  } else if (config.recurrence === 'WEEKLY') {
    const days = config.weeklyDays?.slice().sort((a, b) => a - b) ?? [];
    if (days.length === 0) return null;

    const currentDow = getDayOfWeek(year, month, day);
    const nextDayInWeek = days.find((d) => d > currentDow);

    if (nextDayInWeek !== undefined) {
      nextKey = addDaysToKey(currentKey, nextDayInWeek - currentDow);
    } else {
      const daysUntilEndOfWeek = 6 - currentDow;
      const daysToNextWeek = daysUntilEndOfWeek + 1 + (config.repeatInterval - 1) * 7;
      const nextWeekStart = addDaysToKey(currentKey, daysToNextWeek);
      const { year: ny, month: nm, day: nd } = parseDateKey(nextWeekStart);
      const nextWeekDow = getDayOfWeek(ny, nm, nd);
      const firstDay = days[0];
      const daysFromStart = firstDay - nextWeekDow;
      nextKey = addDaysToKey(nextWeekStart, daysFromStart >= 0 ? daysFromStart : daysFromStart + 7);
    }
  } else if (config.recurrence === 'MONTHLY') {
    let searchMonth = month + config.repeatInterval;
    let searchYear = year;
    while (searchMonth > 11) {
      searchMonth -= 12;
      searchYear++;
    }

    if (config.monthlyPattern === 'POSITIONAL_WEEKDAY') {
      const pos = config.monthlyWeekPosition ?? 'FIRST';
      const wday = config.monthlyWeekDay ?? 1;
      nextKey = getNthWeekdayOfMonth(searchYear, searchMonth, wday, pos);
    } else {
      const targetDay = config.monthlyDayOfMonth ?? 1;
      const daysInMonth = new Date(Date.UTC(searchYear, searchMonth + 1, 0, 12, 0, 0)).getUTCDate();
      if (targetDay <= daysInMonth) {
        nextKey = formatDateKey(searchYear, searchMonth, targetDay);
      }
    }
  } else if (config.recurrence === 'YEARLY') {
    const startParts = parseDateKey(config.startDate);
    const targetYear = year + config.repeatInterval;
    const daysInMonth = new Date(Date.UTC(targetYear, startParts.month + 1, 0, 12, 0, 0)).getUTCDate();
    if (startParts.day <= daysInMonth) {
      nextKey = formatDateKey(targetYear, startParts.month, startParts.day);
    }
  }

  if (!nextKey) return null;
  if (nextKey > maxKey) return null;
  if (config.endType === 'ON_DATE' && config.endDate && nextKey > config.endDate.slice(0, 10)) {
    return null;
  }

  return nextKey;
}

/**
 * Generate all occurrence date keys (YYYY-MM-DD) for a reminder.
 */
export function getOccurrenceKeys(
  config: RecurrenceConfig,
  completedOccurrences = 0,
  maxCount = MAX_OCCURRENCES,
): Set<string> {
  const result = new Set<string>();
  const startKey = config.startDate.slice(0, 10);
  if (!startKey) return result;

  if (config.recurrence === 'ONE_TIME') {
    result.add(startKey);
    return result;
  }

  const { year: sYear, month: sMonth, day: sDay } = parseDateKey(startKey);
  const maxDate = new Date(Date.UTC(sYear + 3, sMonth, sDay, 12, 0, 0));
  const maxKey = formatDateKey(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), maxDate.getUTCDate());

  let remainingCount = maxCount;
  if (config.endType === 'AFTER' && config.endAfterOccurrences != null) {
    remainingCount = Math.max(0, config.endAfterOccurrences - completedOccurrences);
  }

  if (remainingCount <= 0) return result;

  // Add 1st occurrence (start date)
  if (config.endType !== 'ON_DATE' || !config.endDate || startKey <= config.endDate.slice(0, 10)) {
    result.add(startKey);
  }

  let currentKey = startKey;

  while (result.size < remainingCount) {
    const nextKey = getNextOccurrenceKey(config, currentKey, maxKey);
    if (!nextKey) break;

    result.add(nextKey);
    currentKey = nextKey;
  }

  return result;
}

/**
 * Timezone Utility Module
 *
 * Zero-dependency timezone helpers using the built-in Intl.DateTimeFormat API.
 * Node.js (and V8) natively support all IANA timezone identifiers.
 *
 * Design principle:
 * - All dates in the database are stored as UTC (PostgreSQL default via Prisma).
 * - This module converts UTC ↔ tenant-local time for business logic only.
 * - Timestamps that record "when something happened" remain UTC and do NOT need conversion.
 */

interface TzDateParts {
  year: number;
  month: number; // 1-based (January = 1)
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Get the current date/time components in the specified timezone.
 * Uses Intl.DateTimeFormat to convert the UTC "now" to the target TZ.
 */
export function getNowInTz(tz: string): TzDateParts {
  return getDatePartsInTz(new Date(), tz);
}

/**
 * Get date/time components of a Date in the specified timezone.
 */
export function getDatePartsInTz(date: Date, tz: string): TzDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const val = parts.find((p) => p.type === type)?.value ?? '0';
    return parseInt(val, 10);
  };

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'), // midnight edge case
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Get the YYYY-MM-DD key for "today" in the specified timezone.
 * Useful for comparing reminder dates against "today".
 */
export function getTodayKeyInTz(tz: string): string {
  const parts = getNowInTz(tz);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Get the YYYY-MM-DD key for a given Date in the specified timezone.
 */
export function getDateKeyInTz(date: Date, tz: string): string {
  const parts = getDatePartsInTz(date, tz);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Get the HH:mm string for a Date in the specified timezone.
 * Used by the reminder scheduler to compare against reminderTime.
 */
export function getHHmmInTz(date: Date, tz: string): string {
  const parts = getDatePartsInTz(date, tz);
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

/**
 * Check if a date string (YYYY-MM-DD or ISO) is before "today" in the specified timezone.
 * Used for validating that reminder dates are not in the past.
 */
export function isDateBeforeTodayInTz(dateStr: string, tz: string): boolean {
  const todayKey = getTodayKeyInTz(tz);
  // Parse just the date portion (YYYY-MM-DD)
  const inputKey = dateStr.slice(0, 10);
  return inputKey < todayKey;
}

/**
 * Get the start of "today" (midnight) as a UTC Date, based on the specified timezone.
 * Useful for Prisma queries that filter by "today".
 *
 * Example: If tz = 'America/Mexico_City' and it's Sep 1 2026, 3 PM in Mexico,
 * this returns Sep 1 2026 06:00:00 UTC (midnight Mexico = 6 AM UTC in CDT).
 */
export function startOfDayInTz(tz: string, date?: Date): Date {
  const parts = date ? getDatePartsInTz(date, tz) : getNowInTz(tz);

  // Create a date string in the target timezone and convert to UTC
  const localDateStr = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T00:00:00`;

  // Use a temporary formatter to find the UTC offset for midnight in this TZ
  const midnightLocal = new Date(localDateStr + 'Z'); // treat as UTC first

  // Now find what UTC time corresponds to midnight in the target TZ
  // by checking the offset
  const testFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Binary search / iteration approach: adjust until we hit midnight in target TZ
  // Simpler approach: calculate offset from the timezone
  const utcParts = getDatePartsInTz(midnightLocal, tz);
  const offsetHours = utcParts.hour;
  const offsetMinutes = utcParts.minute;

  // The total offset tells us how far ahead the TZ is from UTC
  const totalOffsetMs = (offsetHours * 60 + offsetMinutes) * 60 * 1000;
  const result = new Date(midnightLocal.getTime() - totalOffsetMs);

  // Verify: the result in the target TZ should be midnight
  const verify = getDatePartsInTz(result, tz);
  if (verify.hour !== 0 || verify.minute !== 0) {
    // DST edge case: try adjusting by ±1 hour
    const adjusted = new Date(result.getTime() - 60 * 60 * 1000);
    const verifyAdj = getDatePartsInTz(adjusted, tz);
    if (verifyAdj.hour === 0 && verifyAdj.minute === 0 && verifyAdj.day === parts.day) {
      return adjusted;
    }
    // Try +1 hour
    const adjusted2 = new Date(result.getTime() + 60 * 60 * 1000);
    const verifyAdj2 = getDatePartsInTz(adjusted2, tz);
    if (verifyAdj2.hour === 0 && verifyAdj2.minute === 0 && verifyAdj2.day === parts.day) {
      return adjusted2;
    }
  }

  // Ensure the day matches (in case offset rolled over)
  const finalParts = getDatePartsInTz(result, tz);
  if (finalParts.day !== parts.day) {
    // Adjust by 24 hours in the right direction
    const direction = finalParts.day > parts.day ? -1 : 1;
    return new Date(result.getTime() + direction * 24 * 60 * 60 * 1000);
  }

  // Suppress unused variable warning
  void testFormatter;

  return result;
}

/**
 * Parses a date string (YYYY-MM-DD or ISO string) and returns a Date at noon (12:00:00 UTC).
 * This ensures that when stored in PostgreSQL as timestamp with time zone,
 * the date never shifts into the previous or next day in any global timezone (UTC-11 to UTC+11).
 */
export function parseCalendarDate(dateStr: string): Date {
  const datePart = dateStr.slice(0, 10);
  return new Date(`${datePart}T12:00:00.000Z`);
}


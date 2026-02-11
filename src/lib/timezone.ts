import { formatInTimeZone } from 'date-fns-tz'
import { fromZonedTime } from 'date-fns-tz'

export const APP_TIMEZONE = 'America/Los_Angeles'

/**
 * Get today's date string (YYYY-MM-DD) in Pacific Time.
 */
export function getTodayDateStrInTz(): string {
  return formatInTimeZone(new Date(), APP_TIMEZONE, 'yyyy-MM-dd')
}

/**
 * Get the start of today in Pacific Time, returned as a UTC ISO string.
 * Useful for comparing against UTC timestamps like `createdAt`.
 */
export function getStartOfTodayISOInTz(): string {
  const todayStr = getTodayDateStrInTz()
  const midnightPacific = fromZonedTime(
    new Date(todayStr + 'T00:00:00'),
    APP_TIMEZONE
  )
  return midnightPacific.toISOString()
}

/**
 * Shared strict ISO yyyy-mm-dd date validation.
 *
 * The shape regex alone accepts impossible calendar dates ("2026-02-31",
 * "2026-13-01"). isRealIsoDate adds a Date round-trip check so only real
 * calendar dates pass.
 */

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** True when `value` is a real calendar date in strict yyyy-mm-dd form. */
export function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false
  const time = new Date(value).getTime()
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value)
}

/** Validate date string format: YYYY, YYYY-MM, or YYYY-MM-DD. Empty string is valid. */
export function isValidDate(value: string): boolean {
  if (!value) return true
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)
}

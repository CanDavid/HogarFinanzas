const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_STRING = /^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function normalizeDateOnly(value: unknown): string | null {
  if (typeof value === 'string' && DATE_ONLY.test(value)) return value
  if (typeof value === 'string') {
    const match = DATE_STRING.exec(value)
    const month = match ? MONTHS.indexOf(match[1]) + 1 : 0
    if (match && month > 0) return `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`
  }
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

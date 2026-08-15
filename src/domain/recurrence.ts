import { normalizeDateOnly } from './dates'
import type { RecurrenceFrequency, RecurringRule, Transaction } from './types'

export interface RecurringOccurrence {
  id: string
  ruleId: string
  date: string
  status: 'pending' | 'realized'
  transactionId: string | null
}

export function occurrenceTransactionId(ruleId: string, date: string): string {
  const [a, b, c, d] = hash128(`hogar-finanzas:${ruleId}:${date}`)
  const bytes = [a, b, c, d].flatMap((value) => [value >>> 24, value >>> 16 & 255, value >>> 8 & 255, value & 255])
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function occurrenceDates(rule: Pick<RecurringRule, 'frequency' | 'startDate' | 'endDate'>, count = 12): string[] {
  const start = normalizeDateOnly(rule.startDate)
  if (!start || count <= 0) return []
  const dates: string[] = []
  for (let index = 0; dates.length < count; index += 1) {
    const candidate = addMonthsFromAnchor(start, monthsFor(rule.frequency) * index)
    if (rule.endDate && candidate > rule.endDate) break
    dates.push(candidate)
  }
  return dates
}

export function upcomingOccurrences(
  rule: RecurringRule,
  transactions: Transaction[],
  referenceDate: string,
  count = 6,
): RecurringOccurrence[] {
  if (!rule.active || count <= 0) return []
  const realized = new Map(transactions.filter((item) => item.recurringRuleId === rule.id && !item.deletedAt)
    .map((item) => [item.recurringOccurrenceDate, item.id]))
  const results: RecurringOccurrence[] = []
  const start = normalizeDateOnly(rule.startDate)
  if (!start) return results
  for (let index = 0; results.length < count && index < 1200; index += 1) {
    const date = addMonthsFromAnchor(start, monthsFor(rule.frequency) * index)
    if (rule.endDate && date > rule.endDate) break
    const transactionId = realized.get(date) ?? null
    if (date < referenceDate && transactionId) continue
    results.push({ id: occurrenceTransactionId(rule.id, date), ruleId: rule.id, date,
      status: transactionId ? 'realized' : 'pending', transactionId })
  }
  return results
}

export function nextRecurringDate(date: string, frequency: RecurrenceFrequency): string {
  return addMonthsFromAnchor(date, monthsFor(frequency))
}

function monthsFor(frequency: RecurrenceFrequency): number {
  return frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12
}

function addMonthsFromAnchor(value: string, months: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const monthIndex = month - 1 + months
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return `${targetYear.toString().padStart(4, '0')}-${(targetMonth + 1).toString().padStart(2, '0')}-${Math.min(day, lastDay).toString().padStart(2, '0')}`
}

function hash128(value: string): [number, number, number, number] {
  let h1 = 0x239b961b; let h2 = 0xab0e9789; let h3 = 0x38b34ae5; let h4 = 0xa1e38b93
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 597399067); h2 = Math.imul(h2 ^ code, 2869860233)
    h3 = Math.imul(h3 ^ code, 951274213); h4 = Math.imul(h4 ^ code, 2716044179)
  }
  h1 = Math.imul(h1 ^ h1 >>> 18, 597399067); h2 = Math.imul(h2 ^ h2 >>> 22, 2869860233)
  h3 = Math.imul(h3 ^ h3 >>> 17, 951274213); h4 = Math.imul(h4 ^ h4 >>> 19, 2716044179)
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0]
}

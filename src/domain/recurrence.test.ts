import { describe, expect, it } from 'vitest'
import { occurrenceDates, occurrenceTransactionId, upcomingOccurrences } from './recurrence'
import type { RecurringRule, Transaction } from './types'

const rule: RecurringRule = {
  id: '11111111-1111-4111-8111-111111111111', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null, createdBy: 'david', version: 1, changeSequence: 1, kind: 'expense', amountCents: 5000,
  concept: 'Seguro', note: '', accountId: 'account', categoryId: 'category', frequency: 'monthly', startDate: '2026-01-31', endDate: null, active: true,
}

describe('recurrence domain', () => {
  it('keeps the calendar anchor when a month has fewer days', () => {
    expect(occurrenceDates(rule, 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('supports quarterly and annual schedules with an inclusive end date', () => {
    expect(occurrenceDates({ frequency: 'quarterly', startDate: '2026-02-28', endDate: '2026-08-28' }, 8))
      .toEqual(['2026-02-28', '2026-05-28', '2026-08-28'])
    expect(occurrenceDates({ frequency: 'annual', startDate: '2024-02-29', endDate: null }, 3))
      .toEqual(['2024-02-29', '2025-02-28', '2026-02-28'])
  })

  it('generates the same UUID for the same rule and date on both devices', () => {
    const first = occurrenceTransactionId(rule.id, '2026-03-31')
    expect(first).toBe(occurrenceTransactionId(rule.id, '2026-03-31'))
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(first).not.toBe(occurrenceTransactionId(rule.id, '2026-04-30'))
  })

  it('marks materialized dates and leaves overdue dates visible', () => {
    const transaction = { id: occurrenceTransactionId(rule.id, '2026-01-31'), recurringRuleId: rule.id,
      recurringOccurrenceDate: '2026-01-31', deletedAt: null } as Transaction
    const occurrences = upcomingOccurrences(rule, [transaction], '2026-03-01', 2)
    expect(occurrences.map((item) => [item.date, item.status])).toEqual([['2026-02-28', 'pending'], ['2026-03-31', 'pending']])
  })
})

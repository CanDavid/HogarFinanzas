import { describe, expect, it } from 'vitest'
import { buildMonthlyPlan } from './plan'
import type { Budget, MonthlyPlan, PlannedItem, RecurringRule, Transaction } from './types'

const common = { createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', deletedAt: null,
  createdBy: 'david' as const, version: 1, changeSequence: 1 }

describe('monthly plan domain', () => {
  it('projects without double-counting realized recurring movements or transfers', () => {
    const salary = rule('income', 200_000, 'Nómina', '2026-08-01')
    const rent = rule('expense', 70_000, 'Alquiler', '2026-08-05')
    const transactions = [
      transaction('income', 200_000, { recurringRuleId: salary.id, recurringOccurrenceDate: '2026-08-01' }),
      transaction('expense', 70_000, { recurringRuleId: rent.id, recurringOccurrenceDate: '2026-08-05' }),
      transaction('expense', 3_000, { categoryId: 'food' }),
      transaction('transfer', 999_999),
    ]
    const budget = { ...common, id: crypto.randomUUID(), month: '2026-08', categoryId: 'food', amountCents: 10_000 } satisfies Budget
    const result = buildMonthlyPlan('2026-08', [salary, rent], [], transactions, [budget])

    expect(result.summary).toMatchObject({ actualIncomeCents: 200_000, pendingIncomeCents: 0,
      actualExpenseCents: 73_000, pendingFixedExpenseCents: 0, variableRemainingCents: 7_000,
      initialSurplusCents: 120_000, projectedSurplusCents: 120_000 })
    expect(result.items.map((item) => item.status)).toEqual(['realized', 'realized'])
  })

  it('excludes omitted items and floors overspent budgets at zero', () => {
    const item = planned('expense', 5_000, 'Seguro', 'omitted')
    const budget = { ...common, id: crypto.randomUUID(), month: '2026-08', categoryId: 'food', amountCents: 1_000 } satisfies Budget
    const result = buildMonthlyPlan('2026-08', [], [item], [transaction('expense', 1_500, { categoryId: 'food' })], [budget])
    expect(result.items[0].status).toBe('omitted')
    expect(result.budgets[0]).toMatchObject({ spentCents: 1_500, remainingCents: 0, percentage: 150 })
    expect(result.summary.pendingFixedExpenseCents).toBe(0)
    expect(result.summary.projectedSurplusCents).toBe(-1_500)
  })

  it('links a manually planned item to its materialized transaction and distributes the projection', () => {
    const item = planned('income', 20_000, 'Extra', 'pending')
    const allocation = { ...common, id: crypto.randomUUID(), month: '2026-08', savingsAllocationCents: 5_000,
      investmentAllocationCents: 3_000 } satisfies MonthlyPlan
    const result = buildMonthlyPlan('2026-08', [], [item], [transaction('income', 20_000, { plannedItemId: item.id })], [], allocation)
    expect(result.items[0]).toMatchObject({ status: 'realized', transactionId: expect.any(String) })
    expect(result.summary).toMatchObject({ projectedSurplusCents: 20_000, savingsAllocationCents: 5_000,
      investmentAllocationCents: 3_000, unallocatedCents: 12_000 })
  })

  it('rejects arithmetic outside the safe integer range', () => {
    expect(() => buildMonthlyPlan('2026-08', [], [], [transaction('income', Number.MAX_SAFE_INTEGER),
      transaction('income', 1)], [])).toThrow('rango seguro')
  })
})

function rule(kind: 'income' | 'expense', amountCents: number, concept: string, startDate: string): RecurringRule {
  return { ...common, id: crypto.randomUUID(), kind, amountCents, concept, note: '', accountId: 'account',
    categoryId: 'category', frequency: 'monthly', startDate, endDate: null, active: true }
}

function planned(kind: 'income' | 'expense', amountCents: number, concept: string, status: 'pending' | 'omitted'): PlannedItem {
  return { ...common, id: crypto.randomUUID(), source: 'manual', recurringRuleId: null, kind, amountCents, concept,
    note: '', date: '2026-08-10', accountId: 'account', categoryId: 'category', status }
}

function transaction(kind: Transaction['kind'], amountCents: number, changes: Partial<Transaction> = {}): Transaction {
  return { ...common, id: crypto.randomUUID(), kind, amountCents, concept: 'Movimiento', note: '', date: '2026-08-10',
    accountId: kind === 'transfer' ? null : 'account', categoryId: kind === 'transfer' ? null : 'category',
    sourceAccountId: kind === 'transfer' ? 'source' : null, destinationAccountId: kind === 'transfer' ? 'destination' : null,
    recurringRuleId: null, recurringOccurrenceDate: null, plannedItemId: null, ...changes }
}

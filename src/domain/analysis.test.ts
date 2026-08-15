import { describe, expect, it } from 'vitest'
import { buildAnalysis, resolveAnalysisRange } from './analysis'
import type { Budget, Category, Goal, GoalAllocation, MonthlyClosure, Transaction, TransactionKind } from './types'

const sync = { createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:00:00.000Z', deletedAt: null,
  createdBy: 'david' as const, version: 1, changeSequence: 1 }
const food: Category = { ...sync, id: 'food', name: 'Alimentación', kind: 'expense', icon: '🍓', archivedAt: null }
const leisure: Category = { ...sync, id: 'leisure', name: 'Ocio', kind: 'expense', icon: '●', archivedAt: null }

function transaction(id: string, date: string, kind: TransactionKind, amountCents: number, categoryId: string | null = food.id, extra: Partial<Transaction> = {}): Transaction {
  return { ...sync, id, date, kind, amountCents, categoryId, concept: id, note: '', accountId: 'account', sourceAccountId: null, destinationAccountId: null, ...extra }
}
function budget(id: string, month: string, categoryId: string, amountCents: number): Budget { return { ...sync, id, month, categoryId, amountCents } }
function closure(id: string, month: string, netWorthCents: number, status: MonthlyClosure['status'] = 'closed'): MonthlyClosure {
  return { ...sync, id, month, status, revision: 1, closedAt: `${month}-28T20:00:00.000Z`, closedBy: 'david', reopenedAt: null, reopenedBy: null,
    transactionCount: 1, pendingIncomeCount: 0, pendingExpenseCount: 0, actualIncomeCents: 0, actualExpenseCents: 0,
    realSurplusCents: 0, projectedSurplusCents: 0, netWorthCents, liquidityCents: netWorthCents, savingsCents: 0,
    investmentCents: 0, goalReservedCents: 0 }
}
const goal: Goal = { ...sync, id: 'goal', name: 'Viaje', targetAmountCents: 100_000, targetDate: null, icon: '✈️', note: '', completedAt: null, archivedAt: null }
function allocation(id: string, date: string, amountCents: number): GoalAllocation { return { ...sync, id, goalId: goal.id, date, amountCents, note: '' } }

describe('analysis domain', () => {
  it('resolves fixed, yearly and exact custom periods', () => {
    expect(resolveAnalysisRange('2026-08-16', '3m')).toEqual({ from: '2026-06-01', to: '2026-08-16', months: ['2026-06', '2026-07', '2026-08'] })
    expect(resolveAnalysisRange('2026-08-16', 'year').from).toBe('2026-01-01')
    expect(resolveAnalysisRange('2026-08-16', 'custom', '2025-12-20', '2026-02-02')).toEqual({ from: '2025-12-20', to: '2026-02-02', months: ['2025-12', '2026-01', '2026-02'] })
    expect(() => resolveAnalysisRange('2026-08-16', 'custom', '2026-09-01', '2026-08-01')).toThrow(/inicial/)
    expect(() => resolveAnalysisRange('2026-08-16', 'custom', '2026-02-31', '2026-03-02')).toThrow(/válida/)
  })

  it('calculates exact cents, monthly savings and excludes transfers and adjustments', () => {
    const result = buildAnalysis({ today: '2026-08-16', period: '3m', transactions: [
      transaction('salary', '2026-08-01', 'income', 100_001, null), transaction('expense', '2026-08-02', 'expense', 25_001),
      transaction('transfer', '2026-08-03', 'transfer', 90_000), transaction('adjustment', '2026-08-04', 'adjustment', -50_000),
      transaction('future', '2026-08-20', 'expense', 99_999),
    ], budgets: [], categories: [food], closures: [], goals: [], allocations: [] })
    expect(result.totalIncomeCents).toBe(100_001)
    expect(result.totalExpenseCents).toBe(25_001)
    expect(result.resultCents).toBe(75_000)
    expect(result.savingsCents).toBe(75_000)
    expect(result.savingsRatePercent).toBe(75)
    expect(result.yearSavingsCents).toBe(75_000)
  })

  it('ranks expense categories and compares variable budgets by month', () => {
    const result = buildAnalysis({ today: '2026-08-16', period: '3m', transactions: [
      transaction('food-variable', '2026-08-05', 'expense', 12_000),
      transaction('food-fixed', '2026-08-06', 'expense', 20_000, food.id, { recurringRuleId: 'rent' }),
      transaction('leisure', '2026-08-07', 'expense', 8_000, leisure.id),
    ], budgets: [budget('food-budget', '2026-08', food.id, 10_000), budget('leisure-budget', '2026-08', leisure.id, 10_000)],
    categories: [food, leisure], closures: [], goals: [], allocations: [] })
    expect(result.categories.map((item) => [item.name, item.amountCents, item.percentage])).toEqual([
      ['Alimentación', 32_000, 80], ['Ocio', 8_000, 20],
    ])
    expect(result.budgets.find((item) => item.categoryId === food.id)).toMatchObject({ actualCents: 12_000, differenceCents: -2_000, percentage: 120 })
    expect(result.insights).toContain('Alimentación supera su presupuesto de agosto de 2026 en 20%.')
  })

  it('uses only closed snapshots and reports their deterministic change', () => {
    const result = buildAnalysis({ today: '2026-08-16', period: '6m', transactions: [], budgets: [], categories: [],
      closures: [closure('march', '2026-03', 100_000), closure('june', '2026-06', 125_000), closure('july', '2026-07', 999_000, 'open')], goals: [], allocations: [] })
    expect(result.closures.map((item) => item.id)).toEqual(['march', 'june'])
    expect(result.insights).toContain('El patrimonio ha aumentado 250,00 € entre marzo de 2026 y junio de 2026.')
  })

  it('shows cumulative active goal progress through the range end', () => {
    const result = buildAnalysis({ today: '2026-08-16', period: 'custom', customFrom: '2026-07-01', customTo: '2026-08-10',
      transactions: [], budgets: [], categories: [], closures: [], goals: [goal, { ...goal, id: 'done', completedAt: '2026-07-01' }],
      allocations: [allocation('before', '2026-06-01', 20_000), allocation('inside', '2026-07-15', 15_000), allocation('after', '2026-08-20', 50_000)] })
    expect(result.goals).toHaveLength(1)
    expect(result.goals[0]).toMatchObject({ assignedCents: 35_000, addedInPeriodCents: 15_000, percentage: 35 })
  })

  it('compares the two latest visible months even when one has no expense', () => {
    const result = buildAnalysis({ today: '2026-08-16', period: '3m', transactions: [transaction('july', '2026-07-01', 'expense', 5_000)],
      budgets: [], categories: [food], closures: [], goals: [], allocations: [] })
    expect(result.insights[0]).toContain('50,00')
    expect(result.insights[0]).toContain('menos')
  })

  it('keeps net saving signed while clamping the orientative rate to zero', () => {
    const result = buildAnalysis({ today: '2026-08-16', period: '3m', transactions: [
      transaction('income', '2026-08-01', 'income', 10_000), transaction('expense', '2026-08-02', 'expense', 15_000),
    ], budgets: [], categories: [food], closures: [], goals: [], allocations: [] })
    expect(result.savingsCents).toBe(-5_000)
    expect(result.savingsRatePercent).toBe(0)
    expect(result.months.at(-1)).toMatchObject({ savingsCents: -5_000, savingsRatePercent: 0 })
  })
})

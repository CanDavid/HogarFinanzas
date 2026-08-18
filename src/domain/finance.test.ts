import { describe, expect, it } from 'vitest'
import { calculatePortfolio, calculatePortfolioBreakdown, calculateRunningBalances, calculateTotals } from './finance'
import type { Account, Transaction, TransactionKind } from './types'

function movement(kind: TransactionKind, amountCents: number): Transaction {
  return { id: crypto.randomUUID(), createdAt: '', updatedAt: '', deletedAt: null, createdBy: 'david', version: 1, changeSequence: 1,
    kind, amountCents, concept: kind, note: '', date: '2026-08-14', accountId: 'a', categoryId: kind === 'income' || kind === 'expense' ? 'c' : null,
    sourceAccountId: kind === 'transfer' ? 'a' : null, destinationAccountId: kind === 'transfer' ? 'b' : null }
}

function account(id: string, initialBalanceCents: number, netWorth = true, liquidity = true): Account {
  return { id, createdAt: '', updatedAt: '', deletedAt: null, createdBy: 'david', version: 1, changeSequence: 1, name: id,
    type: 'checking', initialBalanceCents, includeInNetWorth: netWorth, includeInLiquidity: liquidity, archivedAt: null }
}

describe('financial totals', () => {
  it('never counts a transfer as income or expense', () => {
    expect(calculateTotals([movement('income', 20000), movement('expense', 5000), movement('transfer', 10000)]))
      .toEqual({ incomeCents: 20000, expenseCents: 5000, balanceCents: 15000 })
  })

  it('ignores deleted movements', () => {
    const deleted = { ...movement('expense', 5000), deletedAt: new Date().toISOString() }
    expect(calculateTotals([deleted]).expenseCents).toBe(0)
  })

  it('moves money once between accounts without changing net worth', () => {
    const transfer = movement('transfer', 3000)
    const result = calculatePortfolio([account('a', 10000), account('b', 5000)], [transfer])
    expect(result.balances.get('a')).toBe(7000)
    expect(result.balances.get('b')).toBe(8000)
    expect(result.netWorthCents).toBe(15000)
  })

  it('applies signed adjustments and separates liquidity', () => {
    const adjustment = { ...movement('adjustment', -500), accountId: 'b', sourceAccountId: null, destinationAccountId: null }
    const result = calculatePortfolio([account('a', 10000), account('b', 5000, true, false)], [adjustment])
    expect(result.netWorthCents).toBe(14500)
    expect(result.liquidityCents).toBe(10000)
    expect(calculateTotals([adjustment])).toEqual({ incomeCents: 0, expenseCents: 0, balanceCents: 0 })
  })

  it('breaks included balances down by account type', () => {
    const checking = account('a', 10_000)
    const savings = { ...account('b', 25_000, true, false), type: 'savings' as const }
    const excluded = { ...account('c', 99_000), type: 'investment' as const, includeInNetWorth: false }
    const result = calculatePortfolioBreakdown([checking, savings, excluded], [])
    expect(result.netWorthCents).toBe(35_000)
    expect(result.byType.get('checking')).toBe(10_000)
    expect(result.byType.get('savings')).toBe(25_000)
    expect(result.byType.get('investment')).toBe(0)
  })
})

describe('calculateRunningBalances', () => {
  it('accumulates the resulting balance of the affected account after each movement', () => {
    const income = { ...movement('income', 10000), id: 'i1', date: '2026-08-01' }
    const expense = { ...movement('expense', 4000), id: 'e1', date: '2026-08-02' }
    const result = calculateRunningBalances([account('a', 5000)], [income, expense])
    expect(result.get('i1')).toBe(15000)
    expect(result.get('e1')).toBe(11000)
  })

  it('for a transfer only records the resulting balance of the destination account', () => {
    const transfer = { ...movement('transfer', 3000), id: 't1' }
    const result = calculateRunningBalances([account('a', 10000), account('b', 5000)], [transfer])
    expect(result.get('t1')).toBe(8000)
  })

  it('breaks ties on the same date using createdAt order', () => {
    const first = { ...movement('income', 1000), id: 'i1', createdAt: '2026-08-14T08:00:00.000Z' }
    const second = { ...movement('income', 2000), id: 'i2', createdAt: '2026-08-14T09:00:00.000Z' }
    const result = calculateRunningBalances([account('a', 0)], [second, first])
    expect(result.get('i1')).toBe(1000)
    expect(result.get('i2')).toBe(3000)
  })
})

import { describe, expect, it } from 'vitest'
import { calculatePortfolio, calculatePortfolioBreakdown, calculateTotals } from './finance'
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

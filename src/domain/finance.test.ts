import { describe, expect, it } from 'vitest'
import { calculateTotals } from './finance'
import type { Transaction, TransactionKind } from './types'

function movement(kind: TransactionKind, amountCents: number): Transaction {
  return { id: crypto.randomUUID(), createdAt: '', updatedAt: '', deletedAt: null, createdBy: 'david', version: 1, changeSequence: 1, kind, amountCents, concept: kind, date: '2026-08-14' }
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
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_MOVEMENT_FILTERS, filterMovements, groupMovements, type MovementFilters } from './movements'
import type { Account, Category, Transaction, TransactionKind, UserId } from './types'

const sync = { createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', deletedAt: null, version: 1, changeSequence: 1 }
const accounts: Account[] = [
  { ...sync, id: 'checking', createdBy: 'david', name: 'Principal', type: 'checking', initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null },
  { ...sync, id: 'savings', createdBy: 'david', name: 'Ahorro', type: 'savings', initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: false, archivedAt: null },
]
const categories: Category[] = [
  { ...sync, id: 'food', createdBy: 'david', name: 'Alimentación', kind: 'expense', icon: '●', archivedAt: null },
  { ...sync, id: 'salary', createdBy: 'david', name: 'Nómina', kind: 'income', icon: '●', archivedAt: null },
]
const transactions: Transaction[] = [
  movement('expense-1', 'expense', '2026-08-15', 'david', { concept: 'Supermercado', note: 'Cena de aniversario', accountId: 'checking', categoryId: 'food', recurringRuleId: 'rule-1', recurringOccurrenceDate: '2026-08-15' }),
  movement('transfer-1', 'transfer', '2026-08-12', 'esther', { concept: 'Reserva', sourceAccountId: 'checking', destinationAccountId: 'savings' }),
  movement('income-1', 'income', '2026-07-28', 'esther', { concept: 'Sueldo', accountId: 'checking', categoryId: 'salary' }),
]

describe('movement querying', () => {
  it('filters the current and previous month deterministically', () => {
    expect(filterMovements(transactions, DEFAULT_MOVEMENT_FILTERS, accounts, categories, '2026-08-15').map((item) => item.id)).toEqual(['expense-1', 'transfer-1'])
    expect(filterMovements(transactions, { ...DEFAULT_MOVEMENT_FILTERS, period: 'previous' }, accounts, categories, '2026-08-15').map((item) => item.id)).toEqual(['income-1'])
  })

  it('searches notes and related names without accents', () => {
    expect(query({ query: 'aniversario', period: 'all' })).toEqual(['expense-1'])
    expect(query({ query: 'alimentacion', period: 'all' })).toEqual(['expense-1'])
    expect(query({ query: 'ahorro', period: 'all' })).toEqual(['transfer-1'])
  })

  it('matches either side of a transfer and combines member/type filters', () => {
    expect(query({ period: 'all', accountId: 'savings' })).toEqual(['transfer-1'])
    expect(query({ period: 'all', userId: 'esther', kind: 'income' })).toEqual(['income-1'])
  })

  it('distinguishes recurring and one-off movements', () => {
    expect(query({ period: 'all', recurrence: 'recurring' })).toEqual(['expense-1'])
    expect(query({ period: 'all', recurrence: 'single' })).toEqual(['transfer-1', 'income-1'])
  })

  it('groups movements by day in descending order', () => {
    expect(groupMovements(transactions).map((group) => [group.date, group.transactions.length])).toEqual([
      ['2026-08-15', 1], ['2026-08-12', 1], ['2026-07-28', 1],
    ])
  })
})

function query(changes: Partial<MovementFilters>): string[] {
  return filterMovements(transactions, { ...DEFAULT_MOVEMENT_FILTERS, ...changes }, accounts, categories, '2026-08-15').map((item) => item.id)
}

function movement(id: string, kind: TransactionKind, date: string, createdBy: UserId, values: Partial<Transaction>): Transaction {
  return { ...sync, id, createdBy, kind, date, amountCents: 1000, concept: '', note: '', accountId: null, categoryId: null,
    sourceAccountId: null, destinationAccountId: null, ...values }
}

import type { Transaction } from './types'

export interface FinancialTotals {
  incomeCents: number
  expenseCents: number
  balanceCents: number
}

export function calculateTotals(transactions: Transaction[]): FinancialTotals {
  const visible = transactions.filter((transaction) => !transaction.deletedAt)
  const incomeCents = visible
    .filter((transaction) => transaction.kind === 'income')
    .reduce((sum, transaction) => sum + transaction.amountCents, 0)
  const expenseCents = visible
    .filter((transaction) => transaction.kind === 'expense')
    .reduce((sum, transaction) => sum + transaction.amountCents, 0)
  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents }
}

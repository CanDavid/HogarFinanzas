import type { Account, Transaction } from './types'

export interface FinancialTotals { incomeCents: number; expenseCents: number; balanceCents: number }
export interface PortfolioTotals { balances: ReadonlyMap<string, number>; netWorthCents: number; liquidityCents: number }

export function calculateTotals(transactions: Transaction[]): FinancialTotals {
  const visible = transactions.filter((transaction) => !transaction.deletedAt)
  const incomeCents = sum(visible.filter((item) => item.kind === 'income').map((item) => item.amountCents))
  const expenseCents = sum(visible.filter((item) => item.kind === 'expense').map((item) => item.amountCents))
  return { incomeCents, expenseCents, balanceCents: checkedAdd(incomeCents, -expenseCents) }
}

export function calculatePortfolio(accounts: Account[], transactions: Transaction[]): PortfolioTotals {
  const activeRecords = accounts.filter((account) => !account.deletedAt)
  const balances = new Map(activeRecords.map((account) => [account.id, account.initialBalanceCents]))
  for (const transaction of transactions.filter((item) => !item.deletedAt)) {
    if (transaction.kind === 'income') apply(balances, transaction.accountId, transaction.amountCents)
    else if (transaction.kind === 'expense') apply(balances, transaction.accountId, -transaction.amountCents)
    else if (transaction.kind === 'adjustment') apply(balances, transaction.accountId, transaction.amountCents)
    else if (transaction.kind === 'transfer') {
      apply(balances, transaction.sourceAccountId, -transaction.amountCents)
      apply(balances, transaction.destinationAccountId, transaction.amountCents)
    }
  }
  const netWorthCents = sum(activeRecords.filter((account) => account.includeInNetWorth).map((account) => balances.get(account.id) ?? 0))
  const liquidityCents = sum(activeRecords.filter((account) => account.includeInLiquidity).map((account) => balances.get(account.id) ?? 0))
  return { balances, netWorthCents, liquidityCents }
}

function apply(balances: Map<string, number>, accountId: string | null, delta: number): void {
  if (!accountId || !balances.has(accountId)) return
  balances.set(accountId, checkedAdd(balances.get(accountId) ?? 0, delta))
}

function sum(values: number[]): number { return values.reduce(checkedAdd, 0) }

function checkedAdd(left: number, right: number): number {
  const result = left + right
  if (!Number.isSafeInteger(result)) throw new Error('El cálculo monetario excede el rango seguro.')
  return result
}

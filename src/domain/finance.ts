import type { Account, AccountType, Transaction } from './types'

export interface FinancialTotals { incomeCents: number; expenseCents: number; balanceCents: number }
export interface PortfolioTotals { balances: ReadonlyMap<string, number>; netWorthCents: number; liquidityCents: number }
export interface PortfolioBreakdown extends PortfolioTotals {
  byType: ReadonlyMap<AccountType, number>
}

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

export function calculatePortfolioBreakdown(accounts: Account[], transactions: Transaction[]): PortfolioBreakdown {
  const portfolio = calculatePortfolio(accounts, transactions)
  const byType = new Map<AccountType, number>([['checking', 0], ['savings', 0], ['investment', 0], ['cash', 0]])
  for (const account of accounts.filter((item) => !item.deletedAt && item.includeInNetWorth)) {
    byType.set(account.type, checkedAdd(byType.get(account.type) ?? 0, portfolio.balances.get(account.id) ?? 0))
  }
  return { ...portfolio, byType }
}

export function calculateRunningBalances(accounts: Account[], transactions: Transaction[]): ReadonlyMap<string, number> {
  const activeRecords = accounts.filter((account) => !account.deletedAt)
  const balances = new Map(activeRecords.map((account) => [account.id, account.initialBalanceCents]))
  const result = new Map<string, number>()
  const ordered = [...transactions.filter((item) => !item.deletedAt)].sort(chronological)
  for (const transaction of ordered) {
    if (transaction.kind === 'income') apply(balances, transaction.accountId, transaction.amountCents)
    else if (transaction.kind === 'expense') apply(balances, transaction.accountId, -transaction.amountCents)
    else if (transaction.kind === 'adjustment') apply(balances, transaction.accountId, transaction.amountCents)
    else if (transaction.kind === 'transfer') {
      apply(balances, transaction.sourceAccountId, -transaction.amountCents)
      apply(balances, transaction.destinationAccountId, transaction.amountCents)
    }
    const targetAccountId = transaction.kind === 'transfer' ? transaction.destinationAccountId : transaction.accountId
    if (targetAccountId && balances.has(targetAccountId)) result.set(transaction.id, balances.get(targetAccountId)!)
  }
  return result
}

function chronological(left: Transaction, right: Transaction): number {
  return left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
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

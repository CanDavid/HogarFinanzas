import { monthRange } from './dates'
import type { Account, Category, Transaction, TransactionKind, UserId } from './types'

export type MovementPeriod = 'current' | 'previous' | 'custom' | 'all'

export interface MovementFilters {
  query: string
  period: MovementPeriod
  kind: TransactionKind | 'all'
  accountId: string
  categoryId: string
  userId: UserId | 'all'
  dateFrom: string
  dateTo: string
}

export interface MovementGroup { date: string; transactions: Transaction[] }

export const DEFAULT_MOVEMENT_FILTERS: MovementFilters = {
  query: '', period: 'current', kind: 'all', accountId: '', categoryId: '', userId: 'all', dateFrom: '', dateTo: '',
}

export function filterMovements(
  transactions: Transaction[], filters: MovementFilters, accounts: Account[], categories: Category[], referenceDate: string,
): Transaction[] {
  const accountNames = new Map(accounts.map((item) => [item.id, item.name]))
  const categoryNames = new Map(categories.map((item) => [item.id, item.name]))
  const bounds = filters.period === 'current' ? monthRange(referenceDate)
    : filters.period === 'previous' ? monthRange(referenceDate, -1)
      : filters.period === 'custom' ? { from: filters.dateFrom, to: filters.dateTo } : { from: '', to: '' }
  const query = searchable(filters.query)

  return transactions.filter((item) => {
    if (item.deletedAt) return false
    if (filters.kind !== 'all' && item.kind !== filters.kind) return false
    if (filters.userId !== 'all' && item.createdBy !== filters.userId) return false
    if (filters.categoryId && item.categoryId !== filters.categoryId) return false
    if (filters.accountId && ![item.accountId, item.sourceAccountId, item.destinationAccountId].includes(filters.accountId)) return false
    if (bounds.from && item.date < bounds.from) return false
    if (bounds.to && item.date > bounds.to) return false
    if (!query) return true
    const context = [item.concept, item.note, accountNames.get(item.accountId ?? ''), accountNames.get(item.sourceAccountId ?? ''),
      accountNames.get(item.destinationAccountId ?? ''), categoryNames.get(item.categoryId ?? '')]
    return context.some((value) => searchable(value ?? '').includes(query))
  })
}

export function groupMovements(transactions: Transaction[]): MovementGroup[] {
  const groups = new Map<string, Transaction[]>()
  for (const transaction of transactions) groups.set(transaction.date, [...(groups.get(transaction.date) ?? []), transaction])
  return [...groups.entries()].sort(([left], [right]) => right.localeCompare(left)).map(([date, items]) => ({ date, transactions: items }))
}

function searchable(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-ES').trim()
}

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Account, Budget, Category, Goal, GoalAllocation, MonthlyClosure, MonthlyPlan, PlannedItem, RecurringRule, Session, SyncOperation, Transaction } from '../domain/types'

interface MetaValue { key: string; value: unknown }

interface FinanceDatabase extends DBSchema {
  transactions: { key: string; value: Transaction }
  accounts: { key: string; value: Account }
  categories: { key: string; value: Category }
  recurringRules: { key: string; value: RecurringRule }
  budgets: { key: string; value: Budget }
  plannedItems: { key: string; value: PlannedItem }
  monthlyPlans: { key: string; value: MonthlyPlan }
  goals: { key: string; value: Goal }
  goalAllocations: { key: string; value: GoalAllocation }
  monthlyClosures: { key: string; value: MonthlyClosure }
  outbox: { key: string; value: SyncOperation }
  meta: { key: string; value: MetaValue }
}

let databasePromise: Promise<IDBPDatabase<FinanceDatabase>> | undefined

export function getDatabase(): Promise<IDBPDatabase<FinanceDatabase>> {
  databasePromise ??= openDB<FinanceDatabase>('hogar-finanzas', 6, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('transactions')) database.createObjectStore('transactions', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('outbox')) database.createObjectStore('outbox', { keyPath: 'operationId' })
      if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta', { keyPath: 'key' })
      if (!database.objectStoreNames.contains('accounts')) database.createObjectStore('accounts', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('categories')) database.createObjectStore('categories', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('recurringRules')) database.createObjectStore('recurringRules', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('budgets')) database.createObjectStore('budgets', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('plannedItems')) database.createObjectStore('plannedItems', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('monthlyPlans')) database.createObjectStore('monthlyPlans', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('goals')) database.createObjectStore('goals', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('goalAllocations')) database.createObjectStore('goalAllocations', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('monthlyClosures')) database.createObjectStore('monthlyClosures', { keyPath: 'id' })
    },
  })
  return databasePromise
}

export async function clearDatabaseForTests(): Promise<void> {
  const database = await getDatabase()
  await Promise.all([
    database.clear('transactions'), database.clear('accounts'), database.clear('categories'), database.clear('recurringRules'),
    database.clear('budgets'), database.clear('plannedItems'), database.clear('monthlyPlans'), database.clear('goals'), database.clear('goalAllocations'), database.clear('monthlyClosures'),
    database.clear('outbox'), database.clear('meta'),
  ])
}

export type StoredMeta = Session | number | string | null

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Account, Category, Session, SyncOperation, Transaction } from '../domain/types'

interface MetaValue { key: string; value: unknown }

interface FinanceDatabase extends DBSchema {
  transactions: { key: string; value: Transaction }
  accounts: { key: string; value: Account }
  categories: { key: string; value: Category }
  outbox: { key: string; value: SyncOperation }
  meta: { key: string; value: MetaValue }
}

let databasePromise: Promise<IDBPDatabase<FinanceDatabase>> | undefined

export function getDatabase(): Promise<IDBPDatabase<FinanceDatabase>> {
  databasePromise ??= openDB<FinanceDatabase>('hogar-finanzas', 2, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('transactions')) database.createObjectStore('transactions', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('outbox')) database.createObjectStore('outbox', { keyPath: 'operationId' })
      if (!database.objectStoreNames.contains('meta')) database.createObjectStore('meta', { keyPath: 'key' })
      if (!database.objectStoreNames.contains('accounts')) database.createObjectStore('accounts', { keyPath: 'id' })
      if (!database.objectStoreNames.contains('categories')) database.createObjectStore('categories', { keyPath: 'id' })
    },
  })
  return databasePromise
}

export async function clearDatabaseForTests(): Promise<void> {
  const database = await getDatabase()
  await Promise.all([
    database.clear('transactions'), database.clear('accounts'), database.clear('categories'),
    database.clear('outbox'), database.clear('meta'),
  ])
}

export type StoredMeta = Session | number | string | null

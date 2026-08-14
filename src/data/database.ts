import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Session, SyncOperation, Transaction } from '../domain/types'

interface MetaValue {
  key: string
  value: unknown
}

interface FinanceDatabase extends DBSchema {
  transactions: { key: string; value: Transaction }
  outbox: { key: string; value: SyncOperation }
  meta: { key: string; value: MetaValue }
}

let databasePromise: Promise<IDBPDatabase<FinanceDatabase>> | undefined

export function getDatabase(): Promise<IDBPDatabase<FinanceDatabase>> {
  databasePromise ??= openDB<FinanceDatabase>('hogar-finanzas', 1, {
    upgrade(database) {
      database.createObjectStore('transactions', { keyPath: 'id' })
      database.createObjectStore('outbox', { keyPath: 'operationId' })
      database.createObjectStore('meta', { keyPath: 'key' })
    },
  })
  return databasePromise
}

export async function clearDatabaseForTests(): Promise<void> {
  const database = await getDatabase()
  await Promise.all([
    database.clear('transactions'),
    database.clear('outbox'),
    database.clear('meta'),
  ])
}

export type StoredMeta = Session | number | string | null

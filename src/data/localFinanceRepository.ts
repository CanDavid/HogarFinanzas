import type {
  OperationResult,
  Session,
  SyncOperation,
  SyncRepository,
  Transaction,
  TransactionInput,
  UserId,
} from '../domain/types'
import { assertMoneyCents } from '../domain/money'
import { getDatabase, type StoredMeta } from './database'

const DEFAULT_SERVER_URL = import.meta.env.VITE_APPS_SCRIPT_URL ?? ''

export class LocalFinanceRepository implements SyncRepository {
  async listTransactions(): Promise<Transaction[]> {
    const database = await getDatabase()
    return (await database.getAll('transactions'))
      .filter((transaction) => !transaction.deletedAt)
      .sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt))
  }

  async createTransaction(input: TransactionInput, userId: UserId): Promise<Transaction> {
    validateInput(input)
    const now = new Date().toISOString()
    const transaction: Transaction = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdBy: userId,
      version: 0,
      changeSequence: 0,
    }
    await this.writeLocalChange('create', transaction, 0)
    return transaction
  }

  async updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
    validateInput(input)
    const database = await getDatabase()
    const current = await database.get('transactions', id)
    if (!current || current.deletedAt) throw new Error('El movimiento ya no está disponible.')
    const updated = { ...current, ...input, updatedAt: new Date().toISOString() }
    await this.writeLocalChange('update', updated, current.version)
    return updated
  }

  async deleteTransaction(id: string): Promise<void> {
    const database = await getDatabase()
    const current = await database.get('transactions', id)
    if (!current || current.deletedAt) return
    const now = new Date().toISOString()
    await this.writeLocalChange('delete', { ...current, deletedAt: now, updatedAt: now }, current.version)
  }

  async pendingOperations(): Promise<SyncOperation[]> {
    const database = await getDatabase()
    return (await database.getAll('outbox'))
      .filter((operation) => !operation.permanentFailure)
      .sort((left, right) => left.localSequence - right.localSequence)
  }

  async failedOperations(): Promise<SyncOperation[]> {
    const database = await getDatabase()
    return (await database.getAll('outbox')).filter((operation) => operation.permanentFailure)
  }

  async markTransportFailure(message: string): Promise<void> {
    const database = await getDatabase()
    const transaction = database.transaction('outbox', 'readwrite')
    for (const operation of await transaction.store.getAll()) {
      if (operation.permanentFailure) continue
      operation.attempts += 1
      operation.lastError = message
      await transaction.store.put(operation)
    }
    await transaction.done
  }

  async applyOperationResults(results: OperationResult[]): Promise<void> {
    const database = await getDatabase()
    const transaction = database.transaction(['outbox', 'transactions'], 'readwrite')
    for (const result of results) {
      const operation = await transaction.objectStore('outbox').get(result.operationId)
      if (!operation) continue
      if (result.ok) {
        await transaction.objectStore('outbox').delete(result.operationId)
        if (result.record) await transaction.objectStore('transactions').put(result.record)
      } else {
        operation.attempts += 1
        operation.lastError = result.error?.message ?? 'Error de sincronización'
        operation.permanentFailure = result.error?.permanent ?? false
        await transaction.objectStore('outbox').put(operation)
      }
    }
    await transaction.done
  }

  async mergeServerChanges(changes: Transaction[]): Promise<void> {
    const database = await getDatabase()
    const transaction = database.transaction('transactions', 'readwrite')
    for (const remote of changes) {
      const local = await transaction.store.get(remote.id)
      if (!local || remote.version >= local.version) await transaction.store.put(remote)
    }
    await transaction.done
  }

  getCursor(): Promise<number> { return this.getMeta<number>('cursor', 0) }
  setCursor(cursor: number): Promise<void> { return this.setMeta('cursor', cursor) }
  getSession(): Promise<Session | null> { return this.getMeta<Session | null>('session', null) }
  setSession(session: Session | null): Promise<void> { return this.setMeta('session', session) }
  getServerUrl(): Promise<string> { return this.getMeta<string>('serverUrl', DEFAULT_SERVER_URL) }
  setServerUrl(url: string): Promise<void> { return this.setMeta('serverUrl', url.trim()) }

  private async writeLocalChange(kind: SyncOperation['kind'], payload: Transaction, baseVersion: number) {
    const database = await getDatabase()
    const transaction = database.transaction(['transactions', 'outbox', 'meta'], 'readwrite')
    const sequenceItem = await transaction.objectStore('meta').get('outboxSequence')
    const localSequence = Number(sequenceItem?.value ?? 0) + 1
    const operation: SyncOperation = {
      operationId: crypto.randomUUID(),
      localSequence,
      kind,
      recordId: payload.id,
      payload,
      baseVersion,
      attempts: 0,
      lastError: null,
      permanentFailure: false,
    }
    await Promise.all([
      transaction.objectStore('transactions').put(payload),
      transaction.objectStore('outbox').put(operation),
      transaction.objectStore('meta').put({ key: 'outboxSequence', value: localSequence }),
    ])
    await transaction.done
  }

  private async getMeta<T extends StoredMeta>(key: string, fallback: T): Promise<T> {
    const database = await getDatabase()
    const item = await database.get('meta', key)
    return (item?.value as T | undefined) ?? fallback
  }

  private async setMeta(key: string, value: StoredMeta): Promise<void> {
    const database = await getDatabase()
    await database.put('meta', { key, value })
  }
}

function validateInput(input: TransactionInput): void {
  assertMoneyCents(input.amountCents)
  if (input.amountCents <= 0) throw new Error('El importe debe ser mayor que cero.')
  if (!input.concept.trim()) throw new Error('El concepto es obligatorio.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('La fecha no es válida.')
}

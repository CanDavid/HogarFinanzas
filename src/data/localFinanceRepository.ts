import { normalizeDateOnly } from '../domain/dates'
import { assertMoneyCents } from '../domain/money'
import type {
  Account, AccountInput, Category, CategoryInput, EntityType, OperationResult, Session, SyncChange,
  SyncEntity, SyncOperation, SyncRepository, Transaction, TransactionInput, UserId,
} from '../domain/types'
import { getDatabase, type StoredMeta } from './database'

const DEFAULT_SERVER_URL = import.meta.env.VITE_APPS_SCRIPT_URL ?? ''

export class LocalFinanceRepository implements SyncRepository {
  async listTransactions(): Promise<Transaction[]> {
    const database = await getDatabase()
    const stored = await database.getAll('transactions')
    const transactions = stored.map(normalizeTransaction)
    await Promise.all(transactions.filter((item, index) => JSON.stringify(item) !== JSON.stringify(stored[index]))
      .map((item) => database.put('transactions', item)))
    return transactions.filter((item) => !item.deletedAt)
      .sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt))
  }

  async listAccounts(): Promise<Account[]> {
    const database = await getDatabase()
    return (await database.getAll('accounts')).filter((item) => !item.deletedAt)
      .sort((left, right) => left.archivedAt === right.archivedAt ? left.name.localeCompare(right.name) : left.archivedAt ? 1 : -1)
  }

  async listCategories(): Promise<Category[]> {
    const database = await getDatabase()
    return (await database.getAll('categories')).filter((item) => !item.deletedAt)
      .sort((left, right) => left.kind.localeCompare(right.kind)
        || (left.archivedAt === right.archivedAt ? left.name.localeCompare(right.name) : left.archivedAt ? 1 : -1))
  }

  async createTransaction(input: TransactionInput, userId: UserId): Promise<Transaction> {
    validateTransactionInput(input)
    const record = newRecord<Transaction>({ ...input, createdBy: userId })
    await this.writeLocalChange('transaction', 'create', record, 0)
    return record
  }

  async updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
    validateTransactionInput(input)
    const current = await (await getDatabase()).get('transactions', id)
    if (!current || current.deletedAt) throw new Error('El movimiento ya no está disponible.')
    const updated = { ...normalizeTransaction(current), ...input, updatedAt: new Date().toISOString() }
    await this.writeLocalChange('transaction', 'update', updated, current.version)
    return updated
  }

  async deleteTransaction(id: string): Promise<void> {
    const current = await (await getDatabase()).get('transactions', id)
    if (!current || current.deletedAt) return
    const now = new Date().toISOString()
    await this.writeLocalChange('transaction', 'delete', { ...normalizeTransaction(current), deletedAt: now, updatedAt: now }, current.version)
  }

  async createAccount(input: AccountInput, userId: UserId): Promise<Account> {
    validateAccountInput(input)
    const record = newRecord<Account>({ ...input, archivedAt: null, createdBy: userId })
    await this.writeLocalChange('account', 'create', record, 0)
    return record
  }

  async updateAccount(id: string, input: AccountInput): Promise<Account> {
    validateAccountInput(input)
    return this.updateEntity('account', id, input) as Promise<Account>
  }

  async archiveAccount(id: string): Promise<void> { await this.archiveEntity('account', id) }

  async createCategory(input: CategoryInput, userId: UserId): Promise<Category> {
    validateCategoryInput(input)
    const record = newRecord<Category>({ ...input, archivedAt: null, createdBy: userId })
    await this.writeLocalChange('category', 'create', record, 0)
    return record
  }

  async updateCategory(id: string, input: CategoryInput): Promise<Category> {
    validateCategoryInput(input)
    return this.updateEntity('category', id, input) as Promise<Category>
  }

  async archiveCategory(id: string): Promise<void> { await this.archiveEntity('category', id) }

  async pendingOperations(): Promise<SyncOperation[]> {
    return (await (await getDatabase()).getAll('outbox')).filter((item) => !item.permanentFailure)
      .map((item) => ({ ...item, entityType: item.entityType ?? 'transaction' }))
      .sort((left, right) => left.localSequence - right.localSequence)
  }

  async failedOperations(): Promise<SyncOperation[]> {
    return (await (await getDatabase()).getAll('outbox')).filter((item) => item.permanentFailure)
  }

  async markTransportFailure(message: string): Promise<void> {
    const database = await getDatabase(); const transaction = database.transaction('outbox', 'readwrite')
    for (const operation of await transaction.store.getAll()) {
      if (operation.permanentFailure) continue
      await transaction.store.put({ ...operation, attempts: operation.attempts + 1, lastError: message })
    }
    await transaction.done
  }

  async applyOperationResults(results: OperationResult[]): Promise<void> {
    const database = await getDatabase()
    const transaction = database.transaction(['outbox', 'transactions', 'accounts', 'categories'], 'readwrite')
    for (const result of results) {
      const operation = await transaction.objectStore('outbox').get(result.operationId)
      if (!operation) continue
      if (!result.ok) {
        await transaction.objectStore('outbox').put({ ...operation, attempts: operation.attempts + 1,
          lastError: result.error?.message ?? 'Error de sincronización', permanentFailure: result.error?.permanent ?? false })
        continue
      }
      await transaction.objectStore('outbox').delete(result.operationId)
      if (result.record) {
        const entityType = result.entityType ?? operation.entityType ?? 'transaction'
        if (entityType === 'transaction') await transaction.objectStore('transactions').put(normalizeTransaction(result.record as Transaction))
        else if (entityType === 'account') await transaction.objectStore('accounts').put(result.record as Account)
        else await transaction.objectStore('categories').put(result.record as Category)
      }
    }
    await transaction.done
  }

  async mergeServerChanges(changes: SyncChange[]): Promise<void> {
    const database = await getDatabase()
    const transaction = database.transaction(['transactions', 'accounts', 'categories'], 'readwrite')
    for (const incoming of changes) {
      const change = 'record' in incoming ? incoming : { entityType: 'transaction' as const, record: incoming as unknown as Transaction }
      const remote = normalizeEntity(change.entityType, change.record)
      if (change.entityType === 'transaction') {
        const record = remote as Transaction; const local = await transaction.objectStore('transactions').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('transactions').put(record)
      } else if (change.entityType === 'account') {
        const record = remote as Account; const local = await transaction.objectStore('accounts').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('accounts').put(record)
      } else {
        const record = remote as Category; const local = await transaction.objectStore('categories').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('categories').put(record)
      }
    }
    await transaction.done
  }

  getCursor(): Promise<number> { return this.getMeta<number>('cursor', 0) }
  setCursor(cursor: number): Promise<void> { return this.setMeta('cursor', cursor) }
  getSession(): Promise<Session | null> { return this.getMeta<Session | null>('session', null) }
  setSession(session: Session | null): Promise<void> { return this.setMeta('session', session) }
  getServerUrl(): Promise<string> { return this.getMeta<string>('serverUrl', DEFAULT_SERVER_URL) }
  setServerUrl(url: string): Promise<void> { return this.setMeta('serverUrl', url.trim()) }

  private async updateEntity(entityType: 'account' | 'category', id: string, input: AccountInput | CategoryInput): Promise<SyncEntity> {
    const database = await getDatabase(); const current = await database.get(storeName(entityType), id)
    if (!current || current.deletedAt) throw new Error('El elemento ya no está disponible.')
    const updated = { ...current, ...input, updatedAt: new Date().toISOString() } as Account | Category
    await this.writeLocalChange(entityType, 'update', updated, current.version)
    return updated
  }

  private async archiveEntity(entityType: 'account' | 'category', id: string): Promise<void> {
    const database = await getDatabase()
    const current = entityType === 'account' ? await database.get('accounts', id) : await database.get('categories', id)
    if (!current || current.deletedAt || current.archivedAt) return
    const updated = { ...current, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await this.writeLocalChange(entityType, 'update', updated, current.version)
  }

  private async writeLocalChange(entityType: EntityType, kind: SyncOperation['kind'], payload: SyncEntity, baseVersion: number) {
    const database = await getDatabase()
    if (entityType === 'transaction') {
      const transaction = database.transaction(['transactions', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, normalizeTransaction(payload as Transaction), baseVersion)
    } else if (entityType === 'account') {
      const transaction = database.transaction(['accounts', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as Account, baseVersion)
    } else {
      const transaction = database.transaction(['categories', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as Category, baseVersion)
    }
  }

  private async getMeta<T extends StoredMeta>(key: string, fallback: T): Promise<T> {
    const item = await (await getDatabase()).get('meta', key)
    return (item?.value as T | undefined) ?? fallback
  }
  private async setMeta(key: string, value: StoredMeta): Promise<void> { await (await getDatabase()).put('meta', { key, value }) }
}

function newRecord<T extends SyncEntity>(values: Omit<T, keyof import('../domain/types').SyncableRecord> & { createdBy: UserId }): T {
  const now = new Date().toISOString()
  return { ...values, id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null, version: 0, changeSequence: 0 } as T
}

function normalizeTransaction(transaction: Transaction): Transaction {
  return { ...transaction, date: normalizeDateOnly(transaction.date) ?? transaction.date,
    accountId: transaction.accountId ?? null, categoryId: transaction.categoryId ?? null,
    sourceAccountId: transaction.sourceAccountId ?? null, destinationAccountId: transaction.destinationAccountId ?? null }
}

function normalizeEntity(entityType: EntityType, entity: SyncEntity): SyncEntity {
  return entityType === 'transaction' ? normalizeTransaction(entity as Transaction) : entity
}

function storeName(entityType: EntityType): 'transactions' | 'accounts' | 'categories' {
  return entityType === 'transaction' ? 'transactions' : entityType === 'account' ? 'accounts' : 'categories'
}

async function queueLocalChange(transaction: {
  objectStore(name: 'meta'): { get(key: string): Promise<{ value: unknown } | undefined>; put(value: { key: string; value: unknown }): Promise<unknown> }
  objectStore(name: 'outbox'): { put(value: SyncOperation): Promise<unknown> }
  objectStore(name: 'transactions' | 'accounts' | 'categories'): { put(value: never): Promise<unknown> }
  done: Promise<unknown>
}, entityType: EntityType, kind: SyncOperation['kind'], payload: SyncEntity, baseVersion: number) {
  const sequenceItem = await transaction.objectStore('meta').get('outboxSequence')
  const localSequence = Number(sequenceItem?.value ?? 0) + 1
  const operation: SyncOperation = { operationId: crypto.randomUUID(), localSequence, entityType, kind, recordId: payload.id,
    payload, baseVersion, attempts: 0, lastError: null, permanentFailure: false }
  await transaction.objectStore(storeName(entityType)).put(payload as never)
  await transaction.objectStore('outbox').put(operation)
  await transaction.objectStore('meta').put({ key: 'outboxSequence', value: localSequence })
  await transaction.done
}

function validateTransactionInput(input: TransactionInput): void {
  assertMoneyCents(input.amountCents)
  if (input.kind === 'adjustment' ? input.amountCents === 0 : input.amountCents <= 0) throw new Error('El importe no es válido.')
  if (!input.concept.trim()) throw new Error('El concepto es obligatorio.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('La fecha no es válida.')
  if (input.kind === 'transfer') {
    if (!input.sourceAccountId || !input.destinationAccountId) throw new Error('Selecciona cuenta origen y destino.')
    if (input.sourceAccountId === input.destinationAccountId) throw new Error('Las cuentas de una transferencia deben ser distintas.')
  } else if (!input.accountId) throw new Error('Selecciona una cuenta.')
  if ((input.kind === 'income' || input.kind === 'expense') && !input.categoryId) throw new Error('Selecciona una categoría.')
}

function validateAccountInput(input: AccountInput): void {
  if (!input.name.trim()) throw new Error('El nombre de la cuenta es obligatorio.')
  assertMoneyCents(input.initialBalanceCents)
}

function validateCategoryInput(input: CategoryInput): void {
  if (!input.name.trim()) throw new Error('El nombre de la categoría es obligatorio.')
  if (!input.icon.trim()) throw new Error('El icono es obligatorio.')
}

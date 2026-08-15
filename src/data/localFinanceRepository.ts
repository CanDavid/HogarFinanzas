import { normalizeDateOnly } from '../domain/dates'
import { assertMoneyCents } from '../domain/money'
import { occurrenceTransactionId } from '../domain/recurrence'
import type {
  Account, AccountInput, Category, CategoryInput, EntityType, OperationResult, RecurringRule, RecurringRuleInput,
  Session, SyncChange, SyncEntity, SyncOperation, SyncRepository, Transaction, TransactionInput, UserId,
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

  async listRecurringRules(): Promise<RecurringRule[]> {
    const database = await getDatabase()
    return (await database.getAll('recurringRules')).filter((item) => !item.deletedAt)
      .sort((left, right) => left.active === right.active ? left.startDate.localeCompare(right.startDate) : left.active ? -1 : 1)
  }

  async createTransaction(input: TransactionInput, userId: UserId): Promise<Transaction> {
    validateTransactionInput(input)
    const record = newRecord<Transaction>({ ...normalizeTransactionInput(input), createdBy: userId })
    await this.writeLocalChange('transaction', 'create', record, 0)
    return record
  }

  async updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
    validateTransactionInput(input)
    const current = await (await getDatabase()).get('transactions', id)
    if (!current || current.deletedAt) throw new Error('El movimiento ya no está disponible.')
    const updated = { ...normalizeTransaction(current), ...normalizeTransactionInput(input, current), updatedAt: new Date().toISOString() }
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

  async archiveAccount(id: string): Promise<void> { await this.setArchived('account', id, true) }
  async restoreAccount(id: string): Promise<void> { await this.setArchived('account', id, false) }

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

  async archiveCategory(id: string): Promise<void> { await this.setArchived('category', id, true) }
  async restoreCategory(id: string): Promise<void> { await this.setArchived('category', id, false) }

  async createRecurringRule(input: RecurringRuleInput, userId: UserId): Promise<RecurringRule> {
    validateRecurringRuleInput(input)
    const record = newRecord<RecurringRule>({ ...input, active: true, createdBy: userId })
    await this.writeLocalChange('recurringRule', 'create', record, 0)
    return record
  }

  async updateRecurringRule(id: string, input: RecurringRuleInput): Promise<RecurringRule> {
    validateRecurringRuleInput(input)
    const database = await getDatabase(); const current = await database.get('recurringRules', id)
    if (!current || current.deletedAt) throw new Error('La recurrencia ya no está disponible.')
    const updated = { ...current, ...input, updatedAt: new Date().toISOString() }
    await this.writeLocalChange('recurringRule', 'update', updated, current.version)
    return updated
  }

  async setRecurringRuleActive(id: string, active: boolean): Promise<void> {
    const database = await getDatabase(); const current = await database.get('recurringRules', id)
    if (!current || current.deletedAt || current.active === active) return
    if (active) {
      const [account, category] = await Promise.all([database.get('accounts', current.accountId), database.get('categories', current.categoryId)])
      if (!account || account.deletedAt || account.archivedAt || !category || category.deletedAt || category.archivedAt) {
        throw new Error('Reactiva primero la cuenta y la categoría de esta recurrencia.')
      }
    }
    const updated = { ...current, active, updatedAt: new Date().toISOString() }
    await this.writeLocalChange('recurringRule', 'update', updated, current.version)
  }

  async createTransactionWithRecurrence(input: TransactionInput, recurrence: RecurringRuleInput, userId: UserId): Promise<Transaction> {
    validateTransactionInput(input); validateRecurringRuleInput(recurrence)
    if (input.kind !== recurrence.kind) throw new Error('El tipo del movimiento y la recurrencia no coincide.')
    const rule = newRecord<RecurringRule>({ ...recurrence, active: true, createdBy: userId })
    const occurrenceDate = normalizeDateOnly(input.date) ?? input.date
    const record = newRecord<Transaction>({ ...normalizeTransactionInput(input), id: occurrenceTransactionId(rule.id, occurrenceDate),
      recurringRuleId: rule.id, recurringOccurrenceDate: occurrenceDate, createdBy: userId })
    const database = await getDatabase()
    const transaction = database.transaction(['transactions', 'recurringRules', 'outbox', 'meta'], 'readwrite')
    await queueLocalChange(transaction, 'recurringRule', 'create', rule, 0)
    await queueLocalChange(transaction, 'transaction', 'create', record, 0)
    await transaction.done
    return record
  }

  async materializeRecurringOccurrence(ruleId: string, date: string, userId: UserId): Promise<Transaction> {
    const normalizedDate = normalizeDateOnly(date)
    if (!normalizedDate) throw new Error('La fecha de la ocurrencia no es válida.')
    const database = await getDatabase(); const rule = await database.get('recurringRules', ruleId)
    if (!rule || rule.deletedAt || !rule.active) throw new Error('La recurrencia no está activa.')
    const id = occurrenceTransactionId(ruleId, normalizedDate)
    const existing = await database.get('transactions', id)
    if (existing) {
      if (existing.deletedAt) throw new Error('Esta ocurrencia fue eliminada y no puede recrearse.')
      return normalizeTransaction(existing)
    }
    const record = newRecord<Transaction>({ id, kind: rule.kind, amountCents: rule.amountCents, concept: rule.concept,
      note: rule.note, date: normalizedDate, accountId: rule.accountId, categoryId: rule.categoryId,
      sourceAccountId: null, destinationAccountId: null, recurringRuleId: ruleId,
      recurringOccurrenceDate: normalizedDate, createdBy: userId })
    await this.writeLocalChange('transaction', 'create', record, 0)
    return record
  }

  async pendingOperations(): Promise<SyncOperation[]> {
    return (await (await getDatabase()).getAll('outbox')).filter((item) => !item.permanentFailure)
      .map((item) => ({ ...item, entityType: item.entityType ?? 'transaction' }))
      .sort((left, right) => left.localSequence - right.localSequence)
  }

  async failedOperations(): Promise<SyncOperation[]> {
    return (await (await getDatabase()).getAll('outbox')).filter((item) => item.permanentFailure)
  }

  async recoverFailedDeletions(): Promise<number> {
    const database = await getDatabase(); const transaction = database.transaction('outbox', 'readwrite')
    let recovered = 0
    for (const operation of await transaction.store.getAll()) {
      if (!operation.permanentFailure || operation.kind !== 'delete') continue
      await transaction.store.put({ ...operation, permanentFailure: false, lastError: null })
      recovered += 1
    }
    await transaction.done
    return recovered
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
    const transaction = database.transaction(['outbox', 'transactions', 'accounts', 'categories', 'recurringRules'], 'readwrite')
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
        else if (entityType === 'category') await transaction.objectStore('categories').put(result.record as Category)
        else await transaction.objectStore('recurringRules').put(result.record as RecurringRule)
      }
    }
    await transaction.done
  }

  async mergeServerChanges(changes: SyncChange[]): Promise<void> {
    const database = await getDatabase()
    const transaction = database.transaction(['transactions', 'accounts', 'categories', 'recurringRules'], 'readwrite')
    for (const incoming of changes) {
      const change = 'record' in incoming ? incoming : { entityType: 'transaction' as const, record: incoming as unknown as Transaction }
      const remote = normalizeEntity(change.entityType, change.record)
      if (change.entityType === 'transaction') {
        const record = remote as Transaction; const local = await transaction.objectStore('transactions').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('transactions').put(record)
      } else if (change.entityType === 'account') {
        const record = remote as Account; const local = await transaction.objectStore('accounts').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('accounts').put(record)
      } else if (change.entityType === 'category') {
        const record = remote as Category; const local = await transaction.objectStore('categories').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('categories').put(record)
      } else {
        const record = remote as RecurringRule; const local = await transaction.objectStore('recurringRules').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('recurringRules').put(record)
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

  private async setArchived(entityType: 'account' | 'category', id: string, archived: boolean): Promise<void> {
    const database = await getDatabase()
    const current = entityType === 'account' ? await database.get('accounts', id) : await database.get('categories', id)
    if (!current || current.deletedAt || Boolean(current.archivedAt) === archived) return
    const now = new Date().toISOString()
    const updated = { ...current, archivedAt: archived ? now : null, updatedAt: now }
    await this.writeLocalChange(entityType, 'update', updated, current.version)
  }

  private async writeLocalChange(entityType: EntityType, kind: SyncOperation['kind'], payload: SyncEntity, baseVersion: number) {
    const database = await getDatabase()
    if (entityType === 'transaction') {
      const transaction = database.transaction(['transactions', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, normalizeTransaction(payload as Transaction), baseVersion)
      await transaction.done
    } else if (entityType === 'account') {
      const transaction = database.transaction(['accounts', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as Account, baseVersion)
      await transaction.done
    } else if (entityType === 'category') {
      const transaction = database.transaction(['categories', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as Category, baseVersion)
      await transaction.done
    } else {
      const transaction = database.transaction(['recurringRules', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as RecurringRule, baseVersion)
      await transaction.done
    }
  }

  private async getMeta<T extends StoredMeta>(key: string, fallback: T): Promise<T> {
    const item = await (await getDatabase()).get('meta', key)
    return (item?.value as T | undefined) ?? fallback
  }
  private async setMeta(key: string, value: StoredMeta): Promise<void> { await (await getDatabase()).put('meta', { key, value }) }
}

function newRecord<T extends SyncEntity>(values: Omit<T, keyof import('../domain/types').SyncableRecord> & { createdBy: UserId; id?: string }): T {
  const now = new Date().toISOString()
  return { ...values, id: values.id ?? crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null, version: 0, changeSequence: 0 } as T
}

function normalizeTransactionInput(input: TransactionInput, current?: Transaction): TransactionInput {
  return { ...input,
    recurringRuleId: input.recurringRuleId === undefined ? current?.recurringRuleId ?? null : input.recurringRuleId,
    recurringOccurrenceDate: input.recurringOccurrenceDate === undefined ? current?.recurringOccurrenceDate ?? null : input.recurringOccurrenceDate }
}

function normalizeTransaction(transaction: Transaction): Transaction {
  return { ...transaction, date: normalizeDateOnly(transaction.date) ?? transaction.date,
    note: typeof transaction.note === 'string' ? transaction.note : '',
    accountId: transaction.accountId ?? null, categoryId: transaction.categoryId ?? null,
    sourceAccountId: transaction.sourceAccountId ?? null, destinationAccountId: transaction.destinationAccountId ?? null,
    recurringRuleId: transaction.recurringRuleId ?? null, recurringOccurrenceDate: transaction.recurringOccurrenceDate ?? null }
}

function normalizeEntity(entityType: EntityType, entity: SyncEntity): SyncEntity {
  return entityType === 'transaction' ? normalizeTransaction(entity as Transaction) : entity
}

function storeName(entityType: EntityType): 'transactions' | 'accounts' | 'categories' | 'recurringRules' {
  return entityType === 'transaction' ? 'transactions' : entityType === 'account' ? 'accounts'
    : entityType === 'category' ? 'categories' : 'recurringRules'
}

async function queueLocalChange(transaction: {
  objectStore(name: 'meta'): { get(key: string): Promise<{ value: unknown } | undefined>; put(value: { key: string; value: unknown }): Promise<unknown> }
  objectStore(name: 'outbox'): { put(value: SyncOperation): Promise<unknown> }
  objectStore(name: 'transactions' | 'accounts' | 'categories' | 'recurringRules'): { put(value: never): Promise<unknown> }
}, entityType: EntityType, kind: SyncOperation['kind'], payload: SyncEntity, baseVersion: number) {
  const sequenceItem = await transaction.objectStore('meta').get('outboxSequence')
  const localSequence = Number(sequenceItem?.value ?? 0) + 1
  const operation: SyncOperation = { operationId: crypto.randomUUID(), localSequence, entityType, kind, recordId: payload.id,
    payload, baseVersion, attempts: 0, lastError: null, permanentFailure: false }
  await transaction.objectStore(storeName(entityType)).put(payload as never)
  await transaction.objectStore('outbox').put(operation)
  await transaction.objectStore('meta').put({ key: 'outboxSequence', value: localSequence })
}

function validateTransactionInput(input: TransactionInput): void {
  assertMoneyCents(input.amountCents)
  if (input.kind === 'adjustment' ? input.amountCents === 0 : input.amountCents <= 0) throw new Error('El importe no es válido.')
  if (!input.concept.trim()) throw new Error('El concepto es obligatorio.')
  if (typeof input.note !== 'string' || input.note.length > 500) throw new Error('La nota no es válida.')
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

function validateRecurringRuleInput(input: RecurringRuleInput): void {
  assertMoneyCents(input.amountCents)
  if (input.amountCents <= 0) throw new Error('El importe recurrente no es válido.')
  if (!input.concept.trim()) throw new Error('El concepto recurrente es obligatorio.')
  if (typeof input.note !== 'string' || input.note.length > 500) throw new Error('La nota no es válida.')
  if (!input.accountId || !input.categoryId) throw new Error('Selecciona cuenta y categoría.')
  if (!['monthly', 'quarterly', 'annual'].includes(input.frequency)) throw new Error('La frecuencia no es válida.')
  if (!normalizeDateOnly(input.startDate)) throw new Error('La próxima fecha no es válida.')
  if (input.endDate && (!normalizeDateOnly(input.endDate) || input.endDate < input.startDate)) throw new Error('La fecha final no es válida.')
}

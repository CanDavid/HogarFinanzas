import { normalizeDateOnly } from '../domain/dates'
import { assertMoneyCents } from '../domain/money'
import { deterministicRecordId, occurrenceTransactionId } from '../domain/recurrence'
import type {
  Account, AccountInput, Budget, Category, CategoryInput, EntityType, MonthlyPlan, OperationResult, PlannedItem, PlannedItemInput,
  RecurringRule, RecurringRuleInput, Session, SyncChange, SyncEntity, SyncOperation, SyncRepository, Transaction, TransactionInput, UserId,
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

  async listBudgets(): Promise<Budget[]> {
    const database = await getDatabase(); const stored = await database.getAll('budgets'); const normalized = stored.map(normalizeBudget)
    await Promise.all(normalized.filter((item, index) => item.month !== stored[index].month).map((item) => database.put('budgets', item)))
    return normalized.filter((item) => !item.deletedAt)
      .sort((left, right) => left.month.localeCompare(right.month) || left.categoryId.localeCompare(right.categoryId))
  }

  async listPlannedItems(): Promise<PlannedItem[]> {
    return (await (await getDatabase()).getAll('plannedItems')).filter((item) => !item.deletedAt)
      .sort((left, right) => left.date.localeCompare(right.date) || left.concept.localeCompare(right.concept))
  }

  async listMonthlyPlans(): Promise<MonthlyPlan[]> {
    const database = await getDatabase(); const stored = await database.getAll('monthlyPlans'); const normalized = stored.map(normalizeMonthlyPlan)
    await Promise.all(normalized.filter((item, index) => item.month !== stored[index].month).map((item) => database.put('monthlyPlans', item)))
    return normalized.filter((item) => !item.deletedAt).sort((left, right) => left.month.localeCompare(right.month))
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

  async setBudget(month: string, categoryId: string, amountCents: number, userId: UserId): Promise<Budget> {
    validateMonth(month); assertMoneyCents(amountCents)
    if (amountCents < 0 || !categoryId) throw new Error('El presupuesto no es válido.')
    const database = await getDatabase(); const id = deterministicRecordId('budget', `${month}:${categoryId}`)
    const current = await database.get('budgets', id)
    if (current?.deletedAt) throw new Error('Este presupuesto ya no está disponible.')
    if (current) {
      const updated = { ...current, month, categoryId, amountCents, updatedAt: new Date().toISOString() }
      await this.writeLocalChange('budget', 'update', updated, current.version); return updated
    }
    const record = newRecord<Budget>({ id, month, categoryId, amountCents, createdBy: userId })
    await this.writeLocalChange('budget', 'create', record, 0); return record
  }

  async createPlannedItem(input: PlannedItemInput, userId: UserId): Promise<PlannedItem> {
    validatePlannedItemInput(input)
    const record = newRecord<PlannedItem>({ ...input, source: 'manual', recurringRuleId: null, status: 'pending', createdBy: userId })
    await this.writeLocalChange('plannedItem', 'create', record, 0); return record
  }

  async updatePlannedItem(id: string, input: PlannedItemInput): Promise<PlannedItem> {
    validatePlannedItemInput(input)
    const database = await getDatabase(); const current = await database.get('plannedItems', id)
    if (!current || current.deletedAt || current.source !== 'manual') throw new Error('El previsto ya no está disponible.')
    const updated = { ...current, ...input, updatedAt: new Date().toISOString() }
    await this.writeLocalChange('plannedItem', 'update', updated, current.version); return updated
  }

  async deletePlannedItem(id: string): Promise<void> {
    const database = await getDatabase(); const current = await database.get('plannedItems', id)
    if (!current || current.deletedAt || current.source !== 'manual') return
    const now = new Date().toISOString()
    await this.writeLocalChange('plannedItem', 'delete', { ...current, deletedAt: now, updatedAt: now }, current.version)
  }

  async setPlannedItemStatus(id: string, status: PlannedItem['status']): Promise<void> {
    const database = await getDatabase(); const current = await database.get('plannedItems', id)
    if (!current || current.deletedAt || current.status === status) return
    const updated = { ...current, status, updatedAt: new Date().toISOString() }
    await this.writeLocalChange('plannedItem', 'update', updated, current.version)
  }

  async setRecurringOccurrenceStatus(ruleId: string, date: string, status: PlannedItem['status'], userId: UserId): Promise<PlannedItem> {
    const normalizedDate = normalizeDateOnly(date); if (!normalizedDate) throw new Error('La fecha prevista no es válida.')
    const database = await getDatabase(); const rule = await database.get('recurringRules', ruleId)
    if (!rule || rule.deletedAt) throw new Error('La recurrencia ya no está disponible.')
    const id = deterministicRecordId('planned-recurring', `${ruleId}:${normalizedDate}`); const current = await database.get('plannedItems', id)
    if (current) {
      if (current.deletedAt) throw new Error('La ocurrencia ya no está disponible.')
      const updated = { ...current, status, updatedAt: new Date().toISOString() }
      await this.writeLocalChange('plannedItem', 'update', updated, current.version); return updated
    }
    const record = newRecord<PlannedItem>({ id, source: 'recurring', recurringRuleId: ruleId, kind: rule.kind,
      amountCents: rule.amountCents, concept: rule.concept, note: rule.note, date: normalizedDate,
      accountId: rule.accountId, categoryId: rule.categoryId, status, createdBy: userId })
    await this.writeLocalChange('plannedItem', 'create', record, 0); return record
  }

  async materializePlannedItem(id: string, userId: UserId): Promise<Transaction> {
    const database = await getDatabase(); const item = await database.get('plannedItems', id)
    if (!item || item.deletedAt || item.source !== 'manual') throw new Error('El previsto ya no está disponible.')
    if (item.status === 'omitted') throw new Error('Reactiva el previsto antes de registrarlo.')
    const transactionId = deterministicRecordId('planned-transaction', id); const existing = await database.get('transactions', transactionId)
    if (existing) {
      if (existing.deletedAt) throw new Error('El movimiento asociado fue eliminado y no puede recrearse.')
      return normalizeTransaction(existing)
    }
    const record = newRecord<Transaction>({ id: transactionId, kind: item.kind, amountCents: item.amountCents,
      concept: item.concept, note: item.note, date: item.date, accountId: item.accountId, categoryId: item.categoryId,
      sourceAccountId: null, destinationAccountId: null, recurringRuleId: null, recurringOccurrenceDate: null,
      plannedItemId: item.id, createdBy: userId })
    await this.writeLocalChange('transaction', 'create', record, 0); return record
  }

  async setMonthlyPlan(month: string, savingsAllocationCents: number, investmentAllocationCents: number, userId: UserId): Promise<MonthlyPlan> {
    validateMonth(month); assertMoneyCents(savingsAllocationCents); assertMoneyCents(investmentAllocationCents)
    if (savingsAllocationCents < 0 || investmentAllocationCents < 0) throw new Error('La distribución no admite importes negativos.')
    const database = await getDatabase(); const id = deterministicRecordId('monthly-plan', month); const current = await database.get('monthlyPlans', id)
    if (current?.deletedAt) throw new Error('El plan mensual ya no está disponible.')
    if (current) {
      const updated = { ...current, month, savingsAllocationCents, investmentAllocationCents, updatedAt: new Date().toISOString() }
      await this.writeLocalChange('monthlyPlan', 'update', updated, current.version); return updated
    }
    const record = newRecord<MonthlyPlan>({ id, month, savingsAllocationCents, investmentAllocationCents, createdBy: userId })
    await this.writeLocalChange('monthlyPlan', 'create', record, 0); return record
  }

  async pendingOperations(): Promise<SyncOperation[]> {
    const database = await getDatabase(); const stored = await database.getAll('outbox'); const repaired: SyncOperation[] = []
    for (const item of stored) {
      const entityType = item.entityType ?? 'transaction'; const payload = normalizeEntity(entityType, item.payload)
      const repairedMonth = (entityType === 'budget' || entityType === 'monthlyPlan') &&
        (payload as Budget | MonthlyPlan).month !== (item.payload as Budget | MonthlyPlan).month
      const operation = { ...item, entityType, payload, permanentFailure: repairedMonth ? false : item.permanentFailure,
        lastError: repairedMonth ? null : item.lastError }
      if (repairedMonth) await database.put('outbox', operation)
      repaired.push(operation)
    }
    return repaired.filter((item) => !item.permanentFailure)
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
    const transaction = database.transaction(['outbox', 'transactions', 'accounts', 'categories', 'recurringRules', 'budgets', 'plannedItems', 'monthlyPlans'], 'readwrite')
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
        else if (entityType === 'recurringRule') await transaction.objectStore('recurringRules').put(result.record as RecurringRule)
        else if (entityType === 'budget') await transaction.objectStore('budgets').put(normalizeBudget(result.record as Budget))
        else if (entityType === 'plannedItem') await transaction.objectStore('plannedItems').put(result.record as PlannedItem)
        else await transaction.objectStore('monthlyPlans').put(normalizeMonthlyPlan(result.record as MonthlyPlan))
      }
    }
    const remainingOperations = (await transaction.objectStore('outbox').getAll()).sort((left, right) => left.localSequence - right.localSequence)
    for (const operation of remainingOperations) {
      const entityType = operation.entityType ?? 'transaction'; const payload = operation.payload
      if (entityType === 'transaction') await transaction.objectStore('transactions').put(normalizeTransaction(payload as Transaction))
      else if (entityType === 'account') await transaction.objectStore('accounts').put(payload as Account)
      else if (entityType === 'category') await transaction.objectStore('categories').put(payload as Category)
      else if (entityType === 'recurringRule') await transaction.objectStore('recurringRules').put(payload as RecurringRule)
      else if (entityType === 'budget') await transaction.objectStore('budgets').put(normalizeBudget(payload as Budget))
      else if (entityType === 'plannedItem') await transaction.objectStore('plannedItems').put(payload as PlannedItem)
      else await transaction.objectStore('monthlyPlans').put(normalizeMonthlyPlan(payload as MonthlyPlan))
    }
    await transaction.done
  }

  async mergeServerChanges(changes: SyncChange[]): Promise<void> {
    const database = await getDatabase()
    const transaction = database.transaction(['transactions', 'accounts', 'categories', 'recurringRules', 'budgets', 'plannedItems', 'monthlyPlans', 'outbox'], 'readwrite')
    const locallyPending = new Set((await transaction.objectStore('outbox').getAll())
      .map((operation) => `${operation.entityType ?? 'transaction'}:${operation.recordId}`))
    for (const incoming of changes) {
      const change = 'record' in incoming ? incoming : { entityType: 'transaction' as const, record: incoming as unknown as Transaction }
      if (locallyPending.has(`${change.entityType}:${change.record.id}`)) continue
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
      } else if (change.entityType === 'recurringRule') {
        const record = remote as RecurringRule; const local = await transaction.objectStore('recurringRules').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('recurringRules').put(record)
      } else if (change.entityType === 'budget') {
        const record = remote as Budget; const local = await transaction.objectStore('budgets').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('budgets').put(record)
      } else if (change.entityType === 'plannedItem') {
        const record = remote as PlannedItem; const local = await transaction.objectStore('plannedItems').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('plannedItems').put(record)
      } else {
        const record = remote as MonthlyPlan; const local = await transaction.objectStore('monthlyPlans').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('monthlyPlans').put(record)
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
    } else if (entityType === 'recurringRule') {
      const transaction = database.transaction(['recurringRules', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as RecurringRule, baseVersion)
      await transaction.done
    } else if (entityType === 'budget') {
      const transaction = database.transaction(['budgets', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as Budget, baseVersion)
      await transaction.done
    } else if (entityType === 'plannedItem') {
      const transaction = database.transaction(['plannedItems', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as PlannedItem, baseVersion)
      await transaction.done
    } else {
      const transaction = database.transaction(['monthlyPlans', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as MonthlyPlan, baseVersion)
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
    recurringOccurrenceDate: input.recurringOccurrenceDate === undefined ? current?.recurringOccurrenceDate ?? null : input.recurringOccurrenceDate,
    plannedItemId: input.plannedItemId === undefined ? current?.plannedItemId ?? null : input.plannedItemId }
}

function normalizeTransaction(transaction: Transaction): Transaction {
  return { ...transaction, date: normalizeDateOnly(transaction.date) ?? transaction.date,
    note: typeof transaction.note === 'string' ? transaction.note : '',
    accountId: transaction.accountId ?? null, categoryId: transaction.categoryId ?? null,
    sourceAccountId: transaction.sourceAccountId ?? null, destinationAccountId: transaction.destinationAccountId ?? null,
    recurringRuleId: transaction.recurringRuleId ?? null, recurringOccurrenceDate: transaction.recurringOccurrenceDate ?? null,
    plannedItemId: transaction.plannedItemId ?? null }
}

function normalizeEntity(entityType: EntityType, entity: SyncEntity): SyncEntity {
  return entityType === 'transaction' ? normalizeTransaction(entity as Transaction)
    : entityType === 'budget' ? normalizeBudget(entity as Budget)
      : entityType === 'monthlyPlan' ? normalizeMonthlyPlan(entity as MonthlyPlan) : entity
}

function normalizeBudget(budget: Budget): Budget { return { ...budget, month: normalizeMonthValue(budget.month) } }
function normalizeMonthlyPlan(plan: MonthlyPlan): MonthlyPlan { return { ...plan, month: normalizeMonthValue(plan.month) } }
function normalizeMonthValue(value: string): string {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value
  return normalizeDateOnly(value)?.slice(0, 7) ?? value
}

function storeName(entityType: EntityType): 'transactions' | 'accounts' | 'categories' | 'recurringRules' | 'budgets' | 'plannedItems' | 'monthlyPlans' {
  return entityType === 'transaction' ? 'transactions' : entityType === 'account' ? 'accounts'
    : entityType === 'category' ? 'categories' : entityType === 'recurringRule' ? 'recurringRules'
      : entityType === 'budget' ? 'budgets' : entityType === 'plannedItem' ? 'plannedItems' : 'monthlyPlans'
}

async function queueLocalChange(transaction: {
  objectStore(name: 'meta'): { get(key: string): Promise<{ value: unknown } | undefined>; put(value: { key: string; value: unknown }): Promise<unknown> }
  objectStore(name: 'outbox'): { put(value: SyncOperation): Promise<unknown> }
  objectStore(name: 'transactions' | 'accounts' | 'categories' | 'recurringRules' | 'budgets' | 'plannedItems' | 'monthlyPlans'): { put(value: never): Promise<unknown> }
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

function validatePlannedItemInput(input: PlannedItemInput): void {
  assertMoneyCents(input.amountCents)
  if (input.amountCents <= 0) throw new Error('El importe previsto no es válido.')
  if (!input.concept.trim()) throw new Error('El concepto previsto es obligatorio.')
  if (typeof input.note !== 'string' || input.note.length > 500) throw new Error('La nota no es válida.')
  if (!normalizeDateOnly(input.date)) throw new Error('La fecha prevista no es válida.')
  if (!input.accountId || !input.categoryId) throw new Error('Selecciona cuenta y categoría.')
}

function validateMonth(month: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('El mes no es válido.')
}

import type { BackupPayload } from '../domain/backup'
import { localDateOnly, normalizeDateOnly } from '../domain/dates'
import { validateClosureInput } from '../domain/closures'
import { goalAssignedCents } from '../domain/goals'
import { assertMoneyCents } from '../domain/money'
import { deterministicRecordId, occurrenceTransactionId } from '../domain/recurrence'
import type {
  Account, AccountInput, Budget, Category, CategoryInput, EntityType, Goal, GoalAllocation, GoalAllocationInput, GoalInput, MonthlyClosure, MonthlyClosureInput, MonthlyPlan,
  OperationResult, PlannedItem, PlannedItemInput, RecurringRule, RecurringRuleInput, Session, SyncableRecord, SyncChange, SyncEntity, SyncOperation,
  SyncRepository, Transaction, TransactionInput, UserId,
} from '../domain/types'
import { getDatabase, type StoredMeta } from './database'

const DEFAULT_SERVER_URL = import.meta.env.VITE_APPS_SCRIPT_URL ?? ''
const ENTITY_STORES = ['transactions', 'accounts', 'categories', 'recurringRules', 'budgets', 'plannedItems',
  'monthlyPlans', 'goals', 'goalAllocations', 'monthlyClosures'] as const

export class LocalFinanceRepository implements SyncRepository {
  async listTransactions(): Promise<Transaction[]> {
    const database = await getDatabase()
    const stored = await database.getAll('transactions')
    const transactions = stored.map(normalizeTransaction)
    await Promise.all(transactions.filter((item, index) => transactionRepairedFields(stored[index], item))
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

  async listGoals(): Promise<Goal[]> {
    return (await (await getDatabase()).getAll('goals')).filter((item) => !item.deletedAt)
      .sort((left, right) => left.archivedAt === right.archivedAt
        ? Boolean(left.completedAt) === Boolean(right.completedAt) ? left.name.localeCompare(right.name) : left.completedAt ? 1 : -1
        : left.archivedAt ? 1 : -1)
  }

  async listGoalAllocations(): Promise<GoalAllocation[]> {
    return (await (await getDatabase()).getAll('goalAllocations')).filter((item) => !item.deletedAt)
      .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
  }

  async listMonthlyClosures(): Promise<MonthlyClosure[]> {
    const database = await getDatabase(); const stored = await database.getAll('monthlyClosures'); const normalized = stored.map(normalizeMonthlyClosure)
    await Promise.all(normalized.filter((item, index) => item.month !== stored[index].month).map((item) => database.put('monthlyClosures', item)))
    return normalized.filter((item) => !item.deletedAt).sort((left, right) => right.month.localeCompare(left.month))
  }

  async createTransaction(input: TransactionInput, userId: UserId): Promise<Transaction> {
    validateTransactionInput(input)
    await this.assertMonthOpen(input.date.slice(0, 7))
    const record = newRecord<Transaction>({ ...normalizeTransactionInput(input), createdBy: userId })
    await this.writeLocalChange('transaction', 'create', record, 0)
    return record
  }

  async updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
    validateTransactionInput(input)
    const current = await (await getDatabase()).get('transactions', id)
    if (!current || current.deletedAt) throw new Error('El movimiento ya no está disponible.')
    await this.assertMonthOpen(current.date.slice(0, 7)); await this.assertMonthOpen(input.date.slice(0, 7))
    const updated = { ...normalizeTransaction(current), ...normalizeTransactionInput(input, current), updatedAt: new Date().toISOString() }
    await this.writeLocalChange('transaction', 'update', updated, current.version)
    return updated
  }

  async deleteTransaction(id: string): Promise<void> {
    const current = await (await getDatabase()).get('transactions', id)
    if (!current || current.deletedAt) return
    await this.assertMonthOpen(current.date.slice(0, 7))
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
    await this.assertMonthOpen(input.date.slice(0, 7))
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
    await this.assertMonthOpen(normalizedDate.slice(0, 7))
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
    await this.assertMonthOpen(month)
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
    await this.assertMonthOpen(input.date.slice(0, 7))
    const record = newRecord<PlannedItem>({ ...input, source: 'manual', recurringRuleId: null, status: 'pending', createdBy: userId })
    await this.writeLocalChange('plannedItem', 'create', record, 0); return record
  }

  async updatePlannedItem(id: string, input: PlannedItemInput): Promise<PlannedItem> {
    validatePlannedItemInput(input)
    const database = await getDatabase(); const current = await database.get('plannedItems', id)
    if (!current || current.deletedAt || current.source !== 'manual') throw new Error('El previsto ya no está disponible.')
    await this.assertMonthOpen(current.date.slice(0, 7)); await this.assertMonthOpen(input.date.slice(0, 7))
    const updated = { ...current, ...input, updatedAt: new Date().toISOString() }
    await this.writeLocalChange('plannedItem', 'update', updated, current.version); return updated
  }

  async deletePlannedItem(id: string): Promise<void> {
    const database = await getDatabase(); const current = await database.get('plannedItems', id)
    if (!current || current.deletedAt || current.source !== 'manual') return
    await this.assertMonthOpen(current.date.slice(0, 7))
    const now = new Date().toISOString()
    await this.writeLocalChange('plannedItem', 'delete', { ...current, deletedAt: now, updatedAt: now }, current.version)
  }

  async setPlannedItemStatus(id: string, status: PlannedItem['status']): Promise<void> {
    const database = await getDatabase(); const current = await database.get('plannedItems', id)
    if (!current || current.deletedAt || current.status === status) return
    await this.assertMonthOpen(current.date.slice(0, 7))
    const updated = { ...current, status, updatedAt: new Date().toISOString() }
    await this.writeLocalChange('plannedItem', 'update', updated, current.version)
  }

  async setRecurringOccurrenceStatus(ruleId: string, date: string, status: PlannedItem['status'], userId: UserId): Promise<PlannedItem> {
    const normalizedDate = normalizeDateOnly(date); if (!normalizedDate) throw new Error('La fecha prevista no es válida.')
    await this.assertMonthOpen(normalizedDate.slice(0, 7))
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
    await this.assertMonthOpen(item.date.slice(0, 7))
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
    await this.assertMonthOpen(month)
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

  async createGoal(input: GoalInput, initialAmountCents: number, userId: UserId): Promise<Goal> {
    validateGoalInput(input); assertMoneyCents(initialAmountCents)
    if (initialAmountCents < 0) throw new Error('El importe inicial no puede ser negativo.')
    const goal = newRecord<Goal>({ ...normalizeGoalInput(input), completedAt: null, archivedAt: null, createdBy: userId })
    if (initialAmountCents === 0) {
      await this.writeLocalChange('goal', 'create', goal, 0)
      return goal
    }
    const allocation = newRecord<GoalAllocation>({ goalId: goal.id, amountCents: initialAmountCents,
      date: localDateOnly(), note: 'Importe inicial', createdBy: userId })
    const database = await getDatabase()
    const transaction = database.transaction(['goals', 'goalAllocations', 'outbox', 'meta'], 'readwrite')
    await queueLocalChange(transaction, 'goal', 'create', goal, 0)
    await queueLocalChange(transaction, 'goalAllocation', 'create', allocation, 0)
    await transaction.done
    return goal
  }

  async updateGoal(id: string, input: GoalInput): Promise<Goal> {
    validateGoalInput(input)
    const database = await getDatabase(); const current = await database.get('goals', id)
    if (!current || current.deletedAt) throw new Error('El objetivo ya no está disponible.')
    const updated = { ...current, ...normalizeGoalInput(input), updatedAt: new Date().toISOString() }
    await this.writeLocalChange('goal', 'update', updated, current.version)
    return updated
  }

  async setGoalCompleted(id: string, completed: boolean): Promise<void> {
    const database = await getDatabase(); const current = await database.get('goals', id)
    if (!current || current.deletedAt || current.archivedAt || Boolean(current.completedAt) === completed) return
    const now = new Date().toISOString()
    await this.writeLocalChange('goal', 'update', { ...current, completedAt: completed ? now : null, updatedAt: now }, current.version)
  }

  async archiveGoal(id: string): Promise<void> { await this.setGoalArchived(id, true) }
  async restoreGoal(id: string): Promise<void> { await this.setGoalArchived(id, false) }

  async createGoalAllocation(goalId: string, input: GoalAllocationInput, userId: UserId): Promise<GoalAllocation> {
    validateGoalAllocationInput(input)
    const database = await getDatabase(); const goal = await database.get('goals', goalId)
    if (!goal || goal.deletedAt || goal.archivedAt) throw new Error('El objetivo no está activo.')
    if (goal.completedAt) throw new Error('Reabre el objetivo antes de cambiar su asignación.')
    const currentAssigned = goalAssignedCents(goalId, await database.getAll('goalAllocations'))
    if (currentAssigned + input.amountCents < 0) throw new Error('No puedes retirar más dinero del asignado.')
    const allocation = newRecord<GoalAllocation>({ ...input, date: normalizeDateOnly(input.date) ?? input.date, goalId, createdBy: userId })
    await this.writeLocalChange('goalAllocation', 'create', allocation, 0)
    return allocation
  }

  async closeMonth(input: MonthlyClosureInput, userId: UserId): Promise<MonthlyClosure> {
    validateClosureInput(input)
    if (input.month > localDateOnly().slice(0, 7)) throw new Error('No puedes cerrar un mes futuro.')
    const database = await getDatabase(); const id = deterministicRecordId('monthly-closure', input.month)
    const current = await database.get('monthlyClosures', id); const now = new Date().toISOString()
    if (current?.deletedAt) throw new Error('El cierre mensual ya no está disponible.')
    if (current?.status === 'closed') return current
    if (current) {
      const updated: MonthlyClosure = { ...current, ...input, status: 'closed', revision: current.revision + 1,
        closedAt: now, closedBy: userId, updatedAt: now }
      await this.writeLocalChange('monthlyClosure', 'update', updated, current.version)
      return updated
    }
    const record = newRecord<MonthlyClosure>({ id, ...input, status: 'closed', revision: 1, closedAt: now, closedBy: userId,
      reopenedAt: null, reopenedBy: null, createdBy: userId })
    await this.writeLocalChange('monthlyClosure', 'create', record, 0)
    return record
  }

  async reopenMonth(month: string, userId: UserId): Promise<MonthlyClosure> {
    validateMonth(month)
    const database = await getDatabase(); const id = deterministicRecordId('monthly-closure', month); const current = await database.get('monthlyClosures', id)
    if (!current || current.deletedAt) throw new Error('Este mes todavía no tiene un cierre.')
    if (current.status === 'open') return current
    const now = new Date().toISOString(); const updated: MonthlyClosure = { ...current, status: 'open', reopenedAt: now, reopenedBy: userId, updatedAt: now }
    await this.writeLocalChange('monthlyClosure', 'update', updated, current.version)
    return updated
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
    const transaction = database.transaction(['outbox', 'transactions', 'accounts', 'categories', 'recurringRules', 'budgets', 'plannedItems', 'monthlyPlans', 'goals', 'goalAllocations', 'monthlyClosures'], 'readwrite')
    for (const result of results) {
      const operation = await transaction.objectStore('outbox').get(result.operationId)
      if (!operation) continue
      if (!result.ok) {
        if (result.error?.code === 'month_closed' && result.error.permanent) {
          const entityType = result.entityType ?? operation.entityType ?? 'transaction'
          const record = result.record ? normalizeEntity(entityType, result.record) : undefined
          if (entityType === 'transaction') { if (record) await transaction.objectStore('transactions').put(record as Transaction); else await transaction.objectStore('transactions').delete(operation.recordId) }
          else if (entityType === 'budget') { if (record) await transaction.objectStore('budgets').put(record as Budget); else await transaction.objectStore('budgets').delete(operation.recordId) }
          else if (entityType === 'plannedItem') { if (record) await transaction.objectStore('plannedItems').put(record as PlannedItem); else await transaction.objectStore('plannedItems').delete(operation.recordId) }
          else if (entityType === 'monthlyPlan') { if (record) await transaction.objectStore('monthlyPlans').put(record as MonthlyPlan); else await transaction.objectStore('monthlyPlans').delete(operation.recordId) }
          await transaction.objectStore('outbox').delete(result.operationId)
          continue
        }
        if (operation.entityType === 'goalAllocation' && operation.kind === 'create' && result.error?.permanent) {
          await transaction.objectStore('goalAllocations').delete(operation.recordId)
          await transaction.objectStore('outbox').delete(result.operationId)
          continue
        }
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
        else if (entityType === 'monthlyPlan') await transaction.objectStore('monthlyPlans').put(normalizeMonthlyPlan(result.record as MonthlyPlan))
        else if (entityType === 'goal') await transaction.objectStore('goals').put(result.record as Goal)
        else if (entityType === 'goalAllocation') await transaction.objectStore('goalAllocations').put(normalizeGoalAllocation(result.record as GoalAllocation))
        else await transaction.objectStore('monthlyClosures').put(normalizeMonthlyClosure(result.record as MonthlyClosure))
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
      else if (entityType === 'monthlyPlan') await transaction.objectStore('monthlyPlans').put(normalizeMonthlyPlan(payload as MonthlyPlan))
      else if (entityType === 'goal') await transaction.objectStore('goals').put(payload as Goal)
      else if (entityType === 'goalAllocation') await transaction.objectStore('goalAllocations').put(normalizeGoalAllocation(payload as GoalAllocation))
      else await transaction.objectStore('monthlyClosures').put(normalizeMonthlyClosure(payload as MonthlyClosure))
    }
    await transaction.done
  }

  async mergeServerChanges(changes: SyncChange[]): Promise<void> {
    const database = await getDatabase()
    const transaction = database.transaction(['transactions', 'accounts', 'categories', 'recurringRules', 'budgets', 'plannedItems', 'monthlyPlans', 'goals', 'goalAllocations', 'monthlyClosures', 'outbox'], 'readwrite')
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
      } else if (change.entityType === 'monthlyPlan') {
        const record = remote as MonthlyPlan; const local = await transaction.objectStore('monthlyPlans').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('monthlyPlans').put(record)
      } else if (change.entityType === 'goal') {
        const record = remote as Goal; const local = await transaction.objectStore('goals').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('goals').put(record)
      } else if (change.entityType === 'goalAllocation') {
        const record = remote as GoalAllocation; const local = await transaction.objectStore('goalAllocations').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('goalAllocations').put(record)
      } else {
        const record = remote as MonthlyClosure; const local = await transaction.objectStore('monthlyClosures').get(record.id)
        if (!local || record.version >= local.version) await transaction.objectStore('monthlyClosures').put(record)
      }
    }
    await transaction.done
  }

  async hasLocalData(): Promise<boolean> {
    const database = await getDatabase()
    for (const store of ENTITY_STORES) { if ((await database.count(store)) > 0) return true }
    return false
  }

  async importBackup(payload: BackupPayload, userId: UserId): Promise<{ imported: number }> {
    if (await this.hasLocalData()) throw new Error('Ya hay datos en este dispositivo; la restauración solo está disponible en una casa recién inicializada.')
    const database = await getDatabase()
    const transaction = database.transaction([...ENTITY_STORES, 'outbox', 'meta'], 'readwrite')
    let imported = 0
    const created = <T extends SyncableRecord>(record: T): T => ({ ...record, version: 0, changeSequence: 0, deletedAt: null, createdBy: userId })

    const archivedAccounts = new Map<string, string>()
    for (const account of payload.accounts) {
      if (account.archivedAt) archivedAccounts.set(account.id, account.archivedAt)
      await queueLocalChange(transaction, 'account', 'create', created({ ...account, archivedAt: null }), 0); imported += 1
    }
    const archivedCategories = new Map<string, string>()
    for (const category of payload.categories) {
      if (category.archivedAt) archivedCategories.set(category.id, category.archivedAt)
      await queueLocalChange(transaction, 'category', 'create', created({ ...category, archivedAt: null }), 0); imported += 1
    }

    const goalState = new Map<string, { completedAt: string | null; archivedAt: string | null }>()
    for (const goal of payload.goals) {
      if (goal.completedAt || goal.archivedAt) goalState.set(goal.id, { completedAt: goal.completedAt, archivedAt: goal.archivedAt })
      await queueLocalChange(transaction, 'goal', 'create', created({ ...goal, completedAt: null, archivedAt: null }), 0); imported += 1
    }
    for (const rule of payload.recurringRules) { await queueLocalChange(transaction, 'recurringRule', 'create', created(rule), 0); imported += 1 }

    for (const item of payload.plannedItems) { await queueLocalChange(transaction, 'plannedItem', 'create', created(item), 0); imported += 1 }
    for (const item of payload.transactions) { await queueLocalChange(transaction, 'transaction', 'create', created(normalizeTransaction(item)), 0); imported += 1 }
    for (const item of payload.budgets) { await queueLocalChange(transaction, 'budget', 'create', created(normalizeBudget(item)), 0); imported += 1 }
    for (const item of payload.monthlyPlans) { await queueLocalChange(transaction, 'monthlyPlan', 'create', created(normalizeMonthlyPlan(item)), 0); imported += 1 }

    for (const item of payload.goalAllocations) { await queueLocalChange(transaction, 'goalAllocation', 'create', created(normalizeGoalAllocation(item)), 0); imported += 1 }

    for (const [id, archivedAt] of archivedAccounts) {
      const current = await transaction.objectStore('accounts').get(id)
      if (current) await queueLocalChange(transaction, 'account', 'update', { ...current, archivedAt, updatedAt: new Date().toISOString() }, current.version)
    }
    for (const [id, archivedAt] of archivedCategories) {
      const current = await transaction.objectStore('categories').get(id)
      if (current) await queueLocalChange(transaction, 'category', 'update', { ...current, archivedAt, updatedAt: new Date().toISOString() }, current.version)
    }
    for (const [id, state] of goalState) {
      const current = await transaction.objectStore('goals').get(id)
      if (current) await queueLocalChange(transaction, 'goal', 'update', { ...current, ...state, updatedAt: new Date().toISOString() }, current.version)
    }

    for (const closure of payload.monthlyClosures) {
      const record = created(normalizeMonthlyClosure({ ...closure, revision: 1, closedBy: userId, reopenedAt: null, reopenedBy: null }))
      await queueLocalChange(transaction, 'monthlyClosure', 'create', record, 0); imported += 1
    }

    await transaction.done
    return { imported }
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

  private async setGoalArchived(id: string, archived: boolean): Promise<void> {
    const database = await getDatabase(); const current = await database.get('goals', id)
    if (!current || current.deletedAt || Boolean(current.archivedAt) === archived) return
    const now = new Date().toISOString()
    await this.writeLocalChange('goal', 'update', { ...current, archivedAt: archived ? now : null, updatedAt: now }, current.version)
  }

  private async assertMonthOpen(month: string): Promise<void> {
    const closures = await (await getDatabase()).getAll('monthlyClosures')
    if (closures.some((item) => !item.deletedAt && item.month === month && item.status === 'closed')) {
      throw new Error('Este mes está cerrado. Reábrelo desde Plan antes de modificarlo.')
    }
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
    } else if (entityType === 'monthlyPlan') {
      const transaction = database.transaction(['monthlyPlans', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as MonthlyPlan, baseVersion)
      await transaction.done
    } else if (entityType === 'goal') {
      const transaction = database.transaction(['goals', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as Goal, baseVersion)
      await transaction.done
    } else if (entityType === 'goalAllocation') {
      const transaction = database.transaction(['goalAllocations', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, payload as GoalAllocation, baseVersion)
      await transaction.done
    } else {
      const transaction = database.transaction(['monthlyClosures', 'outbox', 'meta'], 'readwrite')
      await queueLocalChange(transaction, entityType, kind, normalizeMonthlyClosure(payload as MonthlyClosure), baseVersion)
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

function transactionRepairedFields(original: Transaction, normalized: Transaction): boolean {
  return original.date !== normalized.date || original.note !== normalized.note
    || original.accountId !== normalized.accountId || original.categoryId !== normalized.categoryId
    || original.sourceAccountId !== normalized.sourceAccountId || original.destinationAccountId !== normalized.destinationAccountId
    || original.recurringRuleId !== normalized.recurringRuleId || original.recurringOccurrenceDate !== normalized.recurringOccurrenceDate
    || original.plannedItemId !== normalized.plannedItemId
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
      : entityType === 'monthlyPlan' ? normalizeMonthlyPlan(entity as MonthlyPlan)
        : entityType === 'goalAllocation' ? normalizeGoalAllocation(entity as GoalAllocation)
          : entityType === 'monthlyClosure' ? normalizeMonthlyClosure(entity as MonthlyClosure) : entity
}

function normalizeBudget(budget: Budget): Budget { return { ...budget, month: normalizeMonthValue(budget.month) } }
function normalizeMonthlyPlan(plan: MonthlyPlan): MonthlyPlan { return { ...plan, month: normalizeMonthValue(plan.month) } }
function normalizeGoalAllocation(allocation: GoalAllocation): GoalAllocation {
  return { ...allocation, date: normalizeDateOnly(allocation.date) ?? allocation.date }
}
function normalizeMonthlyClosure(closure: MonthlyClosure): MonthlyClosure { return { ...closure, month: normalizeMonthValue(closure.month) } }
function normalizeGoalInput(input: GoalInput): GoalInput {
  return { ...input, name: input.name.trim(), icon: input.icon.trim(), note: input.note.trim(),
    targetDate: input.targetDate ? normalizeDateOnly(input.targetDate) ?? input.targetDate : null }
}
function normalizeMonthValue(value: string): string {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value
  return normalizeDateOnly(value)?.slice(0, 7) ?? value
}

function storeName(entityType: EntityType): 'transactions' | 'accounts' | 'categories' | 'recurringRules' | 'budgets' | 'plannedItems' | 'monthlyPlans' | 'goals' | 'goalAllocations' | 'monthlyClosures' {
  return entityType === 'transaction' ? 'transactions' : entityType === 'account' ? 'accounts'
    : entityType === 'category' ? 'categories' : entityType === 'recurringRule' ? 'recurringRules'
      : entityType === 'budget' ? 'budgets' : entityType === 'plannedItem' ? 'plannedItems'
        : entityType === 'monthlyPlan' ? 'monthlyPlans' : entityType === 'goal' ? 'goals' : entityType === 'goalAllocation' ? 'goalAllocations' : 'monthlyClosures'
}

async function queueLocalChange(transaction: {
  objectStore(name: 'meta'): { get(key: string): Promise<{ value: unknown } | undefined>; put(value: { key: string; value: unknown }): Promise<unknown> }
  objectStore(name: 'outbox'): { put(value: SyncOperation): Promise<unknown> }
  objectStore(name: 'transactions' | 'accounts' | 'categories' | 'recurringRules' | 'budgets' | 'plannedItems' | 'monthlyPlans' | 'goals' | 'goalAllocations' | 'monthlyClosures'): { put(value: never): Promise<unknown> }
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

function validateGoalInput(input: GoalInput): void {
  if (!input.name.trim() || input.name.length > 80) throw new Error('El nombre del objetivo no es válido.')
  assertMoneyCents(input.targetAmountCents)
  if (input.targetAmountCents <= 0) throw new Error('El importe objetivo debe ser mayor que cero.')
  if (!input.icon.trim() || input.icon.length > 12) throw new Error('El icono del objetivo no es válido.')
  if (typeof input.note !== 'string' || input.note.length > 500) throw new Error('La nota no es válida.')
  if (input.targetDate && !normalizeDateOnly(input.targetDate)) throw new Error('La fecha objetivo no es válida.')
}

function validateGoalAllocationInput(input: GoalAllocationInput): void {
  assertMoneyCents(input.amountCents)
  if (input.amountCents === 0) throw new Error('La aportación debe ser distinta de cero.')
  if (!normalizeDateOnly(input.date)) throw new Error('La fecha de la aportación no es válida.')
  if (typeof input.note !== 'string' || input.note.length > 500) throw new Error('La nota no es válida.')
}

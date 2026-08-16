import { beforeEach, describe, expect, it } from 'vitest'
import { BACKUP_SCHEMA_VERSION, type BackupPayload } from '../domain/backup'
import type { UserId } from '../domain/types'
import { clearDatabaseForTests, getDatabase } from './database'
import { LocalFinanceRepository } from './localFinanceRepository'

describe('LocalFinanceRepository', () => {
  beforeEach(clearDatabaseForTests)

  it('persists an offline movement and queues a UUID operation', async () => {
    const first = new LocalFinanceRepository()
    const created = await first.createTransaction({ ...input('expense', 1234), note: 'Guardado sin conexión' }, 'david')
    const reopened = new LocalFinanceRepository()
    expect(await reopened.listTransactions()).toEqual([created])
    expect(created.note).toBe('Guardado sin conexión')
    const operations = await reopened.pendingOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]).toMatchObject({ kind: 'create', recordId: created.id, baseVersion: 0 })
    expect(operations[0].operationId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('uses a tombstone for deletion and keeps the operation queued', async () => {
    const repository = new LocalFinanceRepository()
    const created = await repository.createTransaction(input('income', 10000), 'esther')
    await repository.deleteTransaction(created.id)
    expect(await repository.listTransactions()).toEqual([])
    expect((await repository.pendingOperations()).map((operation) => operation.kind)).toEqual(['create', 'delete'])
  })

  it('removes successful operations and exposes permanent failures', async () => {
    const repository = new LocalFinanceRepository()
    await repository.createTransaction(input('expense', 100), 'david')
    const [operation] = await repository.pendingOperations()
    await repository.applyOperationResults([{ operationId: operation.operationId, ok: false, error: { code: 'invalid', message: 'No válido', permanent: true } }])
    expect(await repository.pendingOperations()).toEqual([])
    expect(await repository.failedOperations()).toHaveLength(1)
  })

  it('recovers a previously rejected deletion for the next sync', async () => {
    const repository = new LocalFinanceRepository()
    const remote = { id: crypto.randomUUID(), createdAt: '2026-08-14T10:00:00.000Z', updatedAt: '2026-08-14T10:00:00.000Z', deletedAt: null,
      createdBy: 'david' as const, version: 1, changeSequence: 1, kind: 'expense' as const, amountCents: 1234, concept: 'Movimiento antiguo', note: '',
      date: '2026-08-14', accountId: null, categoryId: null, sourceAccountId: null, destinationAccountId: null }
    await repository.mergeServerChanges([{ entityType: 'transaction', record: remote }])
    await repository.deleteTransaction(remote.id)
    const [deletion] = await repository.pendingOperations()
    await repository.applyOperationResults([{ operationId: deletion.operationId, ok: false,
      error: { code: 'invalid_account', message: 'Cuenta obligatoria.', permanent: true } }])
    expect(await repository.pendingOperations()).toEqual([])
    expect(await repository.recoverFailedDeletions()).toBe(1)
    expect(await repository.pendingOperations()).toEqual([expect.objectContaining({ kind: 'delete', permanentFailure: false, lastError: null })])
  })

  it('repairs a Google Sheets date representation stored locally', async () => {
    const repository = new LocalFinanceRepository()
    const remote = {
      id: crypto.randomUUID(), createdAt: '2026-08-14T10:00:00.000Z', updatedAt: '2026-08-14T10:00:00.000Z', deletedAt: null,
      createdBy: 'david' as const, version: 1, changeSequence: 1, kind: 'expense' as const, amountCents: 1234,
      concept: 'Compra', note: '', date: 'Fri Aug 14 2026 00:00:00 GMT+0200 (Central European Summer Time)', accountId: 'account-1', categoryId: 'category-1', sourceAccountId: null, destinationAccountId: null,
    }
    await repository.mergeServerChanges([{ entityType: 'transaction', record: remote }])
    expect((await repository.listTransactions())[0].date).toBe('2026-08-14')
    expect((await repository.listTransactions())[0].date).toBe('2026-08-14')
  })

  it('archives and restores accounts and categories without deleting them', async () => {
    const repository = new LocalFinanceRepository()
    const account = await repository.createAccount({ name: 'Principal', type: 'checking', initialBalanceCents: 5000, includeInNetWorth: true, includeInLiquidity: true }, 'david')
    const category = await repository.createCategory({ name: 'Comida', kind: 'expense', icon: '●' }, 'david')
    await repository.archiveAccount(account.id); await repository.archiveCategory(category.id)
    expect((await repository.listAccounts())[0].archivedAt).toBeTruthy()
    expect((await repository.listCategories())[0].archivedAt).toBeTruthy()
    await repository.restoreAccount(account.id); await repository.restoreCategory(category.id)
    expect((await repository.listAccounts())[0].archivedAt).toBeNull()
    expect((await repository.listCategories())[0].archivedAt).toBeNull()
    expect((await repository.pendingOperations()).map((item) => item.entityType)).toEqual(['account', 'category', 'account', 'category', 'account', 'category'])
  })

  it('stores a recurring movement atomically and materializes each occurrence once', async () => {
    const repository = new LocalFinanceRepository()
    const transaction = await repository.createTransactionWithRecurrence(input('expense', 6500), {
      kind: 'expense', amountCents: 6500, concept: 'Internet', note: '', accountId: 'account-1', categoryId: 'category-1',
      frequency: 'monthly', startDate: '2026-09-14', endDate: null,
    }, 'david')
    const [rule] = await repository.listRecurringRules()
    expect(transaction.recurringRuleId).toBe(rule.id)
    expect((await repository.pendingOperations()).map((item) => item.entityType)).toEqual(['recurringRule', 'transaction'])
    const edited = await repository.updateTransaction(transaction.id, { ...input('expense', 7000), concept: 'Internet actualizado' })
    expect(edited).toMatchObject({ recurringRuleId: rule.id, recurringOccurrenceDate: '2026-08-14' })
    const first = await repository.materializeRecurringOccurrence(rule.id, '2026-09-14', 'david')
    const repeated = await repository.materializeRecurringOccurrence(rule.id, '2026-09-14', 'esther')
    expect(repeated.id).toBe(first.id)
    expect(await repository.listTransactions()).toHaveLength(2)
    expect(await repository.pendingOperations()).toHaveLength(4)
  })

  it('upserts deterministic monthly budgets and distribution offline', async () => {
    const repository = new LocalFinanceRepository()
    const firstBudget = await repository.setBudget('2026-08', 'food', 20_000, 'david')
    const updatedBudget = await repository.setBudget('2026-08', 'food', 25_000, 'esther')
    const firstPlan = await repository.setMonthlyPlan('2026-08', 5_000, 3_000, 'david')
    const updatedPlan = await repository.setMonthlyPlan('2026-08', 6_000, 4_000, 'esther')

    expect(updatedBudget).toMatchObject({ id: firstBudget.id, amountCents: 25_000 })
    expect(updatedPlan).toMatchObject({ id: firstPlan.id, savingsAllocationCents: 6_000, investmentAllocationCents: 4_000 })
    expect(await repository.listBudgets()).toHaveLength(1)
    expect(await repository.listMonthlyPlans()).toHaveLength(1)
    expect((await repository.pendingOperations()).map((item) => item.kind)).toEqual(['create', 'update', 'create', 'update'])
  })

  it('does not let an older pull erase a budget that is still pending', async () => {
    const repository = new LocalFinanceRepository()
    const remote = await repository.setBudget('2026-08', 'food', 10_000, 'david')
    const [create] = await repository.pendingOperations()
    await repository.applyOperationResults([{ operationId: create.operationId, ok: true, entityType: 'budget',
      record: { ...remote, version: 1, changeSequence: 1 } }])
    await repository.setBudget('2026-08', 'food', 25_000, 'david')
    const [update] = await repository.pendingOperations()
    await repository.applyOperationResults([{ operationId: update.operationId, ok: false,
      error: { code: 'transport_retry', message: 'Reintentar', permanent: false } }])
    await repository.setBudget('2026-08', 'food', 30_000, 'david')
    const newest = (await repository.pendingOperations()).at(-1)!
    await repository.applyOperationResults([{ operationId: newest.operationId, ok: false,
      error: { code: 'transport_retry', message: 'Reintentar', permanent: false } }])
    await repository.mergeServerChanges([{ entityType: 'budget', record: { ...remote, amountCents: 10_000, version: 1, changeSequence: 1 } }])

    expect((await repository.listBudgets())[0].amountCents).toBe(30_000)
    expect(await repository.pendingOperations()).toHaveLength(2)
  })

  it('repairs months coerced to dates in stored budgets and their rejected outbox operations', async () => {
    const repository = new LocalFinanceRepository(); const database = await getDatabase()
    const malformedMonth = 'Sat Aug 01 2026 00:00:00 GMT+0200 (Central European Summer Time)'
    const budget = { id: 'budget-hidden', createdAt: '2026-08-15T10:00:00.000Z', updatedAt: '2026-08-15T10:00:00.000Z',
      deletedAt: null, createdBy: 'david' as const, version: 1, changeSequence: 2, month: malformedMonth, categoryId: 'food', amountCents: 100_000 }
    await database.put('budgets', budget)
    await database.put('outbox', { operationId: 'repair-budget-operation', localSequence: 1, entityType: 'budget', kind: 'update',
      recordId: budget.id, payload: budget, baseVersion: 1, attempts: 1, lastError: 'Mes inválido', permanentFailure: true })

    expect((await repository.listBudgets())[0].month).toBe('2026-08')
    expect((await repository.pendingOperations())[0]).toMatchObject({ permanentFailure: false, lastError: null,
      payload: { month: '2026-08', amountCents: 100_000 } })
  })

  it('persists manual planned items and materializes them idempotently', async () => {
    const repository = new LocalFinanceRepository()
    const item = await repository.createPlannedItem({ kind: 'expense', amountCents: 4_250, concept: 'Seguro puntual', note: '',
      date: '2026-08-20', accountId: 'account-1', categoryId: 'category-1' }, 'david')
    const reopened = new LocalFinanceRepository()
    expect((await reopened.listPlannedItems())[0]).toEqual(item)
    const first = await reopened.materializePlannedItem(item.id, 'esther')
    const repeated = await reopened.materializePlannedItem(item.id, 'david')
    expect(repeated.id).toBe(first.id)
    expect(first).toMatchObject({ plannedItemId: item.id, amountCents: 4_250 })
    expect(await reopened.listTransactions()).toHaveLength(1)
  })

  it('stores one deterministic omission per recurring occurrence and can reactivate it', async () => {
    const repository = new LocalFinanceRepository()
    const rule = await repository.createRecurringRule({ kind: 'expense', amountCents: 1_200, concept: 'Suscripción', note: '',
      accountId: 'account-1', categoryId: 'category-1', frequency: 'monthly', startDate: '2026-08-15', endDate: null }, 'david')
    const omitted = await repository.setRecurringOccurrenceStatus(rule.id, '2026-08-15', 'omitted', 'david')
    const active = await repository.setRecurringOccurrenceStatus(rule.id, '2026-08-15', 'pending', 'esther')
    expect(active).toMatchObject({ id: omitted.id, status: 'pending', source: 'recurring' })
    expect(await repository.listPlannedItems()).toHaveLength(1)
  })

  it('creates a goal and its optional initial allocation atomically offline', async () => {
    const repository = new LocalFinanceRepository()
    const created = await repository.createGoal({ name: 'Viaje', targetAmountCents: 100_000, targetDate: '2027-06-01', icon: '✈️', note: '' }, 20_000, 'david')
    expect((await new LocalFinanceRepository().listGoals())[0]).toEqual(created)
    expect((await repository.listGoalAllocations())[0]).toMatchObject({ goalId: created.id, amountCents: 20_000, note: 'Importe inicial' })
    expect((await repository.pendingOperations()).map((item) => item.entityType)).toEqual(['goal', 'goalAllocation'])
  })

  it('supports contributions and withdrawals but never permits a negative assignment', async () => {
    const repository = new LocalFinanceRepository()
    const created = await repository.createGoal({ name: 'Reforma', targetAmountCents: 200_000, targetDate: null, icon: '🏠', note: '' }, 0, 'esther')
    await repository.createGoalAllocation(created.id, { amountCents: 50_000, date: '2026-08-15', note: 'Aportación' }, 'esther')
    await repository.createGoalAllocation(created.id, { amountCents: -20_000, date: '2026-08-15', note: 'Retirada' }, 'david')
    expect((await repository.listGoalAllocations()).reduce((sum, item) => sum + item.amountCents, 0)).toBe(30_000)
    await expect(repository.createGoalAllocation(created.id, { amountCents: -30_001, date: '2026-08-15', note: '' }, 'david'))
      .rejects.toThrow('más dinero del asignado')
  })

  it('blocks allocations while completed or archived and allows them after reopening or restoring', async () => {
    const repository = new LocalFinanceRepository()
    const created = await repository.createGoal({ name: 'Reserva', targetAmountCents: 50_000, targetDate: null, icon: '🎯', note: '' }, 0, 'david')
    const input = { amountCents: 1_000, date: '2026-08-15', note: '' }
    await repository.setGoalCompleted(created.id, true)
    await expect(repository.createGoalAllocation(created.id, input, 'david')).rejects.toThrow('Reabre')
    await repository.setGoalCompleted(created.id, false); await repository.createGoalAllocation(created.id, input, 'david')
    await repository.archiveGoal(created.id)
    await expect(repository.createGoalAllocation(created.id, input, 'david')).rejects.toThrow('no está activo')
    await repository.restoreGoal(created.id); await repository.createGoalAllocation(created.id, input, 'david')
    expect(await repository.listGoalAllocations()).toHaveLength(2)
  })

  it('rolls back a permanently rejected optimistic allocation so both clients can converge', async () => {
    const repository = new LocalFinanceRepository()
    const created = await repository.createGoal({ name: 'Viaje', targetAmountCents: 100_000, targetDate: null, icon: '✈️', note: '' }, 30_000, 'david')
    const initialOperations = await repository.pendingOperations()
    await repository.applyOperationResults(initialOperations.map((operation, index) => ({ operationId: operation.operationId, ok: true,
      entityType: operation.entityType, record: { ...operation.payload, version: 1, changeSequence: index + 1 } })))
    const withdrawal = await repository.createGoalAllocation(created.id, { amountCents: -20_000, date: '2026-08-15', note: '' }, 'david')
    const [operation] = await repository.pendingOperations()
    await repository.applyOperationResults([{ operationId: operation.operationId, ok: false,
      error: { code: 'insufficient_goal_allocation', message: 'No puedes retirar más dinero del asignado.', permanent: true } }])
    expect((await repository.listGoalAllocations()).some((item) => item.id === withdrawal.id)).toBe(false)
    expect(await repository.pendingOperations()).toEqual([])
    expect(await repository.failedOperations()).toEqual([])
  })

  it('closes, locks, reopens and closes a month again with a new snapshot revision', async () => {
    const repository = new LocalFinanceRepository()
    const first = await repository.closeMonth(closureInput(), 'david')
    expect(first).toMatchObject({ month: '2026-08', status: 'closed', revision: 1, closedBy: 'david' })
    await expect(repository.createTransaction(input('expense', 500), 'esther')).rejects.toThrow('mes está cerrado')
    await expect(repository.setBudget('2026-08', 'food', 10_000, 'esther')).rejects.toThrow('mes está cerrado')
    const reopened = await repository.reopenMonth('2026-08', 'esther')
    expect(reopened).toMatchObject({ status: 'open', revision: 1, reopenedBy: 'esther' })
    await repository.createTransaction(input('expense', 500), 'esther')
    const second = await repository.closeMonth({ ...closureInput(), transactionCount: 1, actualExpenseCents: 500, realSurplusCents: 9_500 }, 'esther')
    expect(second).toMatchObject({ status: 'closed', revision: 2, transactionCount: 1, closedBy: 'esther' })
    expect(await repository.listMonthlyClosures()).toHaveLength(1)
  })

  it('rolls back a mutation rejected because another device closed the month', async () => {
    const repository = new LocalFinanceRepository()
    const created = await repository.createTransaction(input('expense', 100), 'david')
    const [operation] = await repository.pendingOperations()
    await repository.applyOperationResults([{ operationId: operation.operationId, ok: false, entityType: 'transaction',
      error: { code: 'month_closed', message: 'El mes está cerrado.', permanent: true } }])
    expect((await repository.listTransactions()).some((item) => item.id === created.id)).toBe(false)
    expect(await repository.pendingOperations()).toEqual([])
  })

  it('reports whether the device already has local data', async () => {
    const repository = new LocalFinanceRepository()
    expect(await repository.hasLocalData()).toBe(false)
    await repository.createCategory({ name: 'Casa', kind: 'expense', icon: '🏠' }, 'david')
    expect(await repository.hasLocalData()).toBe(true)
  })

  it('rejects restoring a backup when the device already has local data', async () => {
    const repository = new LocalFinanceRepository()
    await repository.createAccount({ name: 'Cuenta', type: 'checking', initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true }, 'david')
    const payload = await payloadFrom(repository, 'david')
    await expect(repository.importBackup(payload, 'david')).rejects.toThrow('recién inicializada')
  })

  it('restores an archived account/category, a completed goal and a reclosed month, reattributing authorship to the restoring user', async () => {
    const repository = new LocalFinanceRepository()
    const account = await repository.createAccount({ name: 'Antigua', type: 'checking', initialBalanceCents: 1000, includeInNetWorth: true, includeInLiquidity: true }, 'esther')
    const category = await repository.createCategory({ name: 'Ocio', kind: 'expense', icon: '🎉' }, 'esther')
    await repository.createTransaction({ kind: 'expense', amountCents: 500, concept: 'Cena', note: '', date: '2026-08-01',
      accountId: account.id, categoryId: category.id, sourceAccountId: null, destinationAccountId: null }, 'esther')
    await repository.archiveAccount(account.id)
    await repository.archiveCategory(category.id)
    const goal = await repository.createGoal({ name: 'Viaje', targetAmountCents: 10_000, targetDate: null, icon: '✈️', note: '' }, 10_000, 'esther')
    await repository.setGoalCompleted(goal.id, true)
    await repository.closeMonth(closureInput(), 'esther')
    await repository.reopenMonth('2026-08', 'esther')
    await repository.closeMonth(closureInput(), 'esther')

    const payload = await payloadFrom(repository, 'esther')
    expect(payload.monthlyClosures[0]).toMatchObject({ revision: 2 })

    await clearDatabaseForTests()
    const restored = new LocalFinanceRepository()
    const result = await restored.importBackup(payload, 'david')
    expect(result.imported).toBeGreaterThan(0)

    const [accounts, categories, goals, closures, transactions, allocations] = await Promise.all([
      restored.listAccounts(), restored.listCategories(), restored.listGoals(), restored.listMonthlyClosures(),
      restored.listTransactions(), restored.listGoalAllocations(),
    ])
    expect(accounts[0]).toMatchObject({ archivedAt: expect.any(String), createdBy: 'david' })
    expect(categories[0]).toMatchObject({ archivedAt: expect.any(String), createdBy: 'david' })
    expect(goals[0]).toMatchObject({ completedAt: expect.any(String), createdBy: 'david' })
    expect(closures[0]).toMatchObject({ revision: 1, closedBy: 'david', reopenedAt: null, reopenedBy: null })
    expect(transactions).toMatchObject([{ concept: 'Cena', createdBy: 'david' }])
    expect(allocations).toHaveLength(1)

    const order = (await restored.pendingOperations()).map((operation) => operation.entityType)
    expect(order.indexOf('account')).toBeLessThan(order.indexOf('transaction'))
    expect(order.indexOf('category')).toBeLessThan(order.indexOf('transaction'))
    expect(order.indexOf('goal')).toBeLessThan(order.indexOf('goalAllocation'))
    expect(order[order.length - 1]).toBe('monthlyClosure')
  })
})

async function payloadFrom(repository: LocalFinanceRepository, userId: UserId): Promise<BackupPayload> {
  const [accounts, categories, transactions, recurringRules, budgets, plannedItems, monthlyPlans, goals, goalAllocations, monthlyClosures] = await Promise.all([
    repository.listAccounts(), repository.listCategories(), repository.listTransactions(), repository.listRecurringRules(),
    repository.listBudgets(), repository.listPlannedItems(), repository.listMonthlyPlans(), repository.listGoals(),
    repository.listGoalAllocations(), repository.listMonthlyClosures(),
  ])
  return { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: new Date().toISOString(), exportedBy: userId,
    accounts, categories, transactions, recurringRules, budgets, plannedItems, monthlyPlans, goals, goalAllocations, monthlyClosures }
}

function input(kind: 'income' | 'expense', amountCents: number) {
  return { kind, amountCents, concept: kind === 'income' ? 'Ingreso' : 'Compra', note: '', date: '2026-08-14', accountId: 'account-1', categoryId: 'category-1', sourceAccountId: null, destinationAccountId: null }
}

function closureInput() {
  return { month: '2026-08', transactionCount: 0, pendingIncomeCount: 1, pendingExpenseCount: 2, actualIncomeCents: 10_000,
    actualExpenseCents: 0, realSurplusCents: 10_000, projectedSurplusCents: 4_000, netWorthCents: 50_000,
    liquidityCents: 40_000, savingsCents: 10_000, investmentCents: 5_000, goalReservedCents: 3_000 }
}

import { beforeEach, describe, expect, it } from 'vitest'
import { clearDatabaseForTests } from './database'
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
})

function input(kind: 'income' | 'expense', amountCents: number) {
  return { kind, amountCents, concept: kind === 'income' ? 'Ingreso' : 'Compra', note: '', date: '2026-08-14', accountId: 'account-1', categoryId: 'category-1', sourceAccountId: null, destinationAccountId: null }
}

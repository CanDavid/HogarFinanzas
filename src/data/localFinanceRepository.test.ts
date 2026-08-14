import { beforeEach, describe, expect, it } from 'vitest'
import { clearDatabaseForTests } from './database'
import { LocalFinanceRepository } from './localFinanceRepository'

describe('LocalFinanceRepository', () => {
  beforeEach(clearDatabaseForTests)

  it('persists an offline movement and queues a UUID operation', async () => {
    const first = new LocalFinanceRepository()
    const created = await first.createTransaction({ kind: 'expense', amountCents: 1234, concept: 'Compra', date: '2026-08-14' }, 'david')
    const reopened = new LocalFinanceRepository()
    expect(await reopened.listTransactions()).toEqual([created])
    const operations = await reopened.pendingOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]).toMatchObject({ kind: 'create', recordId: created.id, baseVersion: 0 })
    expect(operations[0].operationId).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('uses a tombstone for deletion and keeps the operation queued', async () => {
    const repository = new LocalFinanceRepository()
    const created = await repository.createTransaction({ kind: 'income', amountCents: 10000, concept: 'Ingreso', date: '2026-08-14' }, 'esther')
    await repository.deleteTransaction(created.id)
    expect(await repository.listTransactions()).toEqual([])
    expect((await repository.pendingOperations()).map((operation) => operation.kind)).toEqual(['create', 'delete'])
  })

  it('removes successful operations and exposes permanent failures', async () => {
    const repository = new LocalFinanceRepository()
    await repository.createTransaction({ kind: 'expense', amountCents: 100, concept: 'Café', date: '2026-08-14' }, 'david')
    const [operation] = await repository.pendingOperations()
    await repository.applyOperationResults([{ operationId: operation.operationId, ok: false, error: { code: 'invalid', message: 'No válido', permanent: true } }])
    expect(await repository.pendingOperations()).toEqual([])
    expect(await repository.failedOperations()).toHaveLength(1)
  })

  it('repairs a Google Sheets date representation stored locally', async () => {
    const repository = new LocalFinanceRepository()
    const remote = {
      id: crypto.randomUUID(), createdAt: '2026-08-14T10:00:00.000Z', updatedAt: '2026-08-14T10:00:00.000Z', deletedAt: null,
      createdBy: 'david' as const, version: 1, changeSequence: 1, kind: 'expense' as const, amountCents: 1234,
      concept: 'Compra', date: 'Fri Aug 14 2026 00:00:00 GMT+0200 (Central European Summer Time)',
    }
    await repository.mergeServerChanges([remote])
    expect((await repository.listTransactions())[0].date).toBe('2026-08-14')
    expect((await repository.listTransactions())[0].date).toBe('2026-08-14')
  })
})

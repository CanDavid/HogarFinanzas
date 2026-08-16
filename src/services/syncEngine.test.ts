import { describe, expect, it, vi } from 'vitest'
import type { Session, SyncChange, SyncOperation, SyncRepository } from '../domain/types'
import { SyncEngine } from './syncEngine'

class RepositoryStub implements SyncRepository {
  session: Session | null = { token: 'token', userId: 'david', expiresAt: '2099-01-01T00:00:00.000Z' }
  cursor = 3
  operations: SyncOperation[] = []
  applied = false
  merged: SyncChange[] = []
  transportError = ''
  recoveredDeletions = false
  listTransactions = async () => []
  listAccounts = async () => []
  listCategories = async () => []
  listRecurringRules = async () => []
  listBudgets = async () => []
  listPlannedItems = async () => []
  listMonthlyPlans = async () => []
  listGoals = async () => []
  listGoalAllocations = async () => []
  listMonthlyClosures = async () => []
  createTransaction = async () => { throw new Error('unused') }
  updateTransaction = async () => { throw new Error('unused') }
  deleteTransaction = async () => undefined
  createAccount = async () => { throw new Error('unused') }
  updateAccount = async () => { throw new Error('unused') }
  archiveAccount = async () => undefined
  restoreAccount = async () => undefined
  createCategory = async () => { throw new Error('unused') }
  updateCategory = async () => { throw new Error('unused') }
  archiveCategory = async () => undefined
  restoreCategory = async () => undefined
  createRecurringRule = async () => { throw new Error('unused') }
  updateRecurringRule = async () => { throw new Error('unused') }
  setRecurringRuleActive = async () => undefined
  createTransactionWithRecurrence = async () => { throw new Error('unused') }
  materializeRecurringOccurrence = async () => { throw new Error('unused') }
  setBudget = async () => { throw new Error('unused') }
  createPlannedItem = async () => { throw new Error('unused') }
  updatePlannedItem = async () => { throw new Error('unused') }
  deletePlannedItem = async () => undefined
  setPlannedItemStatus = async () => undefined
  setRecurringOccurrenceStatus = async () => { throw new Error('unused') }
  materializePlannedItem = async () => { throw new Error('unused') }
  setMonthlyPlan = async () => { throw new Error('unused') }
  createGoal = async () => { throw new Error('unused') }
  updateGoal = async () => { throw new Error('unused') }
  setGoalCompleted = async () => undefined
  archiveGoal = async () => undefined
  restoreGoal = async () => undefined
  createGoalAllocation = async () => { throw new Error('unused') }
  closeMonth = async () => { throw new Error('unused') }
  reopenMonth = async () => { throw new Error('unused') }
  pendingOperations = async () => this.operations
  failedOperations = async () => []
  recoverFailedDeletions = async () => { this.recoveredDeletions = true; return 0 }
  markTransportFailure = async (message: string) => { this.transportError = message }
  applyOperationResults = async () => { this.applied = true }
  mergeServerChanges = async (changes: SyncChange[]) => { this.merged = changes }
  getCursor = async () => this.cursor
  setCursor = async (cursor: number) => { this.cursor = cursor }
  getSession = async () => this.session
  setSession = async (session: Session | null) => { this.session = session }
  getServerUrl = async () => 'https://script.google.com/macros/s/example/exec'
  setServerUrl = async () => undefined
  hasLocalData = async () => false
  importBackup = async () => ({ imported: 0 })
}

describe('SyncEngine', () => {
  it('pushes queued changes and advances the incremental cursor', async () => {
    const repository = new RepositoryStub()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { results: [], changes: [], cursor: 9 } }) }))
    await expect(new SyncEngine(repository).run()).resolves.toEqual({ pushed: 0, pulled: 0, failed: 0 })
    expect(repository.recoveredDeletions).toBe(true)
    expect(repository.applied).toBe(true)
    expect(repository.cursor).toBe(9)
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'POST', redirect: 'follow' }))
    vi.unstubAllGlobals()
  })

  it('clears an expired session without making a request', async () => {
    const repository = new RepositoryStub()
    repository.session = { token: 'old', userId: 'david', expiresAt: '2000-01-01T00:00:00.000Z' }
    await expect(new SyncEngine(repository).run()).rejects.toThrow('caducado')
    expect(repository.session).toBeNull()
  })

  it('keeps queued work and records a transport attempt after network failure', async () => {
    const repository = new RepositoryStub()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Sin red')))
    await expect(new SyncEngine(repository).run()).rejects.toThrow('Sin red')
    expect(repository.transportError).toBe('Sin red')
    vi.unstubAllGlobals()
  })

  it('splits more than 100 pending operations into sequential batches of at most 100', async () => {
    const repository = new RepositoryStub()
    repository.operations = Array.from({ length: 250 }, (_, index) => ({
      operationId: `op-${index}`, localSequence: index, entityType: 'transaction', kind: 'create',
      recordId: `record-${index}`, payload: {} as never, baseVersion: 0, attempts: 0, lastError: null, permanentFailure: false,
    }))
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { operations: unknown[]; cursor: number }
      expect(body.operations.length).toBeLessThanOrEqual(100)
      return { ok: true, json: async () => ({ ok: true, data: { results: [], changes: [], cursor: body.cursor + 1 } }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(new SyncEngine(repository).run()).resolves.toEqual({ pushed: 0, pulled: 0, failed: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(repository.cursor).toBe(6)
    vi.unstubAllGlobals()
  })
})

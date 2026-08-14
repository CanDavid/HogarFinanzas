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
  listTransactions = async () => []
  listAccounts = async () => []
  listCategories = async () => []
  createTransaction = async () => { throw new Error('unused') }
  updateTransaction = async () => { throw new Error('unused') }
  deleteTransaction = async () => undefined
  createAccount = async () => { throw new Error('unused') }
  updateAccount = async () => { throw new Error('unused') }
  archiveAccount = async () => undefined
  createCategory = async () => { throw new Error('unused') }
  updateCategory = async () => { throw new Error('unused') }
  archiveCategory = async () => undefined
  pendingOperations = async () => this.operations
  failedOperations = async () => []
  markTransportFailure = async (message: string) => { this.transportError = message }
  applyOperationResults = async () => { this.applied = true }
  mergeServerChanges = async (changes: SyncChange[]) => { this.merged = changes }
  getCursor = async () => this.cursor
  setCursor = async (cursor: number) => { this.cursor = cursor }
  getSession = async () => this.session
  setSession = async (session: Session | null) => { this.session = session }
  getServerUrl = async () => 'https://script.google.com/macros/s/example/exec'
  setServerUrl = async () => undefined
}

describe('SyncEngine', () => {
  it('pushes queued changes and advances the incremental cursor', async () => {
    const repository = new RepositoryStub()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { results: [], changes: [], cursor: 9 } }) }))
    await expect(new SyncEngine(repository).run()).resolves.toEqual({ pushed: 0, pulled: 0, failed: 0 })
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
})

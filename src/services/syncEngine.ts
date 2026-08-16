import type { SyncRepository } from '../domain/types'
import { AppsScriptClient } from './appsScriptClient'

export interface SyncResult { pushed: number; pulled: number; failed: number }

const MAX_BATCH_SIZE = 100

export class SyncEngine {
  constructor(private readonly repository: SyncRepository) {}

  async run(): Promise<SyncResult> {
    await this.repository.recoverFailedDeletions()
    const [session, serverUrl, operations, initialCursor] = await Promise.all([
      this.repository.getSession(),
      this.repository.getServerUrl(),
      this.repository.pendingOperations(),
      this.repository.getCursor(),
    ])
    if (!session) throw new Error('Inicia sesión para sincronizar.')
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.repository.setSession(null)
      throw new Error('La sesión ha caducado. Vuelve a identificarte.')
    }
    const client = new AppsScriptClient(serverUrl)
    const batches = chunk(operations, MAX_BATCH_SIZE)
    const result: SyncResult = { pushed: 0, pulled: 0, failed: 0 }
    let cursor = initialCursor
    for (const batch of batches) {
      let response
      try {
        response = await client.sync({ action: 'sync', token: session.token, cursor, operations: batch })
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Error de transporte'
        await this.repository.markTransportFailure(message)
        throw cause
      }
      await this.repository.applyOperationResults(response.results)
      await this.repository.mergeServerChanges(response.changes)
      await this.repository.setCursor(response.cursor)
      cursor = response.cursor
      result.pushed += response.results.filter((item) => item.ok).length
      result.pulled += response.changes.length
      result.failed += response.results.filter((item) => !item.ok).length
    }
    return result
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]]
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size))
  return batches
}

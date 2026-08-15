import type { SyncRepository } from '../domain/types'
import { AppsScriptClient } from './appsScriptClient'

export interface SyncResult { pushed: number; pulled: number; failed: number }

export class SyncEngine {
  constructor(private readonly repository: SyncRepository) {}

  async run(): Promise<SyncResult> {
    await this.repository.recoverFailedDeletions()
    const [session, serverUrl, operations, cursor] = await Promise.all([
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
    let response
    try {
      response = await new AppsScriptClient(serverUrl).sync({
        action: 'sync', token: session.token, cursor, operations,
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Error de transporte'
      await this.repository.markTransportFailure(message)
      throw cause
    }
    await this.repository.applyOperationResults(response.results)
    await this.repository.mergeServerChanges(response.changes)
    await this.repository.setCursor(response.cursor)
    return {
      pushed: response.results.filter((result) => result.ok).length,
      pulled: response.changes.length,
      failed: response.results.filter((result) => !result.ok).length,
    }
  }
}

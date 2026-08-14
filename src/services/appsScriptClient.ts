import type { ApiEnvelope, LoginResponse, SyncRequest, SyncResponse, UserId } from '../domain/types'

export class AppsScriptClient {
  constructor(private readonly serverUrl: string) {}

  login(userId: UserId, householdKey: string): Promise<LoginResponse> {
    return this.post<LoginResponse>({ action: 'login', userId, householdKey })
  }

  sync(request: SyncRequest): Promise<SyncResponse> {
    return this.post<SyncResponse>(request)
  }

  private async post<T>(payload: unknown): Promise<T> {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(this.serverUrl)) {
      throw new Error('Configura una URL válida del Web App de Google Apps Script.')
    }
    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    })
    if (!response.ok) throw new Error(`El servidor respondió con HTTP ${response.status}.`)
    const envelope = await response.json() as ApiEnvelope<T>
    if (!envelope.ok || envelope.data === undefined) {
      throw new Error(envelope.error?.message ?? 'El servidor devolvió una respuesta inválida.')
    }
    return envelope.data
  }
}

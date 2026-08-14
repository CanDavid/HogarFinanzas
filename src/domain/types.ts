export type UserId = 'david' | 'esther'
export type TransactionKind = 'income' | 'expense' | 'transfer'
export type OperationKind = 'create' | 'update' | 'delete'

export interface SyncableRecord {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdBy: UserId
  version: number
  changeSequence: number
}

export interface Transaction extends SyncableRecord {
  kind: TransactionKind
  amountCents: number
  concept: string
  date: string
}

export interface SyncOperation {
  operationId: string
  localSequence: number
  kind: OperationKind
  recordId: string
  payload: Transaction
  baseVersion: number
  attempts: number
  lastError: string | null
  permanentFailure: boolean
}

export interface OperationResult {
  operationId: string
  ok: boolean
  record?: Transaction
  error?: { code: string; message: string; permanent: boolean }
}

export interface SyncRequest {
  action: 'sync'
  token: string
  cursor: number
  operations: SyncOperation[]
}

export interface SyncResponse {
  results: OperationResult[]
  changes: Transaction[]
  cursor: number
}

export interface Session {
  token: string
  userId: UserId
  expiresAt: string
}

export type LoginResponse = Session

export interface ApiEnvelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

export interface TransactionInput {
  kind: Exclude<TransactionKind, 'transfer'>
  amountCents: number
  concept: string
  date: string
}

export interface SyncRepository {
  listTransactions(): Promise<Transaction[]>
  createTransaction(input: TransactionInput, userId: UserId): Promise<Transaction>
  updateTransaction(id: string, input: TransactionInput): Promise<Transaction>
  deleteTransaction(id: string): Promise<void>
  pendingOperations(): Promise<SyncOperation[]>
  failedOperations(): Promise<SyncOperation[]>
  markTransportFailure(message: string): Promise<void>
  applyOperationResults(results: OperationResult[]): Promise<void>
  mergeServerChanges(changes: Transaction[]): Promise<void>
  getCursor(): Promise<number>
  setCursor(cursor: number): Promise<void>
  getSession(): Promise<Session | null>
  setSession(session: Session | null): Promise<void>
  getServerUrl(): Promise<string>
  setServerUrl(url: string): Promise<void>
}

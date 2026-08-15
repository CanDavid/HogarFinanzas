export type UserId = 'david' | 'esther'
export type TransactionKind = 'income' | 'expense' | 'transfer' | 'adjustment'
export type AccountType = 'checking' | 'savings' | 'investment' | 'cash'
export type CategoryKind = 'income' | 'expense'
export type OperationKind = 'create' | 'update' | 'delete'
export type EntityType = 'transaction' | 'account' | 'category' | 'recurringRule'
export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'annual'

export interface SyncableRecord {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdBy: UserId
  version: number
  changeSequence: number
}

export interface Account extends SyncableRecord {
  name: string
  type: AccountType
  initialBalanceCents: number
  includeInNetWorth: boolean
  includeInLiquidity: boolean
  archivedAt: string | null
}

export interface Category extends SyncableRecord {
  name: string
  kind: CategoryKind
  icon: string
  archivedAt: string | null
}

export interface Transaction extends SyncableRecord {
  kind: TransactionKind
  amountCents: number
  concept: string
  note: string
  date: string
  accountId: string | null
  categoryId: string | null
  sourceAccountId: string | null
  destinationAccountId: string | null
  recurringRuleId?: string | null
  recurringOccurrenceDate?: string | null
}

export interface RecurringRule extends SyncableRecord {
  kind: 'income' | 'expense'
  amountCents: number
  concept: string
  note: string
  accountId: string
  categoryId: string
  frequency: RecurrenceFrequency
  startDate: string
  endDate: string | null
  active: boolean
}

export type SyncEntity = Transaction | Account | Category | RecurringRule

export interface SyncOperation {
  operationId: string
  localSequence: number
  entityType: EntityType
  kind: OperationKind
  recordId: string
  payload: SyncEntity
  baseVersion: number
  attempts: number
  lastError: string | null
  permanentFailure: boolean
}

export interface SyncChange { entityType: EntityType; record: SyncEntity }

export interface OperationResult {
  operationId: string
  ok: boolean
  entityType?: EntityType
  record?: SyncEntity
  error?: { code: string; message: string; permanent: boolean }
}

export interface SyncRequest { action: 'sync'; token: string; cursor: number; operations: SyncOperation[] }
export interface SyncResponse { results: OperationResult[]; changes: SyncChange[]; cursor: number }
export interface Session { token: string; userId: UserId; expiresAt: string }
export type LoginResponse = Session
export interface ApiEnvelope<T> { ok: boolean; data?: T; error?: { code: string; message: string } }

export interface TransactionInput {
  kind: TransactionKind
  amountCents: number
  concept: string
  note: string
  date: string
  accountId: string | null
  categoryId: string | null
  sourceAccountId: string | null
  destinationAccountId: string | null
  recurringRuleId?: string | null
  recurringOccurrenceDate?: string | null
}

export type AccountInput = Pick<Account, 'name' | 'type' | 'initialBalanceCents' | 'includeInNetWorth' | 'includeInLiquidity'>
export type CategoryInput = Pick<Category, 'name' | 'kind' | 'icon'>
export type RecurringRuleInput = Pick<RecurringRule, 'kind' | 'amountCents' | 'concept' | 'note' | 'accountId' | 'categoryId' | 'frequency' | 'startDate' | 'endDate'>

export interface SyncRepository {
  listTransactions(): Promise<Transaction[]>
  listAccounts(): Promise<Account[]>
  listCategories(): Promise<Category[]>
  listRecurringRules(): Promise<RecurringRule[]>
  createTransaction(input: TransactionInput, userId: UserId): Promise<Transaction>
  updateTransaction(id: string, input: TransactionInput): Promise<Transaction>
  deleteTransaction(id: string): Promise<void>
  createAccount(input: AccountInput, userId: UserId): Promise<Account>
  updateAccount(id: string, input: AccountInput): Promise<Account>
  archiveAccount(id: string): Promise<void>
  restoreAccount(id: string): Promise<void>
  createCategory(input: CategoryInput, userId: UserId): Promise<Category>
  updateCategory(id: string, input: CategoryInput): Promise<Category>
  archiveCategory(id: string): Promise<void>
  restoreCategory(id: string): Promise<void>
  createRecurringRule(input: RecurringRuleInput, userId: UserId): Promise<RecurringRule>
  updateRecurringRule(id: string, input: RecurringRuleInput): Promise<RecurringRule>
  setRecurringRuleActive(id: string, active: boolean): Promise<void>
  createTransactionWithRecurrence(input: TransactionInput, recurrence: RecurringRuleInput, userId: UserId): Promise<Transaction>
  materializeRecurringOccurrence(ruleId: string, date: string, userId: UserId): Promise<Transaction>
  pendingOperations(): Promise<SyncOperation[]>
  failedOperations(): Promise<SyncOperation[]>
  recoverFailedDeletions(): Promise<number>
  markTransportFailure(message: string): Promise<void>
  applyOperationResults(results: OperationResult[]): Promise<void>
  mergeServerChanges(changes: SyncChange[]): Promise<void>
  getCursor(): Promise<number>
  setCursor(cursor: number): Promise<void>
  getSession(): Promise<Session | null>
  setSession(session: Session | null): Promise<void>
  getServerUrl(): Promise<string>
  setServerUrl(url: string): Promise<void>
}

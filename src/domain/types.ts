import type { BackupPayload } from './backup'

export type UserId = 'david' | 'esther'
export type TransactionKind = 'income' | 'expense' | 'transfer' | 'adjustment'
export type AccountType = 'checking' | 'savings' | 'investment' | 'cash'
export type CategoryKind = 'income' | 'expense'
export type OperationKind = 'create' | 'update' | 'delete'
export type EntityType = 'transaction' | 'account' | 'category' | 'recurringRule' | 'budget' | 'plannedItem' | 'monthlyPlan' | 'goal' | 'goalAllocation' | 'monthlyClosure'
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
  plannedItemId?: string | null
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

export interface Budget extends SyncableRecord {
  month: string
  categoryId: string
  amountCents: number
}

export interface PlannedItem extends SyncableRecord {
  source: 'manual' | 'recurring'
  recurringRuleId: string | null
  kind: 'income' | 'expense'
  amountCents: number
  concept: string
  note: string
  date: string
  accountId: string
  categoryId: string
  status: 'pending' | 'omitted'
}

export interface MonthlyPlan extends SyncableRecord {
  month: string
  savingsAllocationCents: number
  investmentAllocationCents: number
}

export interface Goal extends SyncableRecord {
  name: string
  targetAmountCents: number
  targetDate: string | null
  icon: string
  note: string
  completedAt: string | null
  archivedAt: string | null
}

export interface GoalAllocation extends SyncableRecord {
  goalId: string
  amountCents: number
  date: string
  note: string
}

export interface MonthlyClosure extends SyncableRecord {
  month: string
  status: 'closed' | 'open'
  revision: number
  closedAt: string
  closedBy: UserId
  reopenedAt: string | null
  reopenedBy: UserId | null
  transactionCount: number
  pendingIncomeCount: number
  pendingExpenseCount: number
  actualIncomeCents: number
  actualExpenseCents: number
  realSurplusCents: number
  projectedSurplusCents: number
  netWorthCents: number
  liquidityCents: number
  savingsCents: number
  investmentCents: number
  goalReservedCents: number
}

export type SyncEntity = Transaction | Account | Category | RecurringRule | Budget | PlannedItem | MonthlyPlan | Goal | GoalAllocation | MonthlyClosure

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
  plannedItemId?: string | null
}

export type AccountInput = Pick<Account, 'name' | 'type' | 'initialBalanceCents' | 'includeInNetWorth' | 'includeInLiquidity'>
export type CategoryInput = Pick<Category, 'name' | 'kind' | 'icon'>
export type RecurringRuleInput = Pick<RecurringRule, 'kind' | 'amountCents' | 'concept' | 'note' | 'accountId' | 'categoryId' | 'frequency' | 'startDate' | 'endDate'>
export type PlannedItemInput = Pick<PlannedItem, 'kind' | 'amountCents' | 'concept' | 'note' | 'date' | 'accountId' | 'categoryId'>
export type GoalInput = Pick<Goal, 'name' | 'targetAmountCents' | 'targetDate' | 'icon' | 'note'>
export type GoalAllocationInput = Pick<GoalAllocation, 'amountCents' | 'date' | 'note'>
export type MonthlyClosureInput = Pick<MonthlyClosure, 'month' | 'transactionCount' | 'pendingIncomeCount' | 'pendingExpenseCount' |
  'actualIncomeCents' | 'actualExpenseCents' | 'realSurplusCents' | 'projectedSurplusCents' | 'netWorthCents' |
  'liquidityCents' | 'savingsCents' | 'investmentCents' | 'goalReservedCents'>

export interface SyncRepository {
  listTransactions(): Promise<Transaction[]>
  listAccounts(): Promise<Account[]>
  listCategories(): Promise<Category[]>
  listRecurringRules(): Promise<RecurringRule[]>
  listBudgets(): Promise<Budget[]>
  listPlannedItems(): Promise<PlannedItem[]>
  listMonthlyPlans(): Promise<MonthlyPlan[]>
  listGoals(): Promise<Goal[]>
  listGoalAllocations(): Promise<GoalAllocation[]>
  listMonthlyClosures(): Promise<MonthlyClosure[]>
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
  setBudget(month: string, categoryId: string, amountCents: number, userId: UserId): Promise<Budget>
  createPlannedItem(input: PlannedItemInput, userId: UserId): Promise<PlannedItem>
  updatePlannedItem(id: string, input: PlannedItemInput): Promise<PlannedItem>
  deletePlannedItem(id: string): Promise<void>
  setPlannedItemStatus(id: string, status: PlannedItem['status']): Promise<void>
  setRecurringOccurrenceStatus(ruleId: string, date: string, status: PlannedItem['status'], userId: UserId): Promise<PlannedItem>
  materializePlannedItem(id: string, userId: UserId): Promise<Transaction>
  convertTransactionToPlannedItem(transactionId: string, userId: UserId): Promise<PlannedItem>
  setMonthlyPlan(month: string, savingsAllocationCents: number, investmentAllocationCents: number, userId: UserId): Promise<MonthlyPlan>
  createGoal(input: GoalInput, initialAmountCents: number, userId: UserId): Promise<Goal>
  updateGoal(id: string, input: GoalInput): Promise<Goal>
  setGoalCompleted(id: string, completed: boolean): Promise<void>
  archiveGoal(id: string): Promise<void>
  restoreGoal(id: string): Promise<void>
  createGoalAllocation(goalId: string, input: GoalAllocationInput, userId: UserId): Promise<GoalAllocation>
  closeMonth(input: MonthlyClosureInput, userId: UserId): Promise<MonthlyClosure>
  reopenMonth(month: string, userId: UserId): Promise<MonthlyClosure>
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
  hasLocalData(): Promise<boolean>
  importBackup(payload: BackupPayload, userId: UserId): Promise<{ imported: number }>
}

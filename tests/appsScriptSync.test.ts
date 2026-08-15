// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

class FakeRange {
  constructor(private sheet: FakeSheet, private row: number, private column: number, private rows: number, private columns: number) {}
  getValues() {
    return Array.from({ length: this.rows }, (_, rowIndex) =>
      Array.from({ length: this.columns }, (_, columnIndex) => this.sheet.rows[this.row - 1 + rowIndex]?.[this.column - 1 + columnIndex] ?? ''),
    )
  }
  setValues(values: unknown[][]) {
    values.forEach((valuesRow, rowIndex) => {
      const target = this.row - 1 + rowIndex
      this.sheet.rows[target] ??= []
      valuesRow.forEach((value, columnIndex) => { this.sheet.rows[target][this.column - 1 + columnIndex] = value })
    })
    return this
  }
}

class FakeSheet {
  rows: unknown[][]
  constructor(private name: string, headers: string[]) { this.rows = headers.length ? [headers] : [] }
  getName() { return this.name }
  getLastRow() { return this.rows.length }
  getRange(row: number, column: number, rows = 1, columns = 1) { return new FakeRange(this, row, column, rows, columns) }
  appendRow(values: unknown[]) { this.rows.push([...values]) }
  setFrozenRows() { return undefined }
}

class FakeSpreadsheet {
  sheets = new Map<string, FakeSheet>()
  constructor() {
    this.add('Meta', ['key', 'value'])
    this.add('Accounts', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence', 'name', 'type', 'initialBalanceCents', 'includeInNetWorth', 'includeInLiquidity', 'archivedAt'])
    this.add('Categories', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence', 'name', 'kind', 'icon', 'archivedAt'])
    this.add('Transactions', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence', 'kind', 'amountCents', 'concept', 'date'])
    this.add('RecurringRules', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'])
    this.add('Budgets', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'])
    this.add('PlannedItems', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'])
    this.add('MonthlyPlans', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'])
    this.add('Goals', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'])
    this.add('GoalAllocations', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'])
    this.add('MonthlyClosures', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence'])
    this.add('SyncOperations', ['operationId', 'processedAt', 'resultJson', 'entityType'])
  }
  add(name: string, headers: string[]) { this.sheets.set(name, new FakeSheet(name, headers)) }
  getSheetByName(name: string) { return this.sheets.get(name) }
  insertSheet(name: string) { const sheet = new FakeSheet(name, []); this.sheets.set(name, sheet); return sheet }
}

interface ScriptContext {
  applyOperation_(spreadsheet: FakeSpreadsheet, operation: unknown, userId: string): { ok: boolean; record: Record<string, unknown> }
  pullChanges_(cursor: number, spreadsheet: FakeSpreadsheet): { changes: Record<string, unknown>[]; cursor: number }
  migratePhase6(): { schemaVersion: number; goalColumns: number; goalAllocationColumns: number }
  migratePhase7(): { schemaVersion: number; monthlyClosureColumns: number }
}

function loadScript(activeSpreadsheet?: FakeSpreadsheet): ScriptContext {
  const context: Record<string, unknown> = {
    Date, JSON, Math, Number, String, Error,
    SpreadsheetApp: { getActiveSpreadsheet: () => activeSpreadsheet },
    Session: { getScriptTimeZone: () => 'Europe/Madrid' },
    Utilities: {
      getUuid: () => '22222222-2222-4222-8222-222222222222',
      formatDate(value: Date, _timeZone?: string, format = 'yyyy-MM-dd') {
        const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
          .formatToParts(value).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {})
        return format === 'yyyy-MM' ? `${parts.year}-${parts.month}` : `${parts.year}-${parts.month}-${parts.day}`
      },
    },
  }
  runInNewContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), context)
  return context as unknown as ScriptContext
}

function payload(concept = 'Compra') {
  return {
    id: '11111111-1111-4111-8111-111111111111', createdAt: '2026-08-14T10:00:00.000Z', updatedAt: '2026-08-14T10:00:00.000Z',
    deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0, kind: 'expense', amountCents: 1234, concept, date: '2026-08-14', note: 'Detalle compartido',
  }
}

function operation(operationId: string, kind: string, concept = 'Compra') {
  return { operationId, localSequence: 1, kind, recordId: payload().id, payload: payload(concept), baseVersion: 0, attempts: 0, lastError: null, permanentFailure: false }
}

describe('Apps Script sync core with Sheets adapter', () => {
  it('migrates the Sheets schema to phase 6 without removing rows', () => {
    const spreadsheet = new FakeSpreadsheet()
    spreadsheet.getSheetByName('Transactions')?.rows.push(Object.values(payload()))
    const result = loadScript(spreadsheet).migratePhase6()
    expect(result).toEqual({ schemaVersion: 6, goalColumns: 14, goalAllocationColumns: 11 })
    expect(spreadsheet.getSheetByName('Transactions')?.rows[0]).toContain('note')
    expect(spreadsheet.getSheetByName('Transactions')?.rows[0]).toContain('recurringRuleId')
    expect(spreadsheet.getSheetByName('RecurringRules')?.rows[0]).toContain('frequency')
    expect(spreadsheet.getSheetByName('Transactions')?.rows[0]).toContain('plannedItemId')
    expect(spreadsheet.getSheetByName('PlannedItems')?.rows[0]).toContain('status')
    expect(spreadsheet.getSheetByName('Goals')?.rows[0]).toContain('targetAmountCents')
    expect(spreadsheet.getSheetByName('GoalAllocations')?.rows[0]).toContain('goalId')
    expect(spreadsheet.getSheetByName('Transactions')?.rows).toHaveLength(2)
  })

  it('migrates the monthly closure sheet to phase 7 without removing existing rows', () => {
    const spreadsheet = new FakeSpreadsheet(); const result = loadScript(spreadsheet).migratePhase7()
    expect(result).toEqual({ schemaVersion: 7, monthlyClosureColumns: 26 })
    expect(spreadsheet.getSheetByName('MonthlyClosures')?.rows[0]).toEqual(expect.arrayContaining(['month', 'status', 'netWorthCents', 'goalReservedCents']))
  })

  it('replays the saved result without duplicating a retried create', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet(); const create = operation('op-create', 'create')
    const first = script.applyOperation_(spreadsheet, create, 'david')
    const repeated = script.applyOperation_(spreadsheet, { ...create, payload: { ...payload(), concept: '' } }, 'david')
    expect(repeated).toEqual(first)
    expect(spreadsheet.getSheetByName('Transactions')?.rows).toHaveLength(2)
    expect(spreadsheet.getSheetByName('SyncOperations')?.rows).toHaveLength(2)
  })

  it('deletes a legacy movement using the canonical server record', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet()
    script.applyOperation_(spreadsheet, operation('op-create-legacy', 'create'), 'david')
    const normalizedByClient = { ...payload('Contenido local obsoleto'), accountId: null, categoryId: null, sourceAccountId: null, destinationAccountId: null }
    const deleted = script.applyOperation_(spreadsheet, { operationId: 'op-delete-legacy', entityType: 'transaction', kind: 'delete',
      recordId: normalizedByClient.id, payload: normalizedByClient }, 'esther')
    expect(deleted.record.deletedAt).toBeTruthy()
    expect(deleted.record.concept).toBe('Compra')
    expect(script.pullChanges_(1, spreadsheet).changes[0].record.deletedAt).toBeTruthy()
  })

  it('returns only changes after the incremental cursor', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet()
    script.applyOperation_(spreadsheet, operation('op-create', 'create'), 'david')
    const first = script.pullChanges_(0, spreadsheet)
    expect(first.changes).toHaveLength(1)
    expect(first.cursor).toBe(1)
    expect(script.pullChanges_(first.cursor, spreadsheet).changes).toEqual([])
  })

  it('round-trips the optional note through Sheets', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet()
    const result = script.applyOperation_(spreadsheet, operation('op-note', 'create'), 'david')
    expect(result.record.note).toBe('Detalle compartido')
    expect(script.pullChanges_(0, spreadsheet).changes[0].record.note).toBe('Detalle compartido')
  })

  it('normalizes dates coerced by Google Sheets before returning them', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet()
    script.applyOperation_(spreadsheet, operation('op-create', 'create'), 'david')
    const transactionSheet = spreadsheet.getSheetByName('Transactions')
    if (!transactionSheet) throw new Error('Missing Transactions sheet')
    transactionSheet.rows[1][10] = new Date('2026-08-13T22:00:00.000Z')
    expect(script.pullChanges_(0, spreadsheet).changes[0].record.date).toBe('2026-08-14')
  })

  it('deterministically keeps the last accepted concurrent edit', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet()
    script.applyOperation_(spreadsheet, operation('op-create', 'create'), 'david')
    script.applyOperation_(spreadsheet, operation('op-david', 'update', 'Cambio David'), 'david')
    const last = script.applyOperation_(spreadsheet, operation('op-esther', 'update', 'Cambio Esther'), 'esther')
    expect(last.record.concept).toBe('Cambio Esther')
    expect(last.record.version).toBe(3)
  })

  it('rejects stale updates after a tombstone', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet()
    script.applyOperation_(spreadsheet, operation('op-create', 'create'), 'david')
    script.applyOperation_(spreadsheet, operation('op-delete', 'delete'), 'esther')
    expect(() => script.applyOperation_(spreadsheet, operation('op-stale', 'update', 'Resucitado'), 'david')).toThrow('no puede restaurarse')
    expect(script.pullChanges_(0, spreadsheet).changes[0].record.deletedAt).toBeTruthy()
  })

  it('synchronizes accounts and categories as typed entities', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet(); const now = '2026-08-14T10:00:00.000Z'
    const account = { id: 'account-1', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
      name: 'Principal', type: 'checking', initialBalanceCents: 10000, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }
    const category = { id: 'category-1', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
      name: 'Comida', kind: 'expense', icon: '●', archivedAt: null }
    script.applyOperation_(spreadsheet, { operationId: 'account-op', entityType: 'account', kind: 'create', recordId: account.id, payload: account }, 'david')
    script.applyOperation_(spreadsheet, { operationId: 'category-op', entityType: 'category', kind: 'create', recordId: category.id, payload: category }, 'david')
    const changes = script.pullChanges_(0, spreadsheet).changes
    expect(changes.map((item) => item.entityType)).toEqual(['account', 'category'])
  })

  it('accepts one transfer record only when both accounts exist', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet(); const now = '2026-08-14T10:00:00.000Z'
    for (const id of ['account-1', 'account-2']) {
      const account = { id, createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
        name: id, type: 'checking', initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }
      script.applyOperation_(spreadsheet, { operationId: `op-${id}`, entityType: 'account', kind: 'create', recordId: id, payload: account }, 'david')
    }
    const transfer = { ...payload('A ahorro'), kind: 'transfer', accountId: null, categoryId: null, sourceAccountId: 'account-1', destinationAccountId: 'account-2' }
    const result = script.applyOperation_(spreadsheet, { operationId: 'transfer-op', entityType: 'transaction', kind: 'create', recordId: transfer.id, payload: transfer }, 'david')
    expect(result.record.kind).toBe('transfer')
    expect(spreadsheet.getSheetByName('Transactions')?.rows).toHaveLength(2)
  })

  it('synchronizes a recurring rule and accepts one deterministic occurrence only once', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet(); const now = '2026-08-14T10:00:00.000Z'
    const account = { id: 'account-1', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
      name: 'Principal', type: 'checking', initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }
    const category = { id: 'category-1', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
      name: 'Casa', kind: 'expense', icon: '●', archivedAt: null }
    script.applyOperation_(spreadsheet, { operationId: 'account', entityType: 'account', kind: 'create', recordId: account.id, payload: account }, 'david')
    script.applyOperation_(spreadsheet, { operationId: 'category', entityType: 'category', kind: 'create', recordId: category.id, payload: category }, 'david')
    const rule = { id: 'rule-1', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
      kind: 'expense', amountCents: 6500, concept: 'Internet', note: '', accountId: account.id, categoryId: category.id,
      frequency: 'monthly', startDate: '2026-09-01', endDate: null, active: true }
    script.applyOperation_(spreadsheet, { operationId: 'rule', entityType: 'recurringRule', kind: 'create', recordId: rule.id, payload: rule }, 'david')
    const occurrence = { ...payload('Internet'), id: 'occurrence-1', accountId: account.id, categoryId: category.id,
      recurringRuleId: rule.id, recurringOccurrenceDate: '2026-09-01', date: '2026-09-01' }
    const first = script.applyOperation_(spreadsheet, { operationId: 'occurrence-a', entityType: 'transaction', kind: 'create', recordId: occurrence.id, payload: occurrence }, 'david')
    const second = script.applyOperation_(spreadsheet, { operationId: 'occurrence-b', entityType: 'transaction', kind: 'create', recordId: occurrence.id, payload: { ...occurrence, createdBy: 'esther' } }, 'esther')
    expect(second.record.id).toBe(first.record.id)
    expect(spreadsheet.getSheetByName('Transactions')?.rows).toHaveLength(2)
    expect(script.pullChanges_(0, spreadsheet).changes.map((item) => item.entityType)).toContain('recurringRule')
  })

  it('synchronizes phase 5 plan entities and converges deterministic concurrent creates', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet(); const now = '2026-08-14T10:00:00.000Z'
    const account = { id: 'account-1', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
      name: 'Principal', type: 'checking', initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }
    const category = { id: 'category-1', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
      name: 'Casa', kind: 'expense', icon: '●', archivedAt: null }
    script.applyOperation_(spreadsheet, { operationId: 'p5-account', entityType: 'account', kind: 'create', recordId: account.id, payload: account }, 'david')
    script.applyOperation_(spreadsheet, { operationId: 'p5-category', entityType: 'category', kind: 'create', recordId: category.id, payload: category }, 'david')
    const budget = { id: 'budget-deterministic', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0,
      changeSequence: 0, month: '2026-08', categoryId: category.id, amountCents: 20_000 }
    const first = script.applyOperation_(spreadsheet, { operationId: 'budget-david', entityType: 'budget', kind: 'create', recordId: budget.id, payload: budget }, 'david')
    const last = script.applyOperation_(spreadsheet, { operationId: 'budget-esther', entityType: 'budget', kind: 'create', recordId: budget.id,
      payload: { ...budget, createdBy: 'esther', amountCents: 25_000 } }, 'esther')
    const budgetSheet = spreadsheet.getSheetByName('Budgets')
    if (!budgetSheet) throw new Error('Missing Budgets sheet')
    budgetSheet.rows[1][7] = new Date('2026-07-31T22:00:00.000Z')
    const item = { id: 'planned-1', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
      source: 'manual', recurringRuleId: null, kind: 'expense', amountCents: 6_000, concept: 'Seguro', note: '', date: '2026-08-20',
      accountId: account.id, categoryId: category.id, status: 'pending' }
    script.applyOperation_(spreadsheet, { operationId: 'planned-create', entityType: 'plannedItem', kind: 'create', recordId: item.id, payload: item }, 'david')
    const plannedTransaction = { ...payload('Seguro'), id: 'planned-transaction-deterministic', accountId: account.id, categoryId: category.id,
      plannedItemId: item.id, recurringRuleId: null, recurringOccurrenceDate: null, date: item.date }
    const realized = script.applyOperation_(spreadsheet, { operationId: 'planned-realize-david', entityType: 'transaction', kind: 'create',
      recordId: plannedTransaction.id, payload: plannedTransaction }, 'david')
    const repeatedRealization = script.applyOperation_(spreadsheet, { operationId: 'planned-realize-esther', entityType: 'transaction', kind: 'create',
      recordId: plannedTransaction.id, payload: { ...plannedTransaction, createdBy: 'esther' } }, 'esther')
    const monthly = { id: 'monthly-deterministic', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0,
      changeSequence: 0, month: '2026-08', savingsAllocationCents: 5_000, investmentAllocationCents: 2_000 }
    script.applyOperation_(spreadsheet, { operationId: 'monthly-create', entityType: 'monthlyPlan', kind: 'create', recordId: monthly.id, payload: monthly }, 'david')

    expect(first.record.version).toBe(1)
    expect(last.record).toMatchObject({ version: 2, amountCents: 25_000, createdBy: 'david' })
    expect(repeatedRealization.record.id).toBe(realized.record.id)
    expect(spreadsheet.getSheetByName('Budgets')?.rows).toHaveLength(2)
    const changes = script.pullChanges_(0, spreadsheet).changes
    expect(changes.map((item) => item.entityType)).toEqual(expect.arrayContaining(['budget', 'plannedItem', 'monthlyPlan']))
    expect(changes.find((item) => item.entityType === 'budget')?.record.month).toBe('2026-08')
  })

  it('synchronizes phase 6 goals and rejects a withdrawal that would make the assignment negative', () => {
    const spreadsheet = new FakeSpreadsheet(); const script = loadScript(spreadsheet); script.migratePhase6()
    const now = '2026-08-15T10:00:00.000Z'
    const goal = { id: 'goal-1', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
      name: 'Viaje', targetAmountCents: 100_000, targetDate: '2027-06-01', icon: '✈️', note: '', completedAt: null, archivedAt: null }
    const saved = script.applyOperation_(spreadsheet, { operationId: 'goal-create', entityType: 'goal', kind: 'create', recordId: goal.id, payload: goal }, 'david')
    const allocation = { id: 'allocation-1', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'esther', version: 0, changeSequence: 0,
      goalId: goal.id, amountCents: 30_000, date: '2026-08-15', note: 'Primera aportación' }
    const first = script.applyOperation_(spreadsheet, { operationId: 'allocation-create', entityType: 'goalAllocation', kind: 'create',
      recordId: allocation.id, payload: allocation }, 'esther')
    const withdrawal = { ...allocation, id: 'allocation-2', createdBy: 'david', amountCents: -20_000, note: 'Retirada' }
    script.applyOperation_(spreadsheet, { operationId: 'allocation-withdraw', entityType: 'goalAllocation', kind: 'create',
      recordId: withdrawal.id, payload: withdrawal }, 'david')
    const excessive = { ...withdrawal, id: 'allocation-3', amountCents: -10_001 }
    expect(() => script.applyOperation_(spreadsheet, { operationId: 'allocation-too-large', entityType: 'goalAllocation', kind: 'create',
      recordId: excessive.id, payload: excessive }, 'david')).toThrow('más dinero del asignado')
    expect(saved.record).toMatchObject({ name: 'Viaje', version: 1 })
    expect(first.record).toMatchObject({ amountCents: 30_000, createdBy: 'esther' })
    expect(script.pullChanges_(0, spreadsheet).changes.map((item) => item.entityType)).toEqual(expect.arrayContaining(['goal', 'goalAllocation']))
    expect(spreadsheet.getSheetByName('GoalAllocations')?.rows).toHaveLength(3)
  })

  it('synchronizes a closure, blocks the month and permits edits after reopening', () => {
    const spreadsheet = new FakeSpreadsheet(); const script = loadScript(spreadsheet); script.migratePhase7()
    const now = '2026-08-16T10:00:00.000Z'
    script.applyOperation_(spreadsheet, operation('before-close', 'create'), 'david')
    const closure = { id: 'closure-2026-08', createdAt: now, updatedAt: now, deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0,
      month: '2026-08', status: 'closed', revision: 1, closedAt: now, closedBy: 'david', reopenedAt: null, reopenedBy: null,
      transactionCount: 0, pendingIncomeCount: 0, pendingExpenseCount: 0, actualIncomeCents: 0, actualExpenseCents: 0,
      realSurplusCents: 0, projectedSurplusCents: 0, netWorthCents: 50_000, liquidityCents: 40_000,
      savingsCents: 10_000, investmentCents: 5_000, goalReservedCents: 3_000 }
    const closed = script.applyOperation_(spreadsheet, { operationId: 'close', entityType: 'monthlyClosure', kind: 'create', recordId: closure.id, payload: closure }, 'david')
    expect(closed.record).toMatchObject({ status: 'closed', revision: 1 })
    expect(() => script.applyOperation_(spreadsheet, operation('closed-create', 'update', 'Cambio bloqueado'), 'david')).toThrow('mes está cerrado')
    expect(() => script.applyOperation_(spreadsheet, operation('closed-delete', 'delete'), 'david')).toThrow('mes está cerrado')
    const open = { ...closed.record, status: 'open', reopenedAt: now, reopenedBy: 'esther' }
    script.applyOperation_(spreadsheet, { operationId: 'reopen', entityType: 'monthlyClosure', kind: 'update', recordId: closure.id, payload: open }, 'esther')
    expect(script.applyOperation_(spreadsheet, operation('open-update', 'update', 'Cambio permitido'), 'david').record.concept).toBe('Cambio permitido')
    expect(script.pullChanges_(0, spreadsheet).changes.map((item) => item.entityType)).toContain('monthlyClosure')
  })
})

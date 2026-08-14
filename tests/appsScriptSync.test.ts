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
  constructor(private name: string, headers: string[]) { this.rows = [headers] }
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
    this.add('Transactions', ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy', 'version', 'changeSequence', 'kind', 'amountCents', 'concept', 'date'])
    this.add('SyncOperations', ['operationId', 'processedAt', 'resultJson'])
  }
  add(name: string, headers: string[]) { this.sheets.set(name, new FakeSheet(name, headers)) }
  getSheetByName(name: string) { return this.sheets.get(name) }
}

interface ScriptContext {
  applyOperation_(spreadsheet: FakeSpreadsheet, operation: unknown, userId: string): { ok: boolean; record: Record<string, unknown> }
  pullChanges_(cursor: number, spreadsheet: FakeSpreadsheet): { changes: Record<string, unknown>[]; cursor: number }
}

function loadScript(): ScriptContext {
  const context: Record<string, unknown> = {
    Date, JSON, Math, Number, String, Error,
    Session: { getScriptTimeZone: () => 'Europe/Madrid' },
    Utilities: {
      formatDate(value: Date) {
        const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
          .formatToParts(value).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {})
        return `${parts.year}-${parts.month}-${parts.day}`
      },
    },
  }
  runInNewContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), context)
  return context as unknown as ScriptContext
}

function payload(concept = 'Compra') {
  return {
    id: '11111111-1111-4111-8111-111111111111', createdAt: '2026-08-14T10:00:00.000Z', updatedAt: '2026-08-14T10:00:00.000Z',
    deletedAt: null, createdBy: 'david', version: 0, changeSequence: 0, kind: 'expense', amountCents: 1234, concept, date: '2026-08-14',
  }
}

function operation(operationId: string, kind: string, concept = 'Compra') {
  return { operationId, localSequence: 1, kind, recordId: payload().id, payload: payload(concept), baseVersion: 0, attempts: 0, lastError: null, permanentFailure: false }
}

describe('Apps Script sync core with Sheets adapter', () => {
  it('replays the saved result without duplicating a retried create', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet(); const create = operation('op-create', 'create')
    const first = script.applyOperation_(spreadsheet, create, 'david')
    const repeated = script.applyOperation_(spreadsheet, create, 'david')
    expect(repeated).toEqual(first)
    expect(spreadsheet.getSheetByName('Transactions')?.rows).toHaveLength(2)
    expect(spreadsheet.getSheetByName('SyncOperations')?.rows).toHaveLength(2)
  })

  it('returns only changes after the incremental cursor', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet()
    script.applyOperation_(spreadsheet, operation('op-create', 'create'), 'david')
    const first = script.pullChanges_(0, spreadsheet)
    expect(first.changes).toHaveLength(1)
    expect(first.cursor).toBe(1)
    expect(script.pullChanges_(first.cursor, spreadsheet).changes).toEqual([])
  })

  it('normalizes dates coerced by Google Sheets before returning them', () => {
    const script = loadScript(); const spreadsheet = new FakeSpreadsheet()
    script.applyOperation_(spreadsheet, operation('op-create', 'create'), 'david')
    const transactionSheet = spreadsheet.getSheetByName('Transactions')
    if (!transactionSheet) throw new Error('Missing Transactions sheet')
    transactionSheet.rows[1][10] = new Date('2026-08-13T22:00:00.000Z')
    expect(script.pullChanges_(0, spreadsheet).changes[0].date).toBe('2026-08-14')
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
    expect(script.pullChanges_(0, spreadsheet).changes[0].deletedAt).toBeTruthy()
  })
})

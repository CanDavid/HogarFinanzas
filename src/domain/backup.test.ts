import { describe, expect, it } from 'vitest'
import { BACKUP_SCHEMA_VERSION, buildBackupFilename, parseBackupPayload, serializeBackup, summarizeBackup, type BackupPayload } from './backup'
import type { Account, Transaction } from './types'

function emptyPayload(): BackupPayload {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: '2026-08-16T10:00:00.000Z', exportedBy: 'david',
    accounts: [], categories: [], transactions: [], recurringRules: [], budgets: [], plannedItems: [],
    monthlyPlans: [], goals: [], goalAllocations: [], monthlyClosures: [],
  }
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
    createdBy: 'david', version: 3, changeSequence: 10, name: 'Cuenta', type: 'checking', initialBalanceCents: 1000,
    includeInNetWorth: true, includeInLiquidity: true, archivedAt: null, ...overrides,
  }
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
    createdBy: 'esther', version: 1, changeSequence: 11, kind: 'expense', amountCents: 500, concept: 'Café', note: '',
    date: '2026-01-05', accountId: 'acc-1', categoryId: 'cat-1', sourceAccountId: null, destinationAccountId: null,
    recurringRuleId: null, recurringOccurrenceDate: null, plannedItemId: null, ...overrides,
  }
}

describe('backup payload', () => {
  it('round-trips through serialize and parse', () => {
    const payload = { ...emptyPayload(), accounts: [account()], transactions: [transaction()] }
    const parsed = parseBackupPayload(JSON.parse(serializeBackup(payload)))
    expect(parsed).toEqual(payload)
  })

  it('builds a filename from the export date', () => {
    expect(buildBackupFilename('2026-08-16T10:00:00.000Z')).toBe('hogar-finanzas-copia-2026-08-16.json')
  })

  it('summarizes the counts of every entity', () => {
    const payload = { ...emptyPayload(), accounts: [account(), account({ id: 'acc-2' })], transactions: [transaction()] }
    expect(summarizeBackup(payload)).toMatchObject({ accounts: 2, transactions: 1, categories: 0 })
  })

  it('rejects a payload with an incompatible schema version', () => {
    expect(() => parseBackupPayload({ ...emptyPayload(), schemaVersion: 99 })).toThrow('no es compatible')
  })

  it('rejects a payload that is not an object', () => {
    expect(() => parseBackupPayload('not json')).toThrow('formato reconocible')
    expect(() => parseBackupPayload(null)).toThrow('formato reconocible')
  })

  it('rejects a missing or malformed entity list', () => {
    const payload = emptyPayload() as unknown as Record<string, unknown>
    delete payload.accounts
    expect(() => parseBackupPayload(payload)).toThrow('lista válida de cuentas')
  })

  it('rejects a record with an unsafe money amount', () => {
    const payload = { ...emptyPayload(), transactions: [transaction({ amountCents: 1.5 })] }
    expect(() => parseBackupPayload(payload)).toThrow('importe no válido')
  })

  it('rejects a record with an invalid creator', () => {
    const payload = { ...emptyPayload(), accounts: [account({ createdBy: 'intruder' as never })] }
    expect(() => parseBackupPayload(payload)).toThrow('creador no válido')
  })
})

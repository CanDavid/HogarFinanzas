import { assertMoneyCents } from './money'
import type {
  Account, Budget, Category, Goal, GoalAllocation, MonthlyClosure, MonthlyPlan, PlannedItem, RecurringRule, Transaction, UserId,
} from './types'

export const BACKUP_SCHEMA_VERSION = 1

export interface BackupPayload {
  schemaVersion: number
  exportedAt: string
  exportedBy: UserId
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  recurringRules: RecurringRule[]
  budgets: Budget[]
  plannedItems: PlannedItem[]
  monthlyPlans: MonthlyPlan[]
  goals: Goal[]
  goalAllocations: GoalAllocation[]
  monthlyClosures: MonthlyClosure[]
}

export interface BackupSummary {
  accounts: number
  categories: number
  transactions: number
  recurringRules: number
  budgets: number
  plannedItems: number
  monthlyPlans: number
  goals: number
  goalAllocations: number
  monthlyClosures: number
}

const ENTITY_MONEY_FIELDS: Record<keyof BackupSummary, string[]> = {
  accounts: ['initialBalanceCents'],
  categories: [],
  transactions: ['amountCents'],
  recurringRules: ['amountCents'],
  budgets: ['amountCents'],
  plannedItems: ['amountCents'],
  monthlyPlans: ['savingsAllocationCents', 'investmentAllocationCents'],
  goals: ['targetAmountCents'],
  goalAllocations: ['amountCents'],
  monthlyClosures: ['actualIncomeCents', 'actualExpenseCents', 'realSurplusCents', 'projectedSurplusCents',
    'netWorthCents', 'liquidityCents', 'savingsCents', 'investmentCents', 'goalReservedCents'],
}

const ENTITY_LABELS: Record<keyof BackupSummary, string> = {
  accounts: 'cuentas', categories: 'categorías', transactions: 'movimientos', recurringRules: 'recurrentes',
  budgets: 'presupuestos', plannedItems: 'previstos', monthlyPlans: 'distribuciones mensuales', goals: 'objetivos',
  goalAllocations: 'aportaciones/retiradas de objetivos', monthlyClosures: 'cierres mensuales',
}

export function buildBackupFilename(exportedAt: string): string {
  return `hogar-finanzas-copia-${exportedAt.slice(0, 10)}.json`
}

export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2)
}

export function summarizeBackup(payload: BackupPayload): BackupSummary {
  return (Object.keys(ENTITY_LABELS) as (keyof BackupSummary)[])
    .reduce((summary, key) => ({ ...summary, [key]: payload[key].length }), {} as BackupSummary)
}

export function parseBackupPayload(raw: unknown): BackupPayload {
  if (!raw || typeof raw !== 'object') throw new Error('El archivo de copia no tiene un formato reconocible.')
  const value = raw as Record<string, unknown>
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error('Este archivo de copia no es compatible con esta versión de la aplicación.')
  if (typeof value.exportedAt !== 'string' || Number.isNaN(new Date(value.exportedAt).getTime())) throw new Error('La fecha de exportación de la copia no es válida.')
  if (value.exportedBy !== 'david' && value.exportedBy !== 'esther') throw new Error('El autor de la copia no es válido.')

  const payload = { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: value.exportedAt, exportedBy: value.exportedBy } as BackupPayload
  for (const key of Object.keys(ENTITY_LABELS) as (keyof BackupSummary)[]) {
    payload[key] = validateEntityArray(key, value[key]) as never
  }
  return payload
}

function validateEntityArray(key: keyof BackupSummary, value: unknown): unknown[] {
  const label = ENTITY_LABELS[key]
  if (!Array.isArray(value)) throw new Error(`La copia no contiene una lista válida de ${label}.`)
  const moneyFields = ENTITY_MONEY_FIELDS[key]
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Un registro de ${label} no es válido.`)
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || !record.id) throw new Error(`Un registro de ${label} no tiene identificador.`)
    if (typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string') throw new Error(`Un registro de ${label} tiene fechas de creación no válidas.`)
    if (record.createdBy !== 'david' && record.createdBy !== 'esther') throw new Error(`Un registro de ${label} tiene un creador no válido.`)
    if (record.deletedAt !== null && typeof record.deletedAt !== 'string') throw new Error(`Un registro de ${label} tiene un estado de borrado no válido.`)
    if (!Number.isSafeInteger(record.version) || !Number.isSafeInteger(record.changeSequence)) throw new Error(`Un registro de ${label} tiene una versión no válida.`)
    for (const field of moneyFields) {
      try { assertMoneyCents(record[field] as number) }
      catch { throw new Error(`Un registro de ${label} (posición ${index + 1}) tiene un importe no válido.`) }
    }
  })
  return value
}

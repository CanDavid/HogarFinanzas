import type { MonthlyClosure, MonthlyClosureInput, UserId } from './types'

export function isMonthClosed(month: string, closures: MonthlyClosure[]): boolean {
  return closures.some((item) => !item.deletedAt && item.month === month && item.status === 'closed')
}

export function closureForMonth(month: string, closures: MonthlyClosure[]): MonthlyClosure | undefined {
  return closures.find((item) => !item.deletedAt && item.month === month)
}

export function latestClosedClosure(closures: MonthlyClosure[], beforeMonth?: string): MonthlyClosure | undefined {
  return closures.filter((item) => !item.deletedAt && item.status === 'closed' && (!beforeMonth || item.month < beforeMonth))
    .sort((left, right) => right.month.localeCompare(left.month))[0]
}

export function validateClosureInput(input: MonthlyClosureInput): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) throw new Error('El mes del cierre no es válido.')
  for (const value of [input.transactionCount, input.pendingIncomeCount, input.pendingExpenseCount]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Los contadores del cierre no son válidos.')
  }
  for (const value of [input.actualIncomeCents, input.actualExpenseCents, input.realSurplusCents, input.projectedSurplusCents,
    input.netWorthCents, input.liquidityCents, input.savingsCents, input.investmentCents, input.goalReservedCents]) {
    if (!Number.isSafeInteger(value)) throw new Error('El cierre excede el rango monetario seguro.')
  }
  if (input.actualIncomeCents < 0 || input.actualExpenseCents < 0 || input.goalReservedCents < 0) {
    throw new Error('El cierre contiene importes que no pueden ser negativos.')
  }
  if (input.realSurplusCents !== checked(input.actualIncomeCents - input.actualExpenseCents)) throw new Error('El resultado real del cierre no cuadra.')
}

export function closureStatusText(closure: MonthlyClosure): string {
  return closure.status === 'closed' ? `Cerrado · revisión ${closure.revision}` : `Reabierto · revisión ${closure.revision}`
}

export function displayClosureUser(user: UserId): string { return user === 'david' ? 'David' : 'Esther' }

export function netWorthChangeSinceClosure(currentNetWorthCents: number, closure: MonthlyClosure): number {
  if (!Number.isSafeInteger(currentNetWorthCents)) throw new Error('El patrimonio actual excede el rango seguro.')
  return checked(currentNetWorthCents - closure.netWorthCents)
}

function checked(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('El cálculo del cierre excede el rango seguro.')
  return value
}

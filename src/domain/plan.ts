import { monthRange } from './dates'
import { deterministicRecordId, occurrenceDates } from './recurrence'
import type { Budget, MonthlyPlan, PlannedItem, RecurringRule, Transaction } from './types'

export type PlanItemStatus = 'pending' | 'realized' | 'omitted'

export interface PlanItemView {
  id: string
  source: PlannedItem['source']
  recurringRuleId: string | null
  kind: PlannedItem['kind']
  amountCents: number
  concept: string
  note: string
  date: string
  accountId: string
  categoryId: string
  status: PlanItemStatus
  transactionId: string | null
  storedItemId: string | null
}

export interface BudgetProgress {
  budget: Budget
  spentCents: number
  remainingCents: number
  percentage: number
}

export interface MonthlyPlanSummary {
  plannedIncomeCents: number
  actualIncomeCents: number
  pendingIncomeCents: number
  plannedFixedExpenseCents: number
  realizedFixedExpenseCents: number
  pendingFixedExpenseCents: number
  variableBudgetCents: number
  variableActualCents: number
  variableRemainingCents: number
  actualExpenseCents: number
  initialSurplusCents: number
  projectedSurplusCents: number
  savingsAllocationCents: number
  investmentAllocationCents: number
  unallocatedCents: number
}

export interface MonthlyPlanView {
  month: string
  items: PlanItemView[]
  budgets: BudgetProgress[]
  summary: MonthlyPlanSummary
}

export function buildMonthlyPlan(
  month: string,
  rules: RecurringRule[],
  storedItems: PlannedItem[],
  transactions: Transaction[],
  budgets: Budget[],
  monthlyPlan?: MonthlyPlan,
): MonthlyPlanView {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('El mes del plan no es válido.')
  const bounds = monthRange(`${month}-01`)
  const visibleTransactions = transactions.filter((item) => !item.deletedAt && item.date >= bounds.from && item.date <= bounds.to)
  const stored = storedItems.filter((item) => !item.deletedAt)
  const recurringOverrides = new Map(stored.filter((item) => item.source === 'recurring' && item.recurringRuleId)
    .map((item) => [`${item.recurringRuleId}:${item.date}`, item]))
  const recurringTransactions = new Map(visibleTransactions.filter((item) => item.recurringRuleId && item.recurringOccurrenceDate)
    .map((item) => [`${item.recurringRuleId}:${item.recurringOccurrenceDate}`, item]))
  const plannedTransactions = new Map(visibleTransactions.filter((item) => item.plannedItemId).map((item) => [item.plannedItemId, item]))

  const recurringItems = rules.filter((rule) => !rule.deletedAt && rule.active).flatMap((rule) => occurrenceDates(rule, 1200)
    .filter((date) => date >= bounds.from && date <= bounds.to).map((date): PlanItemView => {
      const key = `${rule.id}:${date}`; const override = recurringOverrides.get(key); const transaction = recurringTransactions.get(key)
      return { id: deterministicRecordId('planned-recurring', key), source: 'recurring', recurringRuleId: rule.id,
        kind: rule.kind, amountCents: rule.amountCents, concept: rule.concept, note: rule.note, date,
        accountId: rule.accountId, categoryId: rule.categoryId,
        status: transaction ? 'realized' : override?.status ?? 'pending', transactionId: transaction?.id ?? null,
        storedItemId: override?.id ?? null }
    }))
  const manualItems = stored.filter((item) => item.source === 'manual' && item.date >= bounds.from && item.date <= bounds.to)
    .map((item): PlanItemView => { const transaction = plannedTransactions.get(item.id); return {
      id: item.id, source: 'manual', recurringRuleId: null, kind: item.kind, amountCents: item.amountCents,
      concept: item.concept, note: item.note, date: item.date, accountId: item.accountId, categoryId: item.categoryId,
      status: transaction ? 'realized' : item.status, transactionId: transaction?.id ?? null, storedItemId: item.id,
    } })
  const items = [...recurringItems, ...manualItems].sort((left, right) => left.date.localeCompare(right.date) || left.concept.localeCompare(right.concept))

  const currentBudgets = budgets.filter((item) => !item.deletedAt && item.month === month && item.amountCents > 0)
  const variableExpenses = visibleTransactions.filter((item) => item.kind === 'expense' && !item.recurringRuleId && !item.plannedItemId)
  const budgetProgress = currentBudgets.map((budget) => {
    const spentCents = sum(variableExpenses.filter((item) => item.categoryId === budget.categoryId).map((item) => item.amountCents))
    const remainingCents = Math.max(budget.amountCents - spentCents, 0)
    return { budget, spentCents, remainingCents, percentage: budget.amountCents > 0 ? Math.round(spentCents / budget.amountCents * 100) : 0 }
  })
  const pending = items.filter((item) => item.status === 'pending')
  const planned = items.filter((item) => item.status !== 'omitted')
  const actualIncomeCents = sum(visibleTransactions.filter((item) => item.kind === 'income').map((item) => item.amountCents))
  const actualExpenseCents = sum(visibleTransactions.filter((item) => item.kind === 'expense').map((item) => item.amountCents))
  const pendingIncomeCents = sum(pending.filter((item) => item.kind === 'income').map((item) => item.amountCents))
  const pendingFixedExpenseCents = sum(pending.filter((item) => item.kind === 'expense').map((item) => item.amountCents))
  const plannedIncomeCents = sum(planned.filter((item) => item.kind === 'income').map((item) => item.amountCents))
  const plannedFixedExpenseCents = sum(planned.filter((item) => item.kind === 'expense').map((item) => item.amountCents))
  const realizedFixedExpenseCents = sum(visibleTransactions.filter((item) => item.kind === 'expense' && (item.recurringRuleId || item.plannedItemId)).map((item) => item.amountCents))
  const variableBudgetCents = sum(currentBudgets.map((item) => item.amountCents))
  const variableActualCents = sum(variableExpenses.map((item) => item.amountCents))
  const variableRemainingCents = sum(budgetProgress.map((item) => item.remainingCents))
  const initialSurplusCents = checked(plannedIncomeCents - plannedFixedExpenseCents - variableBudgetCents)
  const projectedSurplusCents = checked(actualIncomeCents + pendingIncomeCents - actualExpenseCents - pendingFixedExpenseCents - variableRemainingCents)
  const savingsAllocationCents = monthlyPlan?.savingsAllocationCents ?? 0
  const investmentAllocationCents = monthlyPlan?.investmentAllocationCents ?? 0
  const unallocatedCents = checked(projectedSurplusCents - savingsAllocationCents - investmentAllocationCents)
  return { month, items, budgets: budgetProgress, summary: { plannedIncomeCents, actualIncomeCents, pendingIncomeCents,
    plannedFixedExpenseCents, realizedFixedExpenseCents, pendingFixedExpenseCents, variableBudgetCents,
    variableActualCents, variableRemainingCents, actualExpenseCents, initialSurplusCents, projectedSurplusCents,
    savingsAllocationCents, investmentAllocationCents, unallocatedCents } }
}

function sum(values: number[]): number { return values.reduce((total, value) => checked(total + value), 0) }
function checked(value: number): number { if (!Number.isSafeInteger(value)) throw new Error('El cálculo del plan excede el rango seguro.'); return value }

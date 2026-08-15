import type { Goal, GoalAllocation } from './types'

export interface GoalProgress {
  goal: Goal
  assignedCents: number
  remainingCents: number
  overallocatedCents: number
  percentage: number
  monthlyAverageCents: number | null
  estimatedCompletionMonth: string | null
  allocations: GoalAllocation[]
}

export interface GoalPortfolioSummary {
  goals: GoalProgress[]
  reservedCents: number
  unassignedNetWorthCents: number
}

export function buildGoalPortfolio(
  goals: Goal[],
  allocations: GoalAllocation[],
  netWorthCents: number,
  today: string,
): GoalPortfolioSummary {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error('La fecha de cálculo de objetivos no es válida.')
  const visibleAllocations = allocations.filter((item) => !item.deletedAt)
  const progress = goals.filter((goal) => !goal.deletedAt).map((goal) => buildGoalProgress(goal, visibleAllocations, today))
    .sort((left, right) => statusOrder(left.goal) - statusOrder(right.goal) || left.goal.name.localeCompare(right.goal.name))
  const reservedCents = sum(progress.filter((item) => !item.goal.archivedAt).map((item) => item.assignedCents))
  return { goals: progress, reservedCents, unassignedNetWorthCents: checked(netWorthCents - reservedCents) }
}

export function goalAssignedCents(goalId: string, allocations: GoalAllocation[]): number {
  return sum(allocations.filter((item) => !item.deletedAt && item.goalId === goalId).map((item) => item.amountCents))
}

function buildGoalProgress(goal: Goal, allocations: GoalAllocation[], today: string): GoalProgress {
  const goalAllocations = allocations.filter((item) => item.goalId === goal.id)
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
  const assignedCents = sum(goalAllocations.map((item) => item.amountCents))
  const remainingCents = Math.max(checked(goal.targetAmountCents - assignedCents), 0)
  const overallocatedCents = Math.max(checked(assignedCents - goal.targetAmountCents), 0)
  const percentage = goal.targetAmountCents > 0 ? Math.round(assignedCents / goal.targetAmountCents * 100) : 0
  const activeMonths = [...new Set(goalAllocations.map((item) => item.date.slice(0, 7)))].sort()
  const monthlyAverageCents = activeMonths.length >= 2 && assignedCents > 0
    ? Math.round(assignedCents / monthsInclusive(activeMonths[0], today.slice(0, 7))) : null
  const estimatedCompletionMonth = monthlyAverageCents && remainingCents > 0
    ? addMonths(today.slice(0, 7), Math.ceil(remainingCents / monthlyAverageCents)) : null
  return { goal, assignedCents, remainingCents, overallocatedCents, percentage, monthlyAverageCents,
    estimatedCompletionMonth, allocations: goalAllocations }
}

function monthsInclusive(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return Math.max((toYear - fromYear) * 12 + toMonth - fromMonth + 1, 1)
}

function addMonths(month: string, offset: number): string {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, value - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function statusOrder(goal: Goal): number { return goal.archivedAt ? 2 : goal.completedAt ? 1 : 0 }
function sum(values: number[]): number { return values.reduce((total, value) => checked(total + value), 0) }
function checked(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('El cálculo de objetivos excede el rango seguro.')
  return value
}

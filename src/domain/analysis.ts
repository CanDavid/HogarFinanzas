import type { Budget, Category, Goal, GoalAllocation, MonthlyClosure, Transaction } from './types'

export type AnalysisPeriod = '3m' | '6m' | '12m' | 'year' | 'custom'

export interface AnalysisRange {
  from: string
  to: string
  months: string[]
}

export interface MonthlyAnalysis {
  month: string
  incomeCents: number
  expenseCents: number
  resultCents: number
  savingsCents: number
  savingsRatePercent: number
}

export interface CategoryAnalysis {
  categoryId: string
  name: string
  icon: string
  amountCents: number
  percentage: number
}

export interface BudgetAnalysis {
  month: string
  categoryId: string
  categoryName: string
  categoryIcon: string
  budgetCents: number
  actualCents: number
  differenceCents: number
  percentage: number
}

export interface GoalAnalysis {
  goalId: string
  name: string
  icon: string
  targetAmountCents: number
  assignedCents: number
  addedInPeriodCents: number
  percentage: number
}

export interface AnalysisResult {
  range: AnalysisRange
  months: MonthlyAnalysis[]
  categories: CategoryAnalysis[]
  budgets: BudgetAnalysis[]
  closures: MonthlyClosure[]
  goals: GoalAnalysis[]
  totalIncomeCents: number
  totalExpenseCents: number
  resultCents: number
  savingsCents: number
  savingsRatePercent: number
  yearSavingsCents: number
  insights: string[]
}

interface AnalysisInput {
  today: string
  period: AnalysisPeriod
  customFrom?: string
  customTo?: string
  transactions: Transaction[]
  budgets: Budget[]
  categories: Category[]
  closures: MonthlyClosure[]
  goals: Goal[]
  allocations: GoalAllocation[]
}

export function resolveAnalysisRange(today: string, period: AnalysisPeriod, customFrom?: string, customTo?: string): AnalysisRange {
  assertDate(today)
  const currentMonth = today.slice(0, 7)
  let from: string
  let to: string
  if (period === 'custom') {
    if (!customFrom || !customTo) throw new Error('Indica las dos fechas del periodo personalizado.')
    assertDate(customFrom); assertDate(customTo)
    if (customFrom > customTo) throw new Error('La fecha inicial no puede ser posterior a la final.')
    from = customFrom; to = customTo
  } else if (period === 'year') {
    from = `${today.slice(0, 4)}-01-01`; to = today
  } else {
    const count = period === '3m' ? 3 : period === '6m' ? 6 : 12
    from = `${addMonths(currentMonth, -(count - 1))}-01`; to = today
  }
  const months = monthsInclusive(from.slice(0, 7), to.slice(0, 7))
  if (months.length > 120) throw new Error('El periodo personalizado no puede superar 10 años.')
  return { from, to, months }
}

export function buildAnalysis(input: AnalysisInput): AnalysisResult {
  const range = resolveAnalysisRange(input.today, input.period, input.customFrom, input.customTo)
  const visible = input.transactions.filter((item) => !item.deletedAt && item.date >= range.from && item.date <= range.to)
  const financial = visible.filter((item) => item.kind === 'income' || item.kind === 'expense')
  financial.forEach((item) => assertCents(item.amountCents))

  const months = range.months.map((month): MonthlyAnalysis => {
    const items = financial.filter((item) => item.date.startsWith(month))
    const incomeCents = sum(items.filter((item) => item.kind === 'income').map((item) => item.amountCents))
    const expenseCents = sum(items.filter((item) => item.kind === 'expense').map((item) => item.amountCents))
    const resultCents = checked(incomeCents - expenseCents)
    const savingsCents = resultCents
    return { month, incomeCents, expenseCents, resultCents, savingsCents,
      savingsRatePercent: incomeCents > 0 ? Math.round(Math.max(savingsCents, 0) / incomeCents * 100) : 0 }
  })
  const totalIncomeCents = sum(months.map((item) => item.incomeCents))
  const totalExpenseCents = sum(months.map((item) => item.expenseCents))
  const resultCents = checked(totalIncomeCents - totalExpenseCents)
  const savingsCents = resultCents

  const categoryMap = new Map(input.categories.filter((item) => !item.deletedAt).map((item) => [item.id, item]))
  const expenses = financial.filter((item) => item.kind === 'expense')
  const categoryTotals = new Map<string, number>()
  expenses.forEach((item) => {
    const key = item.categoryId ?? 'uncategorized'
    categoryTotals.set(key, checked((categoryTotals.get(key) ?? 0) + item.amountCents))
  })
  const categories = [...categoryTotals].map(([categoryId, amountCents]): CategoryAnalysis => {
    const category = categoryMap.get(categoryId)
    return { categoryId, name: category?.name ?? 'Sin categoría', icon: category?.icon ?? '○', amountCents,
      percentage: totalExpenseCents > 0 ? Math.round(amountCents / totalExpenseCents * 100) : 0 }
  }).sort((left, right) => right.amountCents - left.amountCents || left.name.localeCompare(right.name))

  const activeBudgets = input.budgets.filter((item) => !item.deletedAt && item.amountCents > 0 && range.months.includes(item.month))
  const variableExpenses = expenses.filter((item) => !item.recurringRuleId && !item.plannedItemId)
  const budgets = activeBudgets.map((budget): BudgetAnalysis => {
    assertCents(budget.amountCents)
    const actualCents = sum(variableExpenses.filter((item) => item.date.startsWith(budget.month) && item.categoryId === budget.categoryId)
      .map((item) => item.amountCents))
    const category = categoryMap.get(budget.categoryId)
    return { month: budget.month, categoryId: budget.categoryId, categoryName: category?.name ?? 'Sin categoría',
      categoryIcon: category?.icon ?? '○', budgetCents: budget.amountCents, actualCents,
      differenceCents: checked(budget.amountCents - actualCents), percentage: Math.round(actualCents / budget.amountCents * 100) }
  }).sort((left, right) => right.month.localeCompare(left.month) || left.categoryName.localeCompare(right.categoryName))

  const closures = input.closures.filter((item) => !item.deletedAt && item.status === 'closed' && range.months.includes(item.month))
    .sort((left, right) => left.month.localeCompare(right.month))
  closures.forEach((item) => assertCents(item.netWorthCents))

  const activeGoals = input.goals.filter((item) => !item.deletedAt && !item.archivedAt && !item.completedAt)
  const validAllocations = input.allocations.filter((item) => !item.deletedAt)
  const goals = activeGoals.map((goal): GoalAnalysis => {
    assertCents(goal.targetAmountCents)
    const assignedCents = Math.max(sum(validAllocations.filter((item) => item.goalId === goal.id && item.date <= range.to).map((item) => item.amountCents)), 0)
    const addedInPeriodCents = sum(validAllocations.filter((item) => item.goalId === goal.id && item.date >= range.from && item.date <= range.to).map((item) => item.amountCents))
    return { goalId: goal.id, name: goal.name, icon: goal.icon, targetAmountCents: goal.targetAmountCents,
      assignedCents, addedInPeriodCents, percentage: goal.targetAmountCents > 0 ? Math.round(assignedCents / goal.targetAmountCents * 100) : 0 }
  }).sort((left, right) => right.percentage - left.percentage || left.name.localeCompare(right.name))

  const yearFrom = `${input.today.slice(0, 4)}-01-01`
  const yearResult = input.transactions.filter((item) => !item.deletedAt && item.date >= yearFrom && item.date <= input.today)
    .reduce((total, item) => item.kind === 'income' ? checked(total + item.amountCents) : item.kind === 'expense' ? checked(total - item.amountCents) : total, 0)
  const savingsRatePercent = totalIncomeCents > 0 ? Math.round(Math.max(savingsCents, 0) / totalIncomeCents * 100) : 0
  return { range, months, categories, budgets, closures, goals, totalIncomeCents, totalExpenseCents, resultCents,
    savingsCents, savingsRatePercent, yearSavingsCents: yearResult,
    insights: buildInsights(months, budgets, closures) }
}

function buildInsights(months: MonthlyAnalysis[], budgets: BudgetAnalysis[], closures: MonthlyClosure[]): string[] {
  const insights: string[] = []
  if (months.length >= 2 && months.some((item) => item.expenseCents > 0)) {
    const current = months.at(-1)!; const previous = months.at(-2)!; const difference = checked(current.expenseCents - previous.expenseCents)
    insights.push(difference === 0 ? 'Este mes has gastado lo mismo que el anterior.'
      : difference < 0 ? `Este mes has gastado ${formatCents(Math.abs(difference))} menos que el anterior.`
        : `Este mes has gastado ${formatCents(difference)} más que el anterior.`)
  }
  const exceeded = budgets.filter((item) => item.differenceCents < 0)
    .sort((left, right) => (right.percentage - 100) - (left.percentage - 100))[0]
  if (exceeded) insights.push(`${exceeded.categoryName} supera su presupuesto de ${monthLabel(exceeded.month)} en ${Math.max(exceeded.percentage - 100, 0)}%.`)
  if (closures.length >= 2) {
    const change = checked(closures.at(-1)!.netWorthCents - closures[0].netWorthCents)
    insights.push(change === 0 ? `El patrimonio se mantiene igual entre ${monthLabel(closures[0].month)} y ${monthLabel(closures.at(-1)!.month)}.`
      : `El patrimonio ha ${change > 0 ? 'aumentado' : 'disminuido'} ${formatCents(Math.abs(change))} entre ${monthLabel(closures[0].month)} y ${monthLabel(closures.at(-1)!.month)}.`)
  }
  if (insights.length === 0) insights.push('Aún no hay suficiente historial para comparar periodos.')
  return insights
}

function monthsInclusive(from: string, to: string): string[] {
  const result: string[] = []
  let current = from
  while (current <= to) { result.push(current); current = addMonths(current, 1) }
  return result
}

function addMonths(month: string, offset: number): string {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, value - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function assertDate(value: string): void {
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('La fecha del análisis no es válida.')
  }
}
function assertCents(value: number): void { if (!Number.isSafeInteger(value)) throw new Error('El análisis excede el rango monetario seguro.') }
function checked(value: number): number { assertCents(value); return value }
function sum(values: number[]): number { return values.reduce((total, value) => checked(total + value), 0) }
function formatCents(value: number): string { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value / 100) }
function monthLabel(month: string): string { return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)) }

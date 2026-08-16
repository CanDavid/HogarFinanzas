import { localDateOnly } from '../domain/dates'
import { latestClosedClosure, netWorthChangeSinceClosure } from '../domain/closures'
import { calculatePortfolio, calculateTotals } from '../domain/finance'
import { buildGoalPortfolio } from '../domain/goals'
import { DEFAULT_MOVEMENT_FILTERS, filterMovements } from '../domain/movements'
import { formatEuro } from '../domain/money'
import { buildMonthlyPlan } from '../domain/plan'
import type { Account, Budget, Category, Goal, GoalAllocation, MonthlyClosure, MonthlyPlan, PlannedItem, RecurringRule, Transaction } from '../domain/types'

export function HomeView({ transactions, accounts, categories, goals, allocations, closures, recurringRules, plannedItems, budgets, monthlyPlans,
  onAddMovement, onOpenMovements, onOpenPortfolio, onOpenGoals, onOpenAccounts, onOpenCategories }: {
  transactions: Transaction[]; accounts: Account[]; categories: Category[]; goals: Goal[]; allocations: GoalAllocation[]; closures: MonthlyClosure[]
  recurringRules: RecurringRule[]; plannedItems: PlannedItem[]; budgets: Budget[]; monthlyPlans: MonthlyPlan[]
  onAddMovement(): void; onOpenMovements(): void; onOpenPortfolio(): void; onOpenGoals(): void; onOpenAccounts(): void; onOpenCategories(): void
}) {
  const today = localDateOnly(); const month = today.slice(0, 7)
  const monthTransactions = filterMovements(transactions, DEFAULT_MOVEMENT_FILTERS, accounts, categories, today)
  const totals = calculateTotals(monthTransactions)
  const portfolio = calculatePortfolio(accounts, transactions)
  const plan = buildMonthlyPlan(month, recurringRules, plannedItems, transactions, budgets, monthlyPlans.find((item) => item.month === month))
  const goalPortfolio = buildGoalPortfolio(goals, allocations, portfolio.netWorthCents, localDateOnly())
  const latestClosure = latestClosedClosure(closures, localDateOnly().slice(0, 7))
  const netWorthChange = latestClosure ? netWorthChangeSinceClosure(portfolio.netWorthCents, latestClosure) : null
  const highlightedGoals = goalPortfolio.goals.filter((item) => !item.goal.archivedAt && !item.goal.completedAt).slice(0, 3)
  return <div className="home-view">
    <section className="hero-card"><span>Patrimonio total</span><strong>{formatEuro(portfolio.netWorthCents)}</strong><small>Liquidez disponible: {formatEuro(portfolio.liquidityCents)}</small>{latestClosure && netWorthChange !== null && <small>{netWorthChange < 0 ? '−' : '+'}{formatEuro(Math.abs(netWorthChange))} desde el cierre de {monthName(latestClosure.month)}</small>}<button onClick={onOpenPortfolio}>Ver patrimonio</button></section>
    <section className="card month-card"><div className="section-title"><h2>Este mes</h2><button className="text-action" onClick={onOpenMovements}>Ver movimientos</button></div>
      <div className="metric-grid"><div><span>Ingresos</span><strong>{formatEuro(totals.incomeCents)}</strong></div><div><span>Gastos</span><strong>{formatEuro(totals.expenseCents)}</strong></div><div><span>Gastos previstos</span><strong>{formatEuro(plan.summary.pendingFixedExpenseCents)}</strong></div><div><span>Resultado</span><strong>{formatEuro(totals.balanceCents)}</strong></div></div>
    </section>
    <button className="primary-action" onClick={onAddMovement}>＋ Añadir movimiento</button>
    <section className="card home-goals"><div className="section-title"><h2>Objetivos</h2><button className="text-action" onClick={onOpenGoals}>Ver todos</button></div>
      {highlightedGoals.length === 0 ? <p>No hay objetivos activos todavía.</p> : highlightedGoals.map((item) => <div key={item.goal.id}><span>{item.goal.icon} {item.goal.name}</span><strong>{formatEuro(item.assignedCents)} de {formatEuro(item.goal.targetAmountCents)}</strong><progress max={100} value={Math.min(Math.max(item.percentage, 0), 100)} aria-label={`${item.goal.name}: ${item.percentage}% completado`} /></div>)}</section>
    <section className="home-links"><button className="card" onClick={onOpenAccounts}><strong>Cuentas</strong><span>{accounts.filter((item) => !item.archivedAt).length} operativas</span></button>
      <button className="card" onClick={onOpenCategories}><strong>Categorías</strong><span>{categories.filter((item) => !item.archivedAt).length} operativas</span></button></section>
  </div>
}

function monthName(month: string): string { return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)) }

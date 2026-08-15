import { localDateOnly } from '../domain/dates'
import { calculatePortfolioBreakdown } from '../domain/finance'
import { buildGoalPortfolio } from '../domain/goals'
import { formatEuro } from '../domain/money'
import type { Account, AccountType, Goal, GoalAllocation, Transaction } from '../domain/types'

export function PortfolioView({ accounts, transactions, goals, allocations, onManageAccounts }: {
  accounts: Account[]; transactions: Transaction[]; goals: Goal[]; allocations: GoalAllocation[]; onManageAccounts(): void
}) {
  const portfolio = calculatePortfolioBreakdown(accounts, transactions)
  const goalPortfolio = buildGoalPortfolio(goals, allocations, portfolio.netWorthCents, localDateOnly())
  const visibleAccounts = accounts.filter((item) => !item.deletedAt).sort((left, right) => left.archivedAt === right.archivedAt
    ? left.name.localeCompare(right.name) : left.archivedAt ? 1 : -1)
  return <div className="portfolio-view">
    <section className="hero-card"><span>Patrimonio total</span><strong>{formatEuro(portfolio.netWorthCents)}</strong><small>Suma de las cuentas incluidas en patrimonio.</small></section>
    <section className="portfolio-metrics" aria-label="Resumen de patrimonio"><Metric label="Liquidez" value={portfolio.liquidityCents} />
      <Metric label="Ahorro" value={portfolio.byType.get('savings') ?? 0} /><Metric label="Inversión" value={portfolio.byType.get('investment') ?? 0} />
      <Metric label="Asignado a objetivos" value={goalPortfolio.reservedCents} /><Metric label="Patrimonio sin asignar" value={goalPortfolio.unassignedNetWorthCents} signed /></section>
    <section className="card portfolio-explanation"><h2>Qué significa</h2><p>Los objetivos reservan dinero de forma virtual. No modifican estos saldos ni el patrimonio total.</p></section>
    <section><div className="section-title"><h2>Cuentas</h2><span>{visibleAccounts.length}</span><button className="text-action" onClick={onManageAccounts}>Gestionar</button></div>
      {visibleAccounts.length === 0 ? <p className="empty">Crea una cuenta para empezar a calcular el patrimonio.</p> : <ul className="portfolio-accounts">{visibleAccounts.map((account) => <li key={account.id} className={account.archivedAt ? 'archived' : ''}>
        <div><strong>{account.name}</strong><small>{accountTypeLabel(account.type)}{account.archivedAt ? ' · Archivada' : ''}</small></div>
        <div><strong>{formatEuro(portfolio.balances.get(account.id) ?? account.initialBalanceCents)}</strong><small>{account.includeInNetWorth ? 'Incluida en patrimonio' : 'Fuera de patrimonio'}{account.includeInLiquidity ? ' · Líquida' : ''}</small></div>
      </li>)}</ul>}</section>
  </div>
}

function Metric({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  return <div><span>{label}</span><strong className={value < 0 ? 'negative' : ''}>{signed && value > 0 ? '+' : ''}{formatEuro(value)}</strong></div>
}
function accountTypeLabel(type: AccountType): string { return ({ checking: 'Corriente', savings: 'Ahorro', investment: 'Inversión', cash: 'Efectivo' })[type] }

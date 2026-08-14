import { localDateOnly } from '../domain/dates'
import { calculatePortfolio, calculateTotals } from '../domain/finance'
import { DEFAULT_MOVEMENT_FILTERS, filterMovements } from '../domain/movements'
import { formatEuro } from '../domain/money'
import type { Account, Category, Transaction } from '../domain/types'

export function HomeView({ transactions, accounts, categories, onAddMovement, onOpenMovements, onOpenAccounts, onOpenCategories }: {
  transactions: Transaction[]; accounts: Account[]; categories: Category[]
  onAddMovement(): void; onOpenMovements(): void; onOpenAccounts(): void; onOpenCategories(): void
}) {
  const monthTransactions = filterMovements(transactions, DEFAULT_MOVEMENT_FILTERS, accounts, categories, localDateOnly())
  const totals = calculateTotals(monthTransactions)
  const portfolio = calculatePortfolio(accounts, transactions)
  return <div className="home-view">
    <section className="hero-card"><span>Patrimonio total</span><strong>{formatEuro(portfolio.netWorthCents)}</strong><small>Liquidez disponible: {formatEuro(portfolio.liquidityCents)}</small><button onClick={onOpenAccounts}>Ver cuentas</button></section>
    <section className="card month-card"><div className="section-title"><h2>Este mes</h2><button className="text-action" onClick={onOpenMovements}>Ver movimientos</button></div>
      <div className="metric-grid"><div><span>Ingresos</span><strong>{formatEuro(totals.incomeCents)}</strong></div><div><span>Gastos</span><strong>{formatEuro(totals.expenseCents)}</strong></div><div><span>Resultado</span><strong>{formatEuro(totals.balanceCents)}</strong></div></div>
    </section>
    <button className="primary-action" onClick={onAddMovement}>＋ Añadir movimiento</button>
    <section className="home-links"><button className="card" onClick={onOpenAccounts}><strong>Cuentas</strong><span>{accounts.filter((item) => !item.archivedAt).length} operativas</span></button>
      <button className="card" onClick={onOpenCategories}><strong>Categorías</strong><span>{categories.filter((item) => !item.archivedAt).length} operativas</span></button></section>
  </div>
}

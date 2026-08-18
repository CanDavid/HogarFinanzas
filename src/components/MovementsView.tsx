import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizeDateOnly, localDateOnly } from '../domain/dates'
import { calculateRunningBalances } from '../domain/finance'
import { DEFAULT_MOVEMENT_FILTERS, filterMovements, groupMovements, type MovementFilters } from '../domain/movements'
import { formatEuro } from '../domain/money'
import { isMonthClosed } from '../domain/closures'
import type { Account, Category, MonthlyClosure, RecurringRuleInput, Transaction, TransactionInput, TransactionKind } from '../domain/types'
import { TransactionForm } from './TransactionForm'

export function MovementsView({ transactions, accounts, categories, closures, startAdding = false, initialKind, initialAccountId, onSave, onDelete, onConvertToPlanned }: {
  transactions: Transaction[]; accounts: Account[]; categories: Category[]; closures: MonthlyClosure[]; startAdding?: boolean
  initialKind?: TransactionKind; initialAccountId?: string
  onSave(transaction: Transaction | undefined, input: TransactionInput, recurrence?: RecurringRuleInput): Promise<void>; onDelete(transaction: Transaction): Promise<void>
  onConvertToPlanned(transaction: Transaction): Promise<void>
}) {
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [adding, setAdding] = useState(startAdding)
  const [draftKind, setDraftKind] = useState(initialKind)
  const [draftAccountId, setDraftAccountId] = useState(initialAccountId)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<MovementFilters>(() =>
    !startAdding && initialAccountId ? { ...DEFAULT_MOVEMENT_FILTERS, accountId: initialAccountId, period: 'all' } : DEFAULT_MOVEMENT_FILTERS)
  const today = localDateOnly()
  const filtered = useMemo(() => filterMovements(transactions, filters, accounts, categories, today), [transactions, filters, accounts, categories, today])
  const groups = useMemo(() => groupMovements(filtered), [filtered])
  const runningBalances = useMemo(() => calculateRunningBalances(accounts, transactions), [accounts, transactions])
  const accountNames = useMemo(() => new Map(accounts.map((item) => [item.id, item.name])), [accounts])
  const categoryNames = useMemo(() => new Map(categories.map((item) => [item.id, `${item.icon} ${item.name}`])), [categories])
  const formOpen = adding || Boolean(editing)
  const formHeadingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (formOpen) formHeadingRef.current?.focus() }, [formOpen])

  async function save(input: TransactionInput, recurrence?: RecurringRuleInput) { await onSave(editing, input, recurrence); setEditing(undefined); setAdding(false) }
  function edit(transaction: Transaction) { setAdding(false); setEditing(transaction); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function closeForm() { setAdding(false); setEditing(undefined) }
  function updateFilter<K extends keyof MovementFilters>(key: K, value: MovementFilters[K]) { setFilters((current) => ({ ...current, [key]: value })) }

  return <div className="movements-view">
    <div className="movement-toolbar"><label className="search-field"><span className="sr-only">Buscar movimientos</span><input type="search" placeholder="Buscar concepto, nota, cuenta…" value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} /></label>
      <button className="filter-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}>Filtros</button>
      <button className="add-button" onClick={() => { setEditing(undefined); setDraftKind(undefined); setDraftAccountId(undefined); setAdding(true) }} aria-label="Añadir movimiento">＋</button></div>
    {filtersOpen && <MovementFilterPanel filters={filters} accounts={accounts} categories={categories} onChange={updateFilter} onClear={() => setFilters(DEFAULT_MOVEMENT_FILTERS)} />}
    {formOpen && <section className="card movement-editor"><div className="section-title"><h2 ref={formHeadingRef} tabIndex={-1}>{editing ? 'Editar movimiento' : 'Añadir movimiento'}</h2><button className="close-button" onClick={closeForm} aria-label="Cerrar formulario">×</button></div>
      <TransactionForm key={editing?.id ?? `new-${draftKind ?? 'standard'}`} transaction={editing} initialKind={draftKind} initialAccountId={draftAccountId} accounts={accounts} categories={categories} onSave={save} onCancel={closeForm} /></section>}
    <section className="movements"><div className="section-title"><h2>Actividad</h2><span>{filtered.length}</span></div>
      {groups.length === 0 ? <p className="empty">No hay movimientos que coincidan con estos filtros.</p> : groups.map((group) => <div className="movement-group" key={group.date}><h3>{formatGroupDate(group.date)}</h3><ul>{group.transactions.map((item) => {
        const locked = isMonthClosed(item.date.slice(0, 7), closures)
        const convertible = (item.kind === 'income' || item.kind === 'expense') && item.date > today
        return <li key={item.id} className={locked ? 'locked' : ''}>
        <button className="movement-main" onClick={() => edit(item)} disabled={locked} aria-label={locked ? `${item.concept}, mes cerrado` : undefined}><span className={`kind-icon ${item.kind}`} aria-hidden="true">{kindIcon(item.kind)}</span><span><strong>{item.concept}{item.recurringRuleId && <span className="recurring-badge">Recurrente</span>}{locked && <span className="closed-badge">Cerrado</span>}</strong><small>{movementContext(item, accountNames, categoryNames)} · {displayUser(item.createdBy)}</small>{item.note && <small className="movement-note">{item.note}</small>}</span><span className="movement-amount"><strong className={item.kind}>{movementAmount(item)}</strong>{runningBalances.has(item.id) && <small>{formatEuro(runningBalances.get(item.id)!)}</small>}</span></button>
        {!locked && <div className="movement-actions"><button className="delete" onClick={() => void onDelete(item)} aria-label={`Eliminar ${item.concept}`}>Eliminar</button>
          {convertible && <button className="text-action" onClick={() => void onConvertToPlanned(item)} aria-label={`Convertir ${item.concept} en previsto`}>Convertir a Previsto</button>}</div>}</li> })}</ul></div>)}
    </section>
  </div>
}

function MovementFilterPanel({ filters, accounts, categories, onChange, onClear }: {
  filters: MovementFilters; accounts: Account[]; categories: Category[]
  onChange<K extends keyof MovementFilters>(key: K, value: MovementFilters[K]): void; onClear(): void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  return <section className="card filter-panel" aria-label="Filtros de movimientos"><h2 ref={headingRef} tabIndex={-1} className="sr-only">Filtros de movimientos</h2><div className="filter-grid">
    <label>Periodo<select value={filters.period} onChange={(event) => onChange('period', event.target.value as MovementFilters['period'])}><option value="current">Mes actual</option><option value="previous">Mes anterior</option><option value="all">Todo</option><option value="custom">Personalizado</option></select></label>
    <label>Tipo<select value={filters.kind} onChange={(event) => onChange('kind', event.target.value as TransactionKind | 'all')}><option value="all">Todos</option><option value="expense">Gastos</option><option value="income">Ingresos</option><option value="transfer">Transferencias</option><option value="adjustment">Ajustes</option></select></label>
    <label>Cuenta<select value={filters.accountId} onChange={(event) => onChange('accountId', event.target.value)}><option value="">Todas</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.archivedAt ? ' (archivada)' : ''}</option>)}</select></label>
    <label>Categoría<select value={filters.categoryId} onChange={(event) => onChange('categoryId', event.target.value)}><option value="">Todas</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}{item.archivedAt ? ' (archivada)' : ''}</option>)}</select></label>
    <label>Registrado por<select value={filters.userId} onChange={(event) => onChange('userId', event.target.value as MovementFilters['userId'])}><option value="all">Ambos</option><option value="david">David</option><option value="esther">Esther</option></select></label>
    <label>Recurrencia<select value={filters.recurrence} onChange={(event) => onChange('recurrence', event.target.value as MovementFilters['recurrence'])}><option value="all">Todos</option><option value="recurring">Recurrentes</option><option value="single">No recurrentes</option></select></label>
    {filters.period === 'custom' && <><label>Desde<input type="date" value={filters.dateFrom} onChange={(event) => onChange('dateFrom', event.target.value)} /></label><label>Hasta<input type="date" value={filters.dateTo} onChange={(event) => onChange('dateTo', event.target.value)} /></label></>}
  </div><button className="text-action clear-filters" onClick={onClear}>Restablecer filtros</button></section>
}

function formatGroupDate(value: string): string {
  const normalized = normalizeDateOnly(value)
  if (!normalized) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${normalized}T00:00:00Z`))
}
function kindIcon(kind: TransactionKind): string { return kind === 'income' ? '↓' : kind === 'expense' ? '↑' : kind === 'transfer' ? '↔' : '±' }
function movementAmount(item: Transaction): string { return item.kind === 'transfer' ? formatEuro(item.amountCents) : `${item.kind === 'expense' || item.amountCents < 0 ? '−' : '+'}${formatEuro(Math.abs(item.amountCents))}` }
function displayUser(user: Transaction['createdBy']): string { return user === 'david' ? 'David' : 'Esther' }
function movementContext(item: Transaction, accounts: Map<string, string>, categories: Map<string, string>): string {
  if (item.kind === 'transfer') return `${accounts.get(item.sourceAccountId ?? '') ?? 'Sin cuenta'} → ${accounts.get(item.destinationAccountId ?? '') ?? 'Sin cuenta'}`
  return `${categories.get(item.categoryId ?? '') ?? (item.kind === 'adjustment' ? 'Ajuste' : 'Sin categoría')} · ${accounts.get(item.accountId ?? '') ?? 'Sin cuenta'}`
}

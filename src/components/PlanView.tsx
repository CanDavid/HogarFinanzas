import { useMemo, useState, type FormEvent } from 'react'
import { localDateOnly } from '../domain/dates'
import { formatEuro, parseEuroToCents } from '../domain/money'
import { buildMonthlyPlan, type PlanItemView } from '../domain/plan'
import type { Account, Budget, Category, MonthlyPlan, PlannedItem, PlannedItemInput, RecurringRule, Transaction } from '../domain/types'

type PlanSection = 'forecast' | 'budgets' | 'distribution'

interface Props {
  transactions: Transaction[]
  rules: RecurringRule[]
  plannedItems: PlannedItem[]
  budgets: Budget[]
  monthlyPlans: MonthlyPlan[]
  accounts: Account[]
  categories: Category[]
  onCreateItem(input: PlannedItemInput): Promise<void>
  onUpdateItem(id: string, input: PlannedItemInput): Promise<void>
  onDeleteItem(id: string): Promise<void>
  onSetItemStatus(id: string, status: PlannedItem['status']): Promise<void>
  onSetRecurringStatus(ruleId: string, date: string, status: PlannedItem['status']): Promise<void>
  onMaterialize(item: PlanItemView): Promise<void>
  onSetBudget(month: string, categoryId: string, amountCents: number): Promise<void>
  onSetDistribution(month: string, savingsCents: number, investmentCents: number): Promise<void>
}

export function PlanView(props: Props) {
  const [month, setMonth] = useState(localDateOnly().slice(0, 7))
  const [section, setSection] = useState<PlanSection>('forecast')
  const [adding, setAdding] = useState(false); const [editing, setEditing] = useState<PlannedItem>()
  const [error, setError] = useState('')
  const monthlyPlan = props.monthlyPlans.find((item) => item.month === month)
  const plan = useMemo(() => buildMonthlyPlan(month, props.rules, props.plannedItems, props.transactions, props.budgets, monthlyPlan),
    [month, props.rules, props.plannedItems, props.transactions, props.budgets, monthlyPlan])
  async function run(action: () => Promise<void>) { setError(''); try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar la acción.') } }
  function changeMonth(offset: number) { const [year, value] = month.split('-').map(Number); const date = new Date(year, value - 1 + offset, 1); setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`); setAdding(false); setEditing(undefined) }

  return <div className="plan-view"><div className="month-selector"><button onClick={() => changeMonth(-1)} aria-label="Mes anterior">‹</button><div><strong>{monthLabel(month)}</strong><small>Abierto · cierre en Fase 7</small></div><button onClick={() => changeMonth(1)} aria-label="Mes siguiente">›</button></div>
    <section className="card plan-hero"><span>Disponible estimado al final de mes</span><strong className={plan.summary.projectedSurplusCents < 0 ? 'negative' : ''}>{formatSigned(plan.summary.projectedSurplusCents)}</strong>
      <small>Ingresos reales + pendientes − gastos reales − fijos pendientes − variable por gastar</small>
      <p className="projection-equation" aria-label={`Cálculo: ${formatEuro(plan.summary.actualIncomeCents)} de ingresos reales más ${formatEuro(plan.summary.pendingIncomeCents)} de ingresos pendientes, menos ${formatEuro(plan.summary.actualExpenseCents)} de gastos reales, menos ${formatEuro(plan.summary.pendingFixedExpenseCents)} de gastos fijos pendientes, menos ${formatEuro(plan.summary.variableRemainingCents)} de presupuesto variable por gastar`}>
        {formatEuro(plan.summary.actualIncomeCents)} + {formatEuro(plan.summary.pendingIncomeCents)} − {formatEuro(plan.summary.actualExpenseCents)} − {formatEuro(plan.summary.pendingFixedExpenseCents)} − {formatEuro(plan.summary.variableRemainingCents)}
      </p></section>
    <section className="plan-metrics" aria-label="Resumen del plan"><Metric label="Ingresos planificados" value={plan.summary.plannedIncomeCents} /><Metric label="Ingresos reales" value={plan.summary.actualIncomeCents} />
      <Metric label="Ingresos pendientes" value={plan.summary.pendingIncomeCents} /><Metric label="Gastos reales totales" value={plan.summary.actualExpenseCents} />
      <Metric label="Gastos fijos planificados" value={plan.summary.plannedFixedExpenseCents} /><Metric label="Gastos fijos pagados" value={plan.summary.realizedFixedExpenseCents} />
      <Metric label="Gastos fijos pendientes" value={plan.summary.pendingFixedExpenseCents} /><Metric label="Presupuesto variable del mes" value={plan.summary.variableBudgetCents} />
      <Metric label="Gasto variable registrado" value={plan.summary.variableActualCents} /><Metric label="Variable pendiente de gastar" value={plan.summary.variableRemainingCents} />
      <Metric label="Resultado previsto inicial" value={plan.summary.initialSurplusCents} signed /></section>
    <nav className="section-nav plan-nav" aria-label="Secciones del plan">{([['forecast', 'Previstos'], ['budgets', 'Presupuestos'], ['distribution', 'Distribución']] as const).map(([value, label]) => <button key={value} aria-pressed={section === value} onClick={() => setSection(value)}>{label}</button>)}</nav>
    {error && <p className="error" role="alert">{error}</p>}
    {section === 'forecast' && <ForecastSection planItems={plan.items} accounts={props.accounts} categories={props.categories} adding={adding} editing={editing}
      onStartAdd={() => { setEditing(undefined); setAdding(true) }} onEdit={(item) => { const stored = props.plannedItems.find((value) => value.id === item.id); if (stored) { setEditing(stored); setAdding(false) } }}
      onCancel={() => { setAdding(false); setEditing(undefined) }} onSave={(input) => run(async () => { if (editing) await props.onUpdateItem(editing.id, input); else await props.onCreateItem(input); setAdding(false); setEditing(undefined) })}
      onMaterialize={(item) => run(() => props.onMaterialize(item))} onToggle={(item, status) => run(() => item.source === 'recurring' ? props.onSetRecurringStatus(item.recurringRuleId!, item.date, status) : props.onSetItemStatus(item.id, status))}
      onDelete={(item) => { if (window.confirm(`¿Eliminar el previsto “${item.concept}”?`)) void run(() => props.onDeleteItem(item.id)) }} />}
    {section === 'budgets' && <BudgetSection key={month} month={month} progress={plan.budgets} categories={props.categories} onSave={(categoryId, amount) => run(() => props.onSetBudget(month, categoryId, amount))} />}
    {section === 'distribution' && <DistributionSection key={`${month}-${monthlyPlan?.updatedAt ?? 'new'}`} month={month} summary={plan.summary} current={monthlyPlan} onSave={(savings, investment) => run(() => props.onSetDistribution(month, savings, investment))} />}
  </div>
}

function ForecastSection({ planItems, accounts, categories, adding, editing, onStartAdd, onEdit, onCancel, onSave, onMaterialize, onToggle, onDelete }: {
  planItems: PlanItemView[]; accounts: Account[]; categories: Category[]; adding: boolean; editing?: PlannedItem
  onStartAdd(): void; onEdit(item: PlanItemView): void; onCancel(): void; onSave(input: PlannedItemInput): Promise<void>
  onMaterialize(item: PlanItemView): Promise<void>; onToggle(item: PlanItemView, status: PlannedItem['status']): Promise<void>; onDelete(item: PlanItemView): void
}) {
  return <section className="plan-section"><div className="section-title"><h2>Ingresos y gastos previstos</h2><span>{planItems.length}</span><button className="text-action" onClick={onStartAdd}>Añadir</button></div>
    {(adding || editing) && <div className="card"><PlannedItemForm item={editing} accounts={accounts} categories={categories} onSave={onSave} onCancel={onCancel} /></div>}
    {planItems.length === 0 ? <p className="empty">No hay previstos para este mes. Puedes añadir uno o configurar una recurrencia.</p> : <ul className="plan-items">{planItems.map((item) => <li key={item.id} className={item.status}><div><strong>{item.concept}</strong><small>{shortDate(item.date)} · {item.source === 'recurring' ? 'Recurrente' : 'Manual'} · {statusLabel(item.status)}</small></div><strong className={item.kind}>{item.kind === 'expense' ? '−' : '+'}{formatEuro(item.amountCents)}</strong><div className="plan-item-actions">{item.status === 'pending' && <><button className="text-action" onClick={() => void onMaterialize(item)}>{item.kind === 'expense' ? 'Marcar pagado' : 'Marcar recibido'}</button><button className="text-action muted" onClick={() => void onToggle(item, 'omitted')}>Omitir</button></>}
      {item.status === 'omitted' && <button className="text-action" onClick={() => void onToggle(item, 'pending')}>Reactivar</button>}{item.source === 'manual' && item.status !== 'realized' && <><button className="text-action" onClick={() => onEdit(item)}>Editar</button><button className="delete" onClick={() => onDelete(item)}>Eliminar</button></>}</div></li>)}</ul>}
  </section>
}

function PlannedItemForm({ item, accounts, categories, onSave, onCancel }: { item?: PlannedItem; accounts: Account[]; categories: Category[]; onSave(input: PlannedItemInput): Promise<void>; onCancel(): void }) {
  const [kind, setKind] = useState<'income' | 'expense'>(item?.kind ?? 'expense'); const [amount, setAmount] = useState(item ? (item.amountCents / 100).toFixed(2) : '')
  const [concept, setConcept] = useState(item?.concept ?? ''); const [note, setNote] = useState(item?.note ?? ''); const [date, setDate] = useState(item?.date ?? localDateOnly())
  const activeAccounts = accounts.filter((value) => !value.archivedAt || value.id === item?.accountId); const matchingCategories = categories.filter((value) => value.kind === kind && (!value.archivedAt || value.id === item?.categoryId))
  const [accountId, setAccountId] = useState(item?.accountId ?? activeAccounts[0]?.id ?? ''); const [categoryId, setCategoryId] = useState(item?.categoryId ?? '')
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await onSave({ kind, amountCents: parseEuroToCents(amount), concept: concept.trim(), note: note.trim(), date, accountId, categoryId }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el previsto.') } finally { setSaving(false) } }
  return <form className="compact-form" onSubmit={submit} aria-label={item ? 'Editar previsto' : 'Nuevo previsto'}><div className="segmented"><button type="button" aria-pressed={kind === 'expense'} onClick={() => { setKind('expense'); setCategoryId('') }}>Gasto</button><button type="button" aria-pressed={kind === 'income'} onClick={() => { setKind('income'); setCategoryId('') }}>Ingreso</button></div>
    <label>Concepto<input value={concept} onChange={(event) => setConcept(event.target.value)} maxLength={120} required /></label><label>Importe<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /></label>
    <label>Cuenta<select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="">Selecciona…</option>{activeAccounts.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
    <label>Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="">Selecciona…</option>{matchingCategories.map((value) => <option key={value.id} value={value.id}>{value.icon} {value.name}</option>)}</select></label>
    <label>Fecha prevista<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label>Nota opcional<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} /></label>
    {error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button disabled={saving}>{saving ? 'Guardando…' : 'Guardar previsto'}</button></div></form>
}

function BudgetSection({ month, progress, categories, onSave }: { month: string; progress: ReturnType<typeof buildMonthlyPlan>['budgets']; categories: Category[]; onSave(categoryId: string, amount: number): Promise<void> }) {
  const expenseCategories = categories.filter((item) => item.kind === 'expense' && !item.archivedAt); const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? ''); const [amount, setAmount] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await onSave(categoryId, parseEuroToCents(amount)); setAmount('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el presupuesto.') } finally { setSaving(false) } }
  const names = new Map(categories.map((item) => [item.id, `${item.icon} ${item.name}`]))
  return <section className="plan-section"><h2>Presupuesto variable · {monthLabel(month)}</h2><form className="card compact-form budget-form" onSubmit={submit}><label>Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>{expenseCategories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label><label>Presupuesto<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /></label><small>Guarda 0 para retirar el presupuesto de la categoría.</small>{error && <p className="error" role="alert">{error}</p>}<button disabled={saving}>{saving ? 'Guardando…' : 'Guardar presupuesto'}</button></form>
    {progress.length === 0 ? <p className="empty">Todavía no hay presupuestos variables para este mes.</p> : <ul className="budget-list">{progress.map(({ budget, spentCents, remainingCents, overspentCents, percentage }) => { const exceeded = overspentCents > 0; return <li key={budget.id}><button className="budget-main" onClick={() => { setCategoryId(budget.categoryId); setAmount((budget.amountCents / 100).toFixed(2)) }}><strong>{names.get(budget.categoryId) ?? 'Categoría'}</strong><span>{formatEuro(spentCents)} de {formatEuro(budget.amountCents)}</span><progress className={exceeded ? 'over-budget' : ''} max={100} value={Math.min(percentage, 100)} aria-label={exceeded ? `Presupuesto excedido en ${formatEuro(overspentCents)}; ${percentage}% consumido` : `${percentage}% consumido`} /><small className={exceeded ? 'over-budget' : ''}>{exceeded ? `Excedido en ${formatEuro(overspentCents)}` : `${formatEuro(remainingCents)} disponible`} · {percentage}% consumido</small></button></li> })}</ul>}
  </section>
}

function DistributionSection({ month, summary, current, onSave }: { month: string; summary: ReturnType<typeof buildMonthlyPlan>['summary']; current?: MonthlyPlan; onSave(savings: number, investment: number): Promise<void> }) {
  const [savings, setSavings] = useState(current ? (current.savingsAllocationCents / 100).toFixed(2) : '0,00'); const [investment, setInvestment] = useState(current ? (current.investmentAllocationCents / 100).toFixed(2) : '0,00'); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await onSave(parseEuroToCents(savings), parseEuroToCents(investment)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la distribución.') } finally { setSaving(false) } }
  return <section className="plan-section"><h2>Distribución prevista · {monthLabel(month)}</h2><p className="management-intro">Es una intención: no mueve dinero ni cambia el patrimonio.</p><form className="card compact-form" onSubmit={submit}><label>Ahorro<input inputMode="decimal" value={savings} onChange={(event) => setSavings(event.target.value)} /></label><label>Inversión<input inputMode="decimal" value={investment} onChange={(event) => setInvestment(event.target.value)} /></label>{error && <p className="error" role="alert">{error}</p>}<button disabled={saving}>{saving ? 'Guardando…' : 'Guardar distribución'}</button></form>
    <div className="distribution-summary"><Metric label="Proyectado" value={summary.projectedSurplusCents} signed /><Metric label="Ahorro" value={summary.savingsAllocationCents} /><Metric label="Inversión" value={summary.investmentAllocationCents} /><Metric label="Sin asignar" value={summary.unallocatedCents} signed /></div><p className="phase-note">La asignación a objetivos se añadirá en Fase 6.</p></section>
}

function Metric({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) { return <div><span>{label}</span><strong className={value < 0 ? 'negative' : ''}>{signed ? formatSigned(value) : formatEuro(value)}</strong></div> }
function formatSigned(value: number): string { return `${value < 0 ? '−' : '+'}${formatEuro(Math.abs(value))}` }
function monthLabel(month: string): string { return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)) }
function shortDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }
function statusLabel(status: PlanItemView['status']): string { return status === 'pending' ? 'Pendiente' : status === 'realized' ? 'Realizado' : 'Omitido' }

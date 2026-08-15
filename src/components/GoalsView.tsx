import { useMemo, useState, type FormEvent } from 'react'
import { localDateOnly } from '../domain/dates'
import { buildGoalPortfolio, type GoalProgress } from '../domain/goals'
import { formatEuro, parseEuroToCents } from '../domain/money'
import type { Goal, GoalAllocation, GoalAllocationInput, GoalInput } from '../domain/types'

interface Props {
  goals: Goal[]
  allocations: GoalAllocation[]
  netWorthCents: number
  onCreate(input: GoalInput, initialAmountCents: number): Promise<void>
  onUpdate(id: string, input: GoalInput): Promise<void>
  onSetCompleted(id: string, completed: boolean): Promise<void>
  onArchive(id: string): Promise<void>
  onRestore(id: string): Promise<void>
  onAllocate(goalId: string, input: GoalAllocationInput): Promise<void>
}

export function GoalsView(props: Props) {
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string>()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const portfolio = useMemo(() => buildGoalPortfolio(props.goals, props.allocations, props.netWorthCents, localDateOnly()),
    [props.goals, props.allocations, props.netWorthCents])
  const selected = portfolio.goals.find((item) => item.goal.id === selectedId)
  async function run(action: () => Promise<void>) {
    setError('')
    try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar la acción.') }
  }

  if (selected) return <GoalDetail progress={selected} editing={editing} error={error}
    onBack={() => { setSelectedId(undefined); setEditing(false); setError('') }} onEdit={() => setEditing(true)}
    onCancelEdit={() => setEditing(false)} onUpdate={(input) => run(async () => { await props.onUpdate(selected.goal.id, input); setEditing(false) })}
    onAllocate={(input) => run(() => props.onAllocate(selected.goal.id, input))}
    onSetCompleted={(completed) => run(() => props.onSetCompleted(selected.goal.id, completed))}
    onArchive={() => run(async () => { await props.onArchive(selected.goal.id); setSelectedId(undefined) })} />

  const current = portfolio.goals.filter((item) => !item.goal.archivedAt)
  const archived = portfolio.goals.filter((item) => item.goal.archivedAt)
  return <div className="goals-view">
    <section className="card goals-hero"><span>Asignado a objetivos</span><strong>{formatEuro(portfolio.reservedCents)}</strong>
      <div><small>Patrimonio total<br /><b>{formatEuro(props.netWorthCents)}</b></small><small>Sin asignar<br /><b className={portfolio.unassignedNetWorthCents < 0 ? 'negative' : ''}>{formatEuro(portfolio.unassignedNetWorthCents)}</b></small></div>
      {portfolio.unassignedNetWorthCents < 0 && <p>Hay más dinero asignado a objetivos que patrimonio registrado.</p>}</section>
    <div className="section-title"><h2>Objetivos</h2><span>{current.length}</span><button className="text-action" onClick={() => setCreating(true)}>Nuevo</button></div>
    {creating && <div className="card"><GoalForm onSave={(input, initial) => run(async () => { await props.onCreate(input, initial); setCreating(false) })} onCancel={() => setCreating(false)} /></div>}
    {error && <p className="error" role="alert">{error}</p>}
    {current.length === 0 && !creating ? <p className="empty">Todavía no hay objetivos. Crea uno para reservar una parte del patrimonio sin mover dinero.</p>
      : <GoalList items={current} onOpen={(id) => setSelectedId(id)} />}
    {archived.length > 0 && <section className="archived-goals"><h2>Archivados</h2><ul className="goal-list">{archived.map((item) => <li key={item.goal.id} className="archived">
      <div><strong>{item.goal.icon} {item.goal.name}</strong><small>{formatEuro(item.assignedCents)} asignados</small></div>
      <button className="restore" onClick={() => void run(() => props.onRestore(item.goal.id))}>Desarchivar</button></li>)}</ul></section>}
  </div>
}

function GoalList({ items, onOpen }: { items: GoalProgress[]; onOpen(id: string): void }) {
  return <ul className="goal-list">{items.map((item) => <li key={item.goal.id}><button className="goal-main" onClick={() => onOpen(item.goal.id)}>
    <span className="goal-icon" aria-hidden="true">{item.goal.icon}</span><span><strong>{item.goal.name}</strong><small>{item.goal.completedAt ? 'Completado' : targetText(item.goal.targetDate)}</small></span>
    <strong>{formatEuro(item.assignedCents)}<small>de {formatEuro(item.goal.targetAmountCents)}</small></strong>
    <progress max={100} value={Math.min(Math.max(item.percentage, 0), 100)} aria-label={`${item.goal.name}: ${item.percentage}% completado`} />
    <small className="goal-progress-text">{item.overallocatedCents > 0 ? `Supera el objetivo en ${formatEuro(item.overallocatedCents)}` : `Faltan ${formatEuro(item.remainingCents)}`} · {item.percentage}%</small>
  </button></li>)}</ul>
}

function GoalDetail({ progress, editing, error, onBack, onEdit, onCancelEdit, onUpdate, onAllocate, onSetCompleted, onArchive }: {
  progress: GoalProgress; editing: boolean; error: string; onBack(): void; onEdit(): void; onCancelEdit(): void
  onUpdate(input: GoalInput): Promise<void>; onAllocate(input: GoalAllocationInput): Promise<void>
  onSetCompleted(completed: boolean): Promise<void>; onArchive(): Promise<void>
}) {
  const goal = progress.goal
  return <div className="goal-detail"><button className="back-link" onClick={onBack}>‹ Todos los objetivos</button>
    <section className="card goal-detail-hero"><span className="goal-icon large" aria-hidden="true">{goal.icon}</span><div><small>{goal.completedAt ? 'Objetivo completado' : 'Objetivo activo'}</small><h2>{goal.name}</h2></div>
      <strong>{formatEuro(progress.assignedCents)}</strong><span>de {formatEuro(goal.targetAmountCents)}</span>
      <progress max={100} value={Math.min(Math.max(progress.percentage, 0), 100)} aria-label={`${progress.percentage}% completado`} />
      <p>{progress.overallocatedCents > 0 ? `Supera la meta en ${formatEuro(progress.overallocatedCents)}.` : `Faltan ${formatEuro(progress.remainingCents)}.`}</p></section>
    <section className="goal-stats" aria-label="Progreso del objetivo"><Metric label="Fecha objetivo" value={goal.targetDate ? formatDate(goal.targetDate) : 'Sin fecha'} />
      <Metric label="Ritmo mensual" value={progress.monthlyAverageCents === null ? 'Aún sin datos' : formatEuro(progress.monthlyAverageCents)} />
      <Metric label="Estimación" value={progress.estimatedCompletionMonth ? formatMonth(progress.estimatedCompletionMonth) : progress.remainingCents === 0 ? 'Conseguido' : 'Aún sin datos'} /></section>
    {goal.note && <p className="card goal-note">{goal.note}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {editing ? <div className="card"><GoalForm goal={goal} onSave={(input) => onUpdate(input)} onCancel={onCancelEdit} /></div> : <div className="goal-actions">
      <button className="secondary-action" onClick={onEdit}>Editar</button><button className="secondary-action" onClick={() => void onSetCompleted(!goal.completedAt)}>{goal.completedAt ? 'Reabrir' : 'Completar'}</button>
      <button className="secondary-action danger" onClick={() => { if (window.confirm(`¿Archivar “${goal.name}”? La asignación dejará de reservar patrimonio.`)) void onArchive() }}>Archivar</button></div>}
    {!goal.completedAt && <AllocationForm assignedCents={progress.assignedCents} onSave={onAllocate} />}
    <section className="allocation-history"><h2>Historial</h2>{progress.allocations.length === 0 ? <p className="empty">Todavía no hay aportaciones.</p> : <ul>{progress.allocations.map((item) => <li key={item.id}>
      <div><strong>{item.amountCents > 0 ? 'Aportación' : 'Retirada'}</strong><small>{formatDate(item.date)} · {item.createdBy === 'david' ? 'David' : 'Esther'}{item.note ? ` · ${item.note}` : ''}</small></div>
      <strong className={item.amountCents < 0 ? 'negative' : ''}>{item.amountCents > 0 ? '+' : '−'}{formatEuro(Math.abs(item.amountCents))}</strong></li>)}</ul>}</section>
  </div>
}

function GoalForm({ goal, onSave, onCancel }: { goal?: Goal; onSave(input: GoalInput, initialAmountCents: number): Promise<void>; onCancel(): void }) {
  const [name, setName] = useState(goal?.name ?? ''); const [target, setTarget] = useState(goal ? (goal.targetAmountCents / 100).toFixed(2) : '')
  const [initial, setInitial] = useState(''); const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? '🎯'); const [note, setNote] = useState(goal?.note ?? '')
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try {
    const initialAmount = goal || !initial.trim() || /^0+(?:[,.]0{0,2})?$/.test(initial.trim()) ? 0 : parseEuroToCents(initial)
    await onSave({ name: name.trim(), targetAmountCents: parseEuroToCents(target), targetDate: targetDate || null, icon: icon.trim(), note: note.trim() }, initialAmount)
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el objetivo.') } finally { setSaving(false) } }
  return <form className="compact-form" onSubmit={submit} aria-label={goal ? 'Editar objetivo' : 'Nuevo objetivo'}><h2>{goal ? 'Editar objetivo' : 'Nuevo objetivo'}</h2>
    <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
    <label>Importe objetivo<input inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0,00" required /></label>
    {!goal && <label>Importe inicial opcional<input inputMode="decimal" value={initial} onChange={(event) => setInitial(event.target.value)} placeholder="0,00" /></label>}
    <label>Fecha objetivo opcional<input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
    <label>Icono<input value={icon} onChange={(event) => setIcon(event.target.value)} maxLength={12} required /></label>
    <label>Nota opcional<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} /></label>
    {error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button disabled={saving}>{saving ? 'Guardando…' : 'Guardar objetivo'}</button></div></form>
}

function AllocationForm({ assignedCents, onSave }: { assignedCents: number; onSave(input: GoalAllocationInput): Promise<void> }) {
  const [direction, setDirection] = useState<'add' | 'withdraw'>('add'); const [amount, setAmount] = useState('')
  const [date, setDate] = useState(localDateOnly()); const [note, setNote] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try {
    const absolute = parseEuroToCents(amount); const amountCents = direction === 'withdraw' ? -absolute : absolute
    if (amountCents < 0 && absolute > assignedCents) throw new Error('No puedes retirar más dinero del asignado.')
    await onSave({ amountCents, date, note: note.trim() }); setAmount(''); setNote('')
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la asignación.') } finally { setSaving(false) } }
  return <form className="card compact-form allocation-form" onSubmit={submit} aria-label="Cambiar asignación"><h2>Cambiar asignación</h2>
    <div className="segmented" role="group" aria-label="Tipo de asignación"><button type="button" aria-pressed={direction === 'add'} onClick={() => setDirection('add')}>+ Aportar</button><button type="button" aria-pressed={direction === 'withdraw'} onClick={() => setDirection('withdraw')}>− Retirar</button></div>
    <label>Importe<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /></label>
    <label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
    <label>Nota opcional<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /></label>
    {error && <p className="error" role="alert">{error}</p>}<button disabled={saving}>{saving ? 'Guardando…' : direction === 'add' ? 'Guardar aportación' : 'Guardar retirada'}</button></form>
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
function targetText(value: string | null): string { return value ? `Meta: ${formatDate(value)}` : 'Sin fecha objetivo' }
function formatDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }
function formatMonth(value: string): string { return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`)) }

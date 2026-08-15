import { useMemo, useState, type FormEvent } from 'react'
import { localDateOnly } from '../domain/dates'
import { formatEuro, parseEuroToCents } from '../domain/money'
import { upcomingOccurrences } from '../domain/recurrence'
import type { Account, Category, RecurrenceFrequency, RecurringRule, RecurringRuleInput, Transaction } from '../domain/types'

interface Props {
  rules: RecurringRule[]
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  onCreate(input: RecurringRuleInput): Promise<void>
  onUpdate(id: string, input: RecurringRuleInput): Promise<void>
  onSetActive(id: string, active: boolean): Promise<void>
  onMaterialize(ruleId: string, date: string): Promise<void>
}

export function RecurringManager({ rules, transactions, accounts, categories, onCreate, onUpdate, onSetActive, onMaterialize }: Props) {
  const [editing, setEditing] = useState<RecurringRule>()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  async function run(action: () => Promise<void>) {
    setError(''); try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar la acción.') }
  }
  return <section className="management recurring-management"><div className="section-title"><h2>Reglas recurrentes</h2><span>{rules.length}</span><button className="text-action" onClick={() => { setEditing(undefined); setAdding(true) }}>Nueva</button></div>
    <p className="management-intro">Prepara ingresos y gastos futuros. Registrar una ocurrencia siempre reutiliza el mismo identificador para evitar duplicados.</p>
    {(adding || editing) && <div className="card"><RecurringRuleForm rule={editing} accounts={accounts} categories={categories} onCancel={() => { setAdding(false); setEditing(undefined) }} onSave={async (input) => run(async () => {
      if (editing) await onUpdate(editing.id, input); else await onCreate(input)
      setAdding(false); setEditing(undefined)
    })} /></div>}
    {error && <p className="error" role="alert">{error}</p>}
    {rules.length === 0 ? <p className="empty">Todavía no hay recurrencias.</p> : <ul>{rules.map((rule) => {
      const occurrences = upcomingOccurrences(rule, transactions, localDateOnly(), 4)
      return <li key={rule.id} className={rule.active ? 'recurring-rule' : 'recurring-rule archived'}><div className="recurring-rule-body"><button className="management-main" onClick={() => { setAdding(false); setEditing(rule) }}><strong>{rule.concept}</strong><small>{formatEuro(rule.amountCents)} · {frequencyLabel(rule.frequency)} · {rule.active ? 'Activa' : 'Pausada'}</small></button>
        {rule.active && <div className="occurrence-list" aria-label={`Próximas ocurrencias de ${rule.concept}`}>{occurrences.length === 0 ? <small>Sin próximas fechas</small> : occurrences.map((occurrence) => <div key={occurrence.date}><span>{formatDate(occurrence.date)}</span>{occurrence.status === 'realized' ? <strong>Registrada</strong> : <button className="text-action" onClick={() => void run(() => onMaterialize(rule.id, occurrence.date))}>Registrar</button>}</div>)}</div>}
      </div><div className="management-actions"><button className={rule.active ? 'delete' : 'restore'} onClick={() => void run(() => onSetActive(rule.id, !rule.active))}>{rule.active ? 'Pausar' : 'Reactivar'}</button></div></li>
    })}</ul>}
  </section>
}

function RecurringRuleForm({ rule, accounts, categories, onSave, onCancel }: {
  rule?: RecurringRule; accounts: Account[]; categories: Category[]; onSave(input: RecurringRuleInput): Promise<void>; onCancel(): void
}) {
  const [kind, setKind] = useState<'income' | 'expense'>(rule?.kind ?? 'expense')
  const [amount, setAmount] = useState(rule ? (rule.amountCents / 100).toFixed(2) : '')
  const [concept, setConcept] = useState(rule?.concept ?? '')
  const [note, setNote] = useState(rule?.note ?? '')
  const [accountId, setAccountId] = useState(rule?.accountId ?? '')
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule?.frequency ?? 'monthly')
  const [startDate, setStartDate] = useState(rule?.startDate ?? localDateOnly())
  const [endDate, setEndDate] = useState(rule?.endDate ?? '')
  const [saving, setSaving] = useState(false); const [error, setError] = useState('')
  const activeAccounts = useMemo(() => accounts.filter((item) => !item.archivedAt || item.id === rule?.accountId), [accounts, rule])
  const matchingCategories = useMemo(() => categories.filter((item) => item.kind === kind && (!item.archivedAt || item.id === rule?.categoryId)), [categories, kind, rule])
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { await onSave({ kind, amountCents: parseEuroToCents(amount), concept: concept.trim(), note: note.trim(), accountId, categoryId, frequency, startDate, endDate: endDate || null }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la recurrencia.') }
    finally { setSaving(false) }
  }
  return <form className="compact-form" onSubmit={submit} aria-label={rule ? 'Editar recurrencia' : 'Nueva recurrencia'}><div className="segmented"><button type="button" aria-pressed={kind === 'expense'} onClick={() => { setKind('expense'); setCategoryId('') }}>Gasto</button><button type="button" aria-pressed={kind === 'income'} onClick={() => { setKind('income'); setCategoryId('') }}>Ingreso</button></div>
    <label>Concepto<input value={concept} onChange={(event) => setConcept(event.target.value)} maxLength={120} required /></label>
    <label>Importe<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /></label>
    <label>Cuenta<select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="">Selecciona…</option>{activeAccounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="">Selecciona…</option>{matchingCategories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}</select></label>
    <label>Frecuencia<select value={frequency} onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}><option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="annual">Anual</option></select></label>
    <label>Próxima fecha<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
    <label>Fecha final opcional<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
    <label>Nota opcional<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} /></label>
    {error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button></div></form>
}

function frequencyLabel(value: RecurrenceFrequency): string { return value === 'monthly' ? 'Mensual' : value === 'quarterly' ? 'Trimestral' : 'Anual' }
function formatDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }

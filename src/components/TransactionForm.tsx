import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { localDateOnly } from '../domain/dates'
import { parseEuroToCents } from '../domain/money'
import { nextRecurringDate } from '../domain/recurrence'
import type { Account, Category, RecurrenceFrequency, RecurringRuleInput, Transaction, TransactionInput, TransactionKind } from '../domain/types'

interface Props {
  transaction?: Transaction
  initialKind?: TransactionKind
  initialAccountId?: string
  accounts: Account[]
  categories: Category[]
  onSave(input: TransactionInput, recurrence?: RecurringRuleInput): Promise<void>
  onCancel?(): void
}

export function TransactionForm({ transaction, initialKind, initialAccountId, accounts, categories, onSave, onCancel }: Props) {
  const activeAccounts = useMemo(() => accounts.filter((item) => !item.archivedAt), [accounts])
  const [kind, setKind] = useState<TransactionKind>(transaction?.kind ?? initialKind ?? 'expense')
  const [amount, setAmount] = useState(transaction ? (Math.abs(transaction.amountCents) / 100).toFixed(2) : '')
  const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>(transaction?.kind === 'adjustment' && transaction.amountCents < 0 ? 'decrease' : 'increase')
  const [concept, setConcept] = useState(transaction?.concept ?? '')
  const [note, setNote] = useState(transaction?.note ?? '')
  const [date, setDate] = useState(transaction?.date ?? localDateOnly())
  const [accountId, setAccountId] = useState(transaction?.accountId ?? initialAccountId ?? activeAccounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '')
  const [sourceAccountId, setSourceAccountId] = useState(transaction?.sourceAccountId ?? '')
  const [destinationAccountId, setDestinationAccountId] = useState(transaction?.destinationAccountId ?? '')
  const [repeats, setRepeats] = useState(false)
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly')
  const [nextDate, setNextDate] = useState(nextRecurringDate(transaction?.date ?? localDateOnly(), 'monthly'))
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const matchingCategories = categories.filter((item) => !item.archivedAt && item.kind === kind)

  useEffect(() => {
    if (!transaction) return
    setKind(transaction.kind); setAmount((Math.abs(transaction.amountCents) / 100).toFixed(2)); setConcept(transaction.concept); setNote(transaction.note)
    setAdjustmentDirection(transaction.kind === 'adjustment' && transaction.amountCents < 0 ? 'decrease' : 'increase')
    setDate(transaction.date); setAccountId(transaction.accountId ?? ''); setCategoryId(transaction.categoryId ?? '')
    setSourceAccountId(transaction.sourceAccountId ?? ''); setDestinationAccountId(transaction.destinationAccountId ?? '')
  }, [transaction])

  useEffect(() => {
    if ((kind === 'income' || kind === 'expense') && !matchingCategories.some((item) => item.id === categoryId)) setCategoryId(matchingCategories[0]?.id ?? '')
  }, [categoryId, kind, matchingCategories])

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSaving(true)
    try {
      const absoluteAmountCents = parseEuroToCents(amount)
      const amountCents = kind === 'adjustment' && adjustmentDirection === 'decrease' ? -absoluteAmountCents : absoluteAmountCents
      const transactionInput: TransactionInput = { kind, amountCents, concept: concept.trim(), note: note.trim(), date,
        accountId: kind === 'transfer' ? null : accountId || null,
        categoryId: kind === 'income' || kind === 'expense' ? categoryId || null : null,
        sourceAccountId: kind === 'transfer' ? sourceAccountId || null : null,
        destinationAccountId: kind === 'transfer' ? destinationAccountId || null : null }
      const recurrence = repeats && !transaction && (kind === 'income' || kind === 'expense') ? {
        kind, amountCents, concept: concept.trim(), note: note.trim(), accountId, categoryId, frequency,
        startDate: nextDate, endDate: endDate || null,
      } satisfies RecurringRuleInput : undefined
      if (recurrence) await onSave(transactionInput, recurrence); else await onSave(transactionInput)
      if (!transaction) { setAmount(''); setConcept(''); setNote('') }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el movimiento.') }
    finally { setSaving(false) }
  }

  if (activeAccounts.length === 0) return <p className="empty">Crea una cuenta antes de registrar movimientos.</p>

  return <form className="movement-form" onSubmit={submit} aria-label={transaction ? 'Editar movimiento' : 'Añadir movimiento'}>
    {kind === 'adjustment' ? <p className="form-context">Ajuste manual de saldo</p> : <div className="segmented movement-kinds" role="group" aria-label="Tipo de movimiento">
      {([['expense', 'Gasto'], ['income', 'Ingreso'], ['transfer', 'Transferencia']] as const)
        .map(([value, label]) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}
    </div>}
    {kind === 'adjustment' && <div className="segmented adjustment-direction" role="group" aria-label="Efecto del ajuste">
      <button type="button" aria-pressed={adjustmentDirection === 'increase'} onClick={() => setAdjustmentDirection('increase')}>+ Sumar saldo</button>
      <button type="button" aria-pressed={adjustmentDirection === 'decrease'} onClick={() => setAdjustmentDirection('decrease')}>− Restar saldo</button>
    </div>}
    <label htmlFor="movement-amount">Importe</label>
    <div className="amount-field"><input id="movement-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /><span>€</span></div>
    <label htmlFor="movement-concept">Concepto<input id="movement-concept" value={concept} onChange={(event) => setConcept(event.target.value)} maxLength={120} required placeholder="Compra, nómina…" /></label>
    {kind === 'transfer' ? <div className="field-grid">
      <Select label="Cuenta origen" value={sourceAccountId} onChange={setSourceAccountId} accounts={activeAccounts} />
      <Select label="Cuenta destino" value={destinationAccountId} onChange={setDestinationAccountId} accounts={activeAccounts} />
    </div> : <Select label="Cuenta" value={accountId} onChange={setAccountId} accounts={activeAccounts} />}
    {(kind === 'income' || kind === 'expense') && <label>Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
      <option value="">Selecciona…</option>{matchingCategories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
    </select></label>}
    <label htmlFor="movement-date">Fecha<input id="movement-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
    {!transaction && (kind === 'income' || kind === 'expense') && <div className="recurrence-fields">
      <label className="check"><input type="checkbox" checked={repeats} onChange={(event) => { const checked = event.target.checked; setRepeats(checked); if (checked) setNextDate(nextRecurringDate(date, frequency)) }} /><span>Se repite</span></label>
      {repeats && <div className="recurrence-options"><label>Frecuencia<select value={frequency} onChange={(event) => {
        const value = event.target.value as RecurrenceFrequency; setFrequency(value); setNextDate(nextRecurringDate(date, value))
      }}><option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="annual">Anual</option></select></label>
        <label>Próxima fecha<input type="date" value={nextDate} min={date} onChange={(event) => setNextDate(event.target.value)} required /></label>
        <label>Fecha final opcional<input type="date" value={endDate} min={nextDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <small>Este movimiento se registra ahora y las próximas ocurrencias se preparan sin duplicados.</small></div>}
    </div>}
    <details className="optional-fields" open={Boolean(note)}><summary>Nota opcional</summary><label htmlFor="movement-note">Nota<textarea id="movement-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Información adicional…" /></label></details>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="form-actions">{onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}
      <button type="submit" disabled={saving}>{saving ? 'Guardando…' : transaction ? 'Guardar cambios' : 'Guardar movimiento'}</button></div>
  </form>
}

function Select({ label, value, onChange, accounts }: { label: string; value: string; onChange(value: string): void; accounts: Account[] }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)} required><option value="">Selecciona…</option>
    {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
}

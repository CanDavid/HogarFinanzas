import { useEffect, useState, type FormEvent } from 'react'
import { formatEuro, parseEuroToCents } from '../domain/money'
import type { Transaction, TransactionInput } from '../domain/types'

interface Props {
  transaction?: Transaction
  onSave(input: TransactionInput): Promise<void>
  onCancel?(): void
}

export function TransactionForm({ transaction, onSave, onCancel }: Props) {
  const [kind, setKind] = useState<'income' | 'expense'>(transaction?.kind === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState(transaction ? (transaction.amountCents / 100).toFixed(2) : '')
  const [concept, setConcept] = useState(transaction?.concept ?? '')
  const [date, setDate] = useState(transaction?.date ?? today())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!transaction) return
    setKind(transaction.kind === 'income' ? 'income' : 'expense')
    setAmount((transaction.amountCents / 100).toFixed(2))
    setConcept(transaction.concept)
    setDate(transaction.date)
  }, [transaction])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSave({ kind, amountCents: parseEuroToCents(amount), concept: concept.trim(), date })
      if (!transaction) {
        setAmount('')
        setConcept('')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el movimiento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="movement-form" onSubmit={submit} aria-label={transaction ? 'Editar movimiento' : 'Añadir movimiento'}>
      <div className="segmented" role="group" aria-label="Tipo de movimiento">
        <button type="button" aria-pressed={kind === 'expense'} onClick={() => setKind('expense')}>Gasto</button>
        <button type="button" aria-pressed={kind === 'income'} onClick={() => setKind('income')}>Ingreso</button>
      </div>
      <label htmlFor="movement-amount">Importe</label>
      <div className="amount-field"><input id="movement-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" required /><span>€</span></div>
      <label htmlFor="movement-concept">
        Concepto
        <input id="movement-concept" value={concept} onChange={(event) => setConcept(event.target.value)} maxLength={120} required placeholder="Compra, nómina…" />
      </label>
      <label htmlFor="movement-date">
        Fecha
        <input id="movement-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-actions">
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}
        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : transaction ? `Guardar ${formatEuro(transaction.amountCents)}` : 'Guardar movimiento'}</button>
      </div>
    </form>
  )
}

function today(): string { return new Date().toISOString().slice(0, 10) }

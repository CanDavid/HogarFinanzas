import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatEuro, parseEuroToCents, parseSignedEuroToCents } from '../domain/money'
import type { Account, Category, Transaction, TransactionInput, TransactionKind } from '../domain/types'

interface Props {
  transaction?: Transaction
  accounts: Account[]
  categories: Category[]
  onSave(input: TransactionInput): Promise<void>
  onCancel?(): void
}

export function TransactionForm({ transaction, accounts, categories, onSave, onCancel }: Props) {
  const activeAccounts = useMemo(() => accounts.filter((item) => !item.archivedAt), [accounts])
  const [kind, setKind] = useState<TransactionKind>(transaction?.kind ?? 'expense')
  const [amount, setAmount] = useState(transaction ? (transaction.amountCents / 100).toFixed(2) : '')
  const [concept, setConcept] = useState(transaction?.concept ?? '')
  const [date, setDate] = useState(transaction?.date ?? today())
  const [accountId, setAccountId] = useState(transaction?.accountId ?? activeAccounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? '')
  const [sourceAccountId, setSourceAccountId] = useState(transaction?.sourceAccountId ?? '')
  const [destinationAccountId, setDestinationAccountId] = useState(transaction?.destinationAccountId ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const matchingCategories = categories.filter((item) => !item.archivedAt && item.kind === kind)

  useEffect(() => {
    if (!transaction) return
    setKind(transaction.kind); setAmount((transaction.amountCents / 100).toFixed(2)); setConcept(transaction.concept)
    setDate(transaction.date); setAccountId(transaction.accountId ?? ''); setCategoryId(transaction.categoryId ?? '')
    setSourceAccountId(transaction.sourceAccountId ?? ''); setDestinationAccountId(transaction.destinationAccountId ?? '')
  }, [transaction])

  useEffect(() => {
    if ((kind === 'income' || kind === 'expense') && !matchingCategories.some((item) => item.id === categoryId)) setCategoryId(matchingCategories[0]?.id ?? '')
  }, [categoryId, kind, matchingCategories])

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSaving(true)
    try {
      await onSave({ kind, amountCents: kind === 'adjustment' ? parseSignedEuroToCents(amount) : parseEuroToCents(amount), concept: concept.trim(), date,
        accountId: kind === 'transfer' ? null : accountId || null,
        categoryId: kind === 'income' || kind === 'expense' ? categoryId || null : null,
        sourceAccountId: kind === 'transfer' ? sourceAccountId || null : null,
        destinationAccountId: kind === 'transfer' ? destinationAccountId || null : null })
      if (!transaction) { setAmount(''); setConcept('') }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el movimiento.') }
    finally { setSaving(false) }
  }

  if (activeAccounts.length === 0) return <p className="empty">Crea una cuenta antes de registrar movimientos.</p>

  return <form className="movement-form" onSubmit={submit} aria-label={transaction ? 'Editar movimiento' : 'Añadir movimiento'}>
    <div className="segmented four" role="group" aria-label="Tipo de movimiento">
      {([['expense', 'Gasto'], ['income', 'Ingreso'], ['transfer', 'Transferencia'], ['adjustment', 'Ajuste']] as const)
        .map(([value, label]) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</button>)}
    </div>
    <label htmlFor="movement-amount">Importe</label>
    <div className="amount-field"><input id="movement-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={kind === 'adjustment' ? '−50,00 o 50,00' : '0,00'} required /><span>€</span></div>
    <label htmlFor="movement-concept">Concepto<input id="movement-concept" value={concept} onChange={(event) => setConcept(event.target.value)} maxLength={120} required placeholder="Compra, nómina…" /></label>
    {kind === 'transfer' ? <div className="field-grid">
      <Select label="Cuenta origen" value={sourceAccountId} onChange={setSourceAccountId} accounts={activeAccounts} />
      <Select label="Cuenta destino" value={destinationAccountId} onChange={setDestinationAccountId} accounts={activeAccounts} />
    </div> : <Select label="Cuenta" value={accountId} onChange={setAccountId} accounts={activeAccounts} />}
    {(kind === 'income' || kind === 'expense') && <label>Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
      <option value="">Selecciona…</option>{matchingCategories.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
    </select></label>}
    <label htmlFor="movement-date">Fecha<input id="movement-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="form-actions">{onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}
      <button type="submit" disabled={saving}>{saving ? 'Guardando…' : transaction ? `Guardar ${formatEuro(transaction.amountCents)}` : 'Guardar movimiento'}</button></div>
  </form>
}

function Select({ label, value, onChange, accounts }: { label: string; value: string; onChange(value: string): void; accounts: Account[] }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)} required><option value="">Selecciona…</option>
    {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
}

function today(): string { return new Date().toISOString().slice(0, 10) }

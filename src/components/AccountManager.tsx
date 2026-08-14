import { useState, type FormEvent } from 'react'
import { formatEuro, parseSignedEuroToCents } from '../domain/money'
import type { Account, AccountInput, AccountType } from '../domain/types'

export function AccountManager({ accounts, balances, onCreate, onUpdate, onArchive }: {
  accounts: Account[]; balances: ReadonlyMap<string, number>
  onCreate(input: AccountInput): Promise<void>; onUpdate(id: string, input: AccountInput): Promise<void>; onArchive(id: string): Promise<void>
}) {
  const [editing, setEditing] = useState<Account | null>(null)
  return <section className="management"><div className="section-title"><h2>Cuentas</h2><span>{accounts.filter((item) => !item.archivedAt).length}</span></div>
    <AccountForm key={editing?.id ?? 'new'} account={editing} onSave={async (input) => { if (editing) await onUpdate(editing.id, input); else await onCreate(input); setEditing(null) }} onCancel={editing ? () => setEditing(null) : undefined} />
    <ul>{accounts.map((account) => <li key={account.id} className={account.archivedAt ? 'archived' : ''}>
      <button className="management-main" onClick={() => setEditing(account)}><strong>{account.name}</strong><small>{accountTypeLabel(account.type)} · {formatEuro(balances.get(account.id) ?? account.initialBalanceCents)}</small></button>
      {!account.archivedAt && <button className="delete" onClick={() => void onArchive(account.id)}>Archivar</button>}
    </li>)}</ul></section>
}

function AccountForm({ account, onSave, onCancel }: { account: Account | null; onSave(input: AccountInput): Promise<void>; onCancel?(): void }) {
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking')
  const [initial, setInitial] = useState(account ? (account.initialBalanceCents / 100).toFixed(2) : '0,00')
  const [netWorth, setNetWorth] = useState(account?.includeInNetWorth ?? true)
  const [liquidity, setLiquidity] = useState(account?.includeInLiquidity ?? true)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); try {
    await onSave({ name: name.trim(), type, initialBalanceCents: parseSignedEuroToCents(initial), includeInNetWorth: netWorth, includeInLiquidity: liquidity })
    if (!account) { setName(''); setInitial('0,00') }
  } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar.') } }
  return <form className="card compact-form" onSubmit={submit}><h2>{account ? 'Editar cuenta' : 'Nueva cuenta'}</h2>
    <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>
    <label>Tipo<select value={type} onChange={(event) => setType(event.target.value as AccountType)}><option value="checking">Corriente</option><option value="savings">Ahorro</option><option value="investment">Inversión</option><option value="cash">Efectivo</option></select></label>
    <label htmlFor="account-initial-balance">Saldo inicial</label><div className="amount-field"><input id="account-initial-balance" inputMode="decimal" value={initial} onChange={(event) => setInitial(event.target.value)} required /><span>€</span></div>
    <label className="check"><input type="checkbox" checked={netWorth} onChange={(event) => setNetWorth(event.target.checked)} /> Incluir en patrimonio</label>
    <label className="check"><input type="checkbox" checked={liquidity} onChange={(event) => setLiquidity(event.target.checked)} /> Incluir en liquidez</label>
    {error && <p className="error">{error}</p>}<div className="form-actions">{onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}<button>Guardar cuenta</button></div>
  </form>
}

function accountTypeLabel(type: AccountType): string { return ({ checking: 'Corriente', savings: 'Ahorro', investment: 'Inversión', cash: 'Efectivo' })[type] }

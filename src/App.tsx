import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { TransactionForm } from './components/TransactionForm'
import { LocalFinanceRepository } from './data/localFinanceRepository'
import { normalizeDateOnly } from './domain/dates'
import { calculateTotals } from './domain/finance'
import { formatEuro } from './domain/money'
import type { Session, Transaction, TransactionInput, UserId } from './domain/types'
import { AppsScriptClient } from './services/appsScriptClient'
import { SyncEngine } from './services/syncEngine'
import './styles.css'

const repository = new LocalFinanceRepository()

type SyncState = 'idle' | 'syncing' | 'ok' | 'error'

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncMessage, setSyncMessage] = useState('Solo en este dispositivo')
  const [pendingCount, setPendingCount] = useState(0)
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  const refreshLocal = useCallback(async () => {
    const [items, pending, failed] = await Promise.all([repository.listTransactions(), repository.pendingOperations(), repository.failedOperations()])
    setTransactions(items)
    setPendingCount(pending.length)
    if (failed.length > 0) {
      setSyncState('error')
      setSyncMessage(`${failed.length} cambio${failed.length === 1 ? '' : 's'} necesita${failed.length === 1 ? '' : 'n'} revisión`)
    }
  }, [])

  const synchronize = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncState('idle')
      setSyncMessage('Sin conexión · cambios guardados')
      return
    }
    setSyncState('syncing')
    setSyncMessage('Sincronizando…')
    try {
      const result = await new SyncEngine(repository).run()
      await refreshLocal()
      setSyncState(result.failed ? 'error' : 'ok')
      setSyncMessage(result.failed ? `${result.failed} cambio${result.failed === 1 ? '' : 's'} rechazado${result.failed === 1 ? '' : 's'}` : result.pushed || result.pulled ? `${result.pushed} enviados · ${result.pulled} recibidos` : 'Todo sincronizado')
    } catch (cause) {
      setSyncState('error')
      setSyncMessage(cause instanceof Error ? cause.message : 'No se pudo sincronizar')
    }
  }, [refreshLocal])

  useEffect(() => {
    void Promise.all([repository.getSession(), refreshLocal()]).then(([storedSession]) => {
      setSession(storedSession)
      setReady(true)
      if (storedSession && navigator.onLine) void synchronize()
    })
  }, [refreshLocal, synchronize])

  useEffect(() => {
    const handleOnline = () => { setOnline(true); if (session) void synchronize() }
    const handleOffline = () => { setOnline(false); setSyncMessage('Sin conexión · cambios guardados') }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [session, synchronize])

  async function save(input: TransactionInput) {
    if (!session) return
    if (editing) await repository.updateTransaction(editing.id, input)
    else await repository.createTransaction(input, session.userId)
    setEditing(undefined)
    await refreshLocal()
    if (navigator.onLine) void synchronize()
  }

  async function remove(transaction: Transaction) {
    if (!window.confirm(`¿Eliminar “${transaction.concept}”?`)) return
    await repository.deleteTransaction(transaction.id)
    await refreshLocal()
    if (navigator.onLine) void synchronize()
  }

  async function logout() {
    await repository.setSession(null)
    setSession(null)
    setSyncMessage('Solo en este dispositivo')
  }

  if (!ready) return <main className="center"><p>Cargando tus finanzas…</p></main>
  if (!session) return <Login onAuthenticated={(newSession) => { setSession(newSession); void synchronize() }} />

  const totals = calculateTotals(transactions)
  return (
    <div className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">Casa compartida</p><h1>Movimientos</h1></div>
        <button className="avatar" onClick={logout} aria-label={`Cerrar sesión de ${session.userId}`}>{session.userId[0].toUpperCase()}</button>
      </header>

      <main>
        <button className={`sync-banner ${syncState}`} onClick={() => void synchronize()} disabled={syncState === 'syncing'}>
          <span aria-hidden="true">{online ? '●' : '○'}</span>
          <span>{syncMessage}{pendingCount > 0 ? ` · ${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}` : ''}</span>
          <span aria-hidden="true">↻</span>
        </button>

        <section className="summary" aria-label="Resumen">
          <div><span>Ingresos</span><strong>{formatEuro(totals.incomeCents)}</strong></div>
          <div><span>Gastos</span><strong>{formatEuro(totals.expenseCents)}</strong></div>
          <div className="balance"><span>Balance</span><strong>{formatEuro(totals.balanceCents)}</strong></div>
        </section>

        <section className="card">
          <h2>{editing ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
          <TransactionForm transaction={editing} onSave={save} onCancel={editing ? () => setEditing(undefined) : undefined} />
        </section>

        <section className="movements" aria-labelledby="movements-title">
          <div className="section-title"><h2 id="movements-title">Actividad</h2><span>{transactions.length}</span></div>
          {transactions.length === 0 ? <p className="empty">Todavía no hay movimientos. Añade el primero incluso sin conexión.</p> : (
            <ul>
              {transactions.map((transaction) => (
                <li key={transaction.id}>
                  <button className="movement-main" onClick={() => setEditing(transaction)}>
                    <span className={`kind-icon ${transaction.kind}`} aria-hidden="true">{transaction.kind === 'income' ? '↓' : '↑'}</span>
                    <span><strong>{transaction.concept}</strong><small>{formatDate(transaction.date)} · {transaction.createdBy}</small></span>
                    <strong className={transaction.kind}>{transaction.kind === 'expense' ? '−' : '+'}{formatEuro(transaction.amountCents)}</strong>
                  </button>
                  <button className="delete" aria-label={`Eliminar ${transaction.concept}`} onClick={() => void remove(transaction)}>Eliminar</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <footer>Hogar Finanzas · datos disponibles sin conexión</footer>
    </div>
  )
}

function Login({ onAuthenticated }: { onAuthenticated(session: Session): void }) {
  const [userId, setUserId] = useState<UserId>('david')
  const [householdKey, setHouseholdKey] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => { void repository.getServerUrl().then(setServerUrl) }, [])
  const validUrl = useMemo(() => serverUrl.includes('script.google.com/macros/s/'), [serverUrl])

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setLoading(true)
    try {
      await repository.setServerUrl(serverUrl)
      const newSession = await new AppsScriptClient(serverUrl).login(userId, householdKey)
      await repository.setSession(newSession)
      onAuthenticated(newSession)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.')
    } finally { setLoading(false) }
  }

  return (
    <main className="login">
      <div className="brand-mark" aria-hidden="true">⌂</div>
      <p className="eyebrow">Hogar Finanzas</p>
      <h1>Vuestras cuentas,<br />en un mismo lugar.</h1>
      <p className="intro">Disponible sin conexión y sincronizado entre vuestros dos iPhone.</p>
      <form className="card" onSubmit={submit}>
        <fieldset><legend>¿Quién eres?</legend><div className="segmented">
          <button type="button" aria-pressed={userId === 'david'} onClick={() => setUserId('david')}>David</button>
          <button type="button" aria-pressed={userId === 'esther'} onClick={() => setUserId('esther')}>Esther</button>
        </div></fieldset>
        <label>Clave de casa<input type="password" autoComplete="current-password" value={householdKey} onChange={(event) => setHouseholdKey(event.target.value)} required minLength={10} /></label>
        <details><summary>Configuración del servidor</summary><label>URL de Google Apps Script<input type="url" value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} required /></label></details>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={loading || !validUrl}>{loading ? 'Entrando…' : 'Entrar en casa'}</button>
      </form>
      <p className="privacy">La clave se envía por HTTPS y no se guarda en este dispositivo.</p>
    </main>
  )
}

function formatDate(date: string): string {
  const normalized = normalizeDateOnly(date)
  if (!normalized) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${normalized}T00:00:00Z`))
}

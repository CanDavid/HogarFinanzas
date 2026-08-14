import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AccountManager } from './components/AccountManager'
import { CategoryManager } from './components/CategoryManager'
import { TransactionForm } from './components/TransactionForm'
import { LocalFinanceRepository } from './data/localFinanceRepository'
import { normalizeDateOnly } from './domain/dates'
import { calculatePortfolio, calculateTotals } from './domain/finance'
import { formatEuro } from './domain/money'
import type { Account, Category, Session, Transaction, TransactionInput, UserId } from './domain/types'
import { AppsScriptClient } from './services/appsScriptClient'
import { SyncEngine } from './services/syncEngine'
import './styles.css'

const repository = new LocalFinanceRepository()
type SyncState = 'idle' | 'syncing' | 'ok' | 'error'
type View = 'movements' | 'accounts' | 'categories'

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [view, setView] = useState<View>('movements')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncMessage, setSyncMessage] = useState('Solo en este dispositivo')
  const [pendingCount, setPendingCount] = useState(0)
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  const refreshLocal = useCallback(async () => {
    const [items, accountItems, categoryItems, pending, failed] = await Promise.all([
      repository.listTransactions(), repository.listAccounts(), repository.listCategories(), repository.pendingOperations(), repository.failedOperations(),
    ])
    setTransactions(items); setAccounts(accountItems); setCategories(categoryItems); setPendingCount(pending.length)
    if (failed.length > 0) { setSyncState('error'); setSyncMessage(`${failed.length} cambio${failed.length === 1 ? '' : 's'} necesita revisión`) }
  }, [])

  const synchronize = useCallback(async () => {
    if (!navigator.onLine) { setSyncState('idle'); setSyncMessage('Sin conexión · cambios guardados'); return }
    setSyncState('syncing'); setSyncMessage('Sincronizando…')
    try {
      const result = await new SyncEngine(repository).run(); await refreshLocal(); setSyncState(result.failed ? 'error' : 'ok')
      setSyncMessage(result.failed ? `${result.failed} cambios rechazados` : result.pushed || result.pulled ? `${result.pushed} enviados · ${result.pulled} recibidos` : 'Todo sincronizado')
    } catch (cause) { setSyncState('error'); setSyncMessage(cause instanceof Error ? cause.message : 'No se pudo sincronizar') }
  }, [refreshLocal])

  useEffect(() => { void Promise.all([repository.getSession(), refreshLocal()]).then(([storedSession]) => {
    setSession(storedSession); setReady(true); if (storedSession && navigator.onLine) void synchronize()
  }) }, [refreshLocal, synchronize])
  useEffect(() => {
    const handleOnline = () => { setOnline(true); if (session) void synchronize() }
    const handleOffline = () => { setOnline(false); setSyncMessage('Sin conexión · cambios guardados') }
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [session, synchronize])

  async function afterLocalChange(action: () => Promise<unknown>) { await action(); await refreshLocal(); if (navigator.onLine) void synchronize() }
  async function save(input: TransactionInput) { if (!session) return; await afterLocalChange(() => editing ? repository.updateTransaction(editing.id, input) : repository.createTransaction(input, session.userId)); setEditing(undefined) }
  async function remove(transaction: Transaction) { if (window.confirm(`¿Eliminar “${transaction.concept}”?`)) await afterLocalChange(() => repository.deleteTransaction(transaction.id)) }
  async function logout() { await repository.setSession(null); setSession(null); setSyncMessage('Solo en este dispositivo') }

  if (!ready) return <main className="center"><p>Cargando tus finanzas…</p></main>
  if (!session) return <Login onAuthenticated={(newSession) => { setSession(newSession); void synchronize() }} />

  const totals = calculateTotals(transactions)
  const portfolio = calculatePortfolio(accounts, transactions)
  const accountNames = new Map(accounts.map((item) => [item.id, item.name]))
  const categoryNames = new Map(categories.map((item) => [item.id, `${item.icon} ${item.name}`]))
  return <div className="app-shell">
    <header className="topbar"><div><p className="eyebrow">Casa compartida</p><h1>{view === 'movements' ? 'Movimientos' : view === 'accounts' ? 'Cuentas' : 'Categorías'}</h1></div>
      <button className="avatar" onClick={logout} aria-label={`Cerrar sesión de ${session.userId}`}>{session.userId[0].toUpperCase()}</button></header>
    <nav className="section-nav" aria-label="Núcleo financiero"><button aria-pressed={view === 'movements'} onClick={() => setView('movements')}>Movimientos</button><button aria-pressed={view === 'accounts'} onClick={() => setView('accounts')}>Cuentas</button><button aria-pressed={view === 'categories'} onClick={() => setView('categories')}>Categorías</button></nav>
    <main>
      <button className={`sync-banner ${syncState}`} onClick={() => void synchronize()} disabled={syncState === 'syncing'}><span aria-hidden="true">{online ? '●' : '○'}</span><span>{syncMessage}{pendingCount ? ` · ${pendingCount} pendientes` : ''}</span><span aria-hidden="true">↻</span></button>
      {view === 'movements' && <>
        <section className="summary"><div><span>Ingresos</span><strong>{formatEuro(totals.incomeCents)}</strong></div><div><span>Gastos</span><strong>{formatEuro(totals.expenseCents)}</strong></div><div className="balance"><span>Patrimonio</span><strong>{formatEuro(portfolio.netWorthCents)}</strong><small>Liquidez {formatEuro(portfolio.liquidityCents)}</small></div></section>
        <section className="card"><h2>{editing ? 'Editar movimiento' : 'Nuevo movimiento'}</h2><TransactionForm transaction={editing} accounts={accounts} categories={categories} onSave={save} onCancel={editing ? () => setEditing(undefined) : undefined} /></section>
        <section className="movements"><div className="section-title"><h2>Actividad</h2><span>{transactions.length}</span></div>{transactions.length === 0 ? <p className="empty">Todavía no hay movimientos.</p> : <ul>{transactions.map((item) => <li key={item.id}>
          <button className="movement-main" onClick={() => setEditing(item)}><span className={`kind-icon ${item.kind}`} aria-hidden="true">{kindIcon(item)}</span><span><strong>{item.concept}</strong><small>{formatDate(item.date)} · {movementContext(item, accountNames, categoryNames)}</small></span><strong className={item.kind}>{movementAmount(item)}</strong></button>
          <button className="delete" onClick={() => void remove(item)}>Eliminar</button></li>)}</ul>}</section>
      </>}
      {view === 'accounts' && <AccountManager accounts={accounts} balances={portfolio.balances}
        onCreate={(input) => afterLocalChange(() => repository.createAccount(input, session.userId))}
        onUpdate={(id, input) => afterLocalChange(() => repository.updateAccount(id, input))}
        onArchive={(id) => afterLocalChange(() => repository.archiveAccount(id))}
        onRestore={(id) => afterLocalChange(() => repository.restoreAccount(id))} />}
      {view === 'categories' && <CategoryManager categories={categories}
        onCreate={(input) => afterLocalChange(() => repository.createCategory(input, session.userId))}
        onUpdate={(id, input) => afterLocalChange(() => repository.updateCategory(id, input))}
        onArchive={(id) => afterLocalChange(() => repository.archiveCategory(id))}
        onRestore={(id) => afterLocalChange(() => repository.restoreCategory(id))} />}
    </main><footer>Hogar Finanzas · datos disponibles sin conexión</footer>
  </div>
}

function Login({ onAuthenticated }: { onAuthenticated(session: Session): void }) {
  const [userId, setUserId] = useState<UserId>('david'); const [householdKey, setHouseholdKey] = useState(''); const [serverUrl, setServerUrl] = useState('')
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  useEffect(() => { void repository.getServerUrl().then(setServerUrl) }, [])
  const validUrl = useMemo(() => serverUrl.includes('script.google.com/macros/s/'), [serverUrl])
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); setLoading(true); try { await repository.setServerUrl(serverUrl); const newSession = await new AppsScriptClient(serverUrl).login(userId, householdKey); await repository.setSession(newSession); onAuthenticated(newSession) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.') } finally { setLoading(false) } }
  return <main className="login"><div className="brand-mark" aria-hidden="true">⌂</div><p className="eyebrow">Hogar Finanzas</p><h1>Vuestras cuentas,<br />en un mismo lugar.</h1><p className="intro">Disponible sin conexión y sincronizado entre vuestros dos iPhone.</p>
    <form className="card" onSubmit={submit}><fieldset><legend>¿Quién eres?</legend><div className="segmented"><button type="button" aria-pressed={userId === 'david'} onClick={() => setUserId('david')}>David</button><button type="button" aria-pressed={userId === 'esther'} onClick={() => setUserId('esther')}>Esther</button></div></fieldset>
      <label>Clave de casa<input type="password" autoComplete="current-password" value={householdKey} onChange={(event) => setHouseholdKey(event.target.value)} required minLength={10} /></label><details><summary>Configuración del servidor</summary><label>URL de Google Apps Script<input type="url" value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} required /></label></details>{error && <p className="error" role="alert">{error}</p>}<button type="submit" disabled={loading || !validUrl}>{loading ? 'Entrando…' : 'Entrar en casa'}</button></form><p className="privacy">La clave se envía por HTTPS y no se guarda en este dispositivo.</p></main>
}

function formatDate(value: string): string { const date = normalizeDateOnly(value); return date ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : 'Fecha no válida' }
function kindIcon(item: Transaction): string { return item.kind === 'income' ? '↓' : item.kind === 'expense' ? '↑' : item.kind === 'transfer' ? '↔' : '±' }
function movementAmount(item: Transaction): string { return item.kind === 'transfer' ? formatEuro(item.amountCents) : `${item.kind === 'expense' || item.amountCents < 0 ? '−' : '+'}${formatEuro(Math.abs(item.amountCents))}` }
function movementContext(item: Transaction, accounts: Map<string, string>, categories: Map<string, string>): string {
  if (item.kind === 'transfer') return `${accounts.get(item.sourceAccountId ?? '') ?? 'Sin cuenta'} → ${accounts.get(item.destinationAccountId ?? '') ?? 'Sin cuenta'}`
  return `${categories.get(item.categoryId ?? '') ?? (item.kind === 'adjustment' ? 'Ajuste' : 'Sin categoría')} · ${accounts.get(item.accountId ?? '') ?? 'Sin cuenta'}`
}

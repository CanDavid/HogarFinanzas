import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AccountManager } from './components/AccountManager'
import { AnalysisView } from './components/AnalysisView'
import { BackupManager } from './components/BackupManager'
import { BottomNavigation, type MainTab } from './components/BottomNavigation'
import { CategoryManager } from './components/CategoryManager'
import { GoalsView } from './components/GoalsView'
import { HomeView } from './components/HomeView'
import { MovementsView } from './components/MovementsView'
import { PlanView } from './components/PlanView'
import { PortfolioView } from './components/PortfolioView'
import { RecurringManager } from './components/RecurringManager'
import { LocalFinanceRepository } from './data/localFinanceRepository'
import { isMonthClosed } from './domain/closures'
import { calculatePortfolio } from './domain/finance'
import type { Account, Budget, Category, Goal, GoalAllocation, MonthlyClosure, MonthlyPlan, PlannedItem, RecurringRule, RecurringRuleInput, Session, Transaction, TransactionInput, TransactionKind, UserId } from './domain/types'
import { AppsScriptClient } from './services/appsScriptClient'
import { SingleFlightRunner } from './services/singleFlightRunner'
import { SyncEngine } from './services/syncEngine'
import './styles.css'

const repository = new LocalFinanceRepository()
const syncRunner = new SingleFlightRunner()
type SyncState = 'idle' | 'syncing' | 'ok' | 'error'
type Page = MainTab | 'settings' | 'accounts' | 'categories' | 'recurring' | 'portfolio' | 'backup'
interface MovementIntent { key: number; mode: 'list' | 'add'; initialKind?: TransactionKind; initialAccountId?: string }

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([])
  const [monthlyPlans, setMonthlyPlans] = useState<MonthlyPlan[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalAllocations, setGoalAllocations] = useState<GoalAllocation[]>([])
  const [monthlyClosures, setMonthlyClosures] = useState<MonthlyClosure[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [page, setPage] = useState<Page>('home')
  const [movementIntent, setMovementIntent] = useState<MovementIntent>({ key: 0, mode: 'list' })
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncMessage, setSyncMessage] = useState('Solo en este dispositivo')
  const [pendingCount, setPendingCount] = useState(0)
  const [hasLocalData, setHasLocalData] = useState(true)
  const [ready, setReady] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  const refreshLocal = useCallback(async () => {
    const [items, accountItems, categoryItems, ruleItems, budgetItems, planItems, monthlyItems, goalItems, allocationItems, closureItems, pending, failed, localData] = await Promise.all([
      repository.listTransactions(), repository.listAccounts(), repository.listCategories(), repository.listRecurringRules(),
      repository.listBudgets(), repository.listPlannedItems(), repository.listMonthlyPlans(), repository.listGoals(), repository.listGoalAllocations(),
      repository.listMonthlyClosures(), repository.pendingOperations(), repository.failedOperations(), repository.hasLocalData(),
    ])
    setTransactions(items); setAccounts(accountItems); setCategories(categoryItems); setRecurringRules(ruleItems)
    setBudgets(budgetItems); setPlannedItems(planItems); setMonthlyPlans(monthlyItems); setGoals(goalItems); setGoalAllocations(allocationItems); setMonthlyClosures(closureItems); setPendingCount(pending.length); setHasLocalData(localData)
    if (failed.length > 0) { setSyncState('error'); setSyncMessage(`${failed.length} cambio${failed.length === 1 ? '' : 's'} necesita revisión`) }
  }, [])

  const synchronize = useCallback(() => syncRunner.run(async () => {
    if (!navigator.onLine) { setSyncState('idle'); setSyncMessage('Sin conexión · cambios guardados'); return }
    setSyncState('syncing'); setSyncMessage('Sincronizando…')
    try {
      const result = await new SyncEngine(repository).run(); await refreshLocal(); setSyncState(result.failed ? 'error' : 'ok')
      setSyncMessage(result.failed ? `${result.failed} cambios rechazados` : result.pushed || result.pulled ? `${result.pushed} enviados · ${result.pulled} recibidos` : 'Todo sincronizado')
    } catch (cause) { setSyncState('error'); setSyncMessage(cause instanceof Error ? cause.message : 'No se pudo sincronizar') }
  }), [refreshLocal])

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
  async function save(transaction: Transaction | undefined, input: TransactionInput, recurrence?: RecurringRuleInput) { if (!session) return; await afterLocalChange(() => transaction ? repository.updateTransaction(transaction.id, input) : recurrence ? repository.createTransactionWithRecurrence(input, recurrence, session.userId) : repository.createTransaction(input, session.userId)) }
  async function remove(transaction: Transaction) { if (window.confirm(`¿Eliminar “${transaction.concept}”?`)) await afterLocalChange(() => repository.deleteTransaction(transaction.id)) }
  async function convertToPlanned(transaction: Transaction) { if (!session) return; await afterLocalChange(() => repository.convertTransactionToPlannedItem(transaction.id, session.userId)) }
  async function logout() { await repository.setSession(null); setSession(null); setSyncMessage('Solo en este dispositivo') }

  if (!ready) return <main className="center"><p>Cargando tus finanzas…</p></main>
  if (!session) return <Login onAuthenticated={(newSession) => { setSession(newSession); void synchronize() }} />

  const portfolio = calculatePortfolio(accounts, transactions)
  const activeTab: MainTab = isMainTab(page) ? page : 'home'
  function openMovements(mode: 'list' | 'add', options: Pick<MovementIntent, 'initialKind' | 'initialAccountId'> = {}) {
    setMovementIntent((current) => ({ key: current.key + 1, mode, ...options })); setPage('movements')
  }
  return <div className="app-shell">
    <header className="topbar">{isMainTab(page) ? <div><p className="eyebrow">Casa compartida</p><h1>{pageTitle(page)}</h1></div> : <div className="secondary-heading"><button className="back-button" onClick={() => setPage(page === 'accounts' || page === 'categories' || page === 'recurring' || page === 'backup' ? 'settings' : 'home')} aria-label="Volver">‹</button><div><p className="eyebrow">{page === 'portfolio' ? 'Inicio' : 'Configuración'}</p><h1>{pageTitle(page)}</h1></div></div>}
      <div className="topbar-actions"><button className="settings-button" onClick={() => setPage('settings')} aria-label="Abrir configuración">⚙</button><button className="avatar" onClick={logout} aria-label={`Cerrar sesión de ${session.userId}`}>{session.userId[0].toUpperCase()}</button></div></header>
    <main>
      <button className={`sync-banner ${syncState}`} onClick={() => void synchronize()} disabled={syncState === 'syncing'} role="status" aria-live="polite"><span aria-hidden="true">{online ? '●' : '○'}</span><span>{syncMessage}{pendingCount ? ` · ${pendingCount} pendientes` : ''}</span><span aria-hidden="true">↻</span></button>
      {page === 'home' && <HomeView transactions={transactions} accounts={accounts} categories={categories} goals={goals} allocations={goalAllocations} closures={monthlyClosures}
        recurringRules={recurringRules} plannedItems={plannedItems} budgets={budgets} monthlyPlans={monthlyPlans}
        onAddMovement={() => openMovements('add')} onOpenMovements={() => openMovements('list')} onOpenAccounts={() => setPage('accounts')} onOpenCategories={() => setPage('categories')} onOpenPortfolio={() => setPage('portfolio')} onOpenGoals={() => setPage('goals')} />}
      {page === 'movements' && <MovementsView key={movementIntent.key} transactions={transactions} accounts={accounts} categories={categories} closures={monthlyClosures} startAdding={movementIntent.mode === 'add'} initialKind={movementIntent.initialKind} initialAccountId={movementIntent.initialAccountId} onSave={save} onDelete={remove} onConvertToPlanned={convertToPlanned} />}
      {page === 'plan' && <PlanView transactions={transactions} rules={recurringRules} plannedItems={plannedItems} budgets={budgets} monthlyPlans={monthlyPlans} accounts={accounts} categories={categories}
        goals={goals} goalAllocations={goalAllocations} closures={monthlyClosures}
        onCreateItem={(input) => afterLocalChange(() => repository.createPlannedItem(input, session.userId))}
        onUpdateItem={(id, input) => afterLocalChange(() => repository.updatePlannedItem(id, input))}
        onDeleteItem={(id) => afterLocalChange(() => repository.deletePlannedItem(id))}
        onSetItemStatus={(id, status) => afterLocalChange(() => repository.setPlannedItemStatus(id, status))}
        onSetRecurringStatus={(id, date, status) => afterLocalChange(() => repository.setRecurringOccurrenceStatus(id, date, status, session.userId))}
        onMaterialize={(item) => afterLocalChange(() => item.source === 'recurring' ? repository.materializeRecurringOccurrence(item.recurringRuleId!, item.date, session.userId) : repository.materializePlannedItem(item.id, session.userId))}
        onSetBudget={(month, categoryId, amount) => afterLocalChange(() => repository.setBudget(month, categoryId, amount, session.userId))}
        onSetDistribution={(month, savings, investment) => afterLocalChange(() => repository.setMonthlyPlan(month, savings, investment, session.userId))}
        onCloseMonth={(input, omitted) => afterLocalChange(async () => {
          for (const item of omitted) {
            if (item.source === 'recurring') await repository.setRecurringOccurrenceStatus(item.recurringRuleId!, item.date, 'omitted', session.userId)
            else await repository.setPlannedItemStatus(item.id, 'omitted')
          }
          const nextMonth = addMonth(input.month, 1)
          if (!isMonthClosed(nextMonth, monthlyClosures)) {
            for (const budget of budgets.filter((item) => !item.deletedAt && item.month === input.month && item.amountCents > 0)) {
              if (!budgets.some((item) => !item.deletedAt && item.month === nextMonth && item.categoryId === budget.categoryId)) {
                await repository.setBudget(nextMonth, budget.categoryId, budget.amountCents, session.userId)
              }
            }
            const distribution = monthlyPlans.find((item) => !item.deletedAt && item.month === input.month)
            if (distribution && !monthlyPlans.some((item) => !item.deletedAt && item.month === nextMonth)) {
              await repository.setMonthlyPlan(nextMonth, distribution.savingsAllocationCents, distribution.investmentAllocationCents, session.userId)
            }
          }
          await repository.closeMonth(input, session.userId)
        })}
        onReopenMonth={(month) => afterLocalChange(() => repository.reopenMonth(month, session.userId))} />}
      {page === 'goals' && <GoalsView goals={goals} allocations={goalAllocations} netWorthCents={portfolio.netWorthCents}
        onCreate={(input, initialAmountCents) => afterLocalChange(() => repository.createGoal(input, initialAmountCents, session.userId))}
        onUpdate={(id, input) => afterLocalChange(() => repository.updateGoal(id, input))}
        onSetCompleted={(id, completed) => afterLocalChange(() => repository.setGoalCompleted(id, completed))}
        onArchive={(id) => afterLocalChange(() => repository.archiveGoal(id))}
        onRestore={(id) => afterLocalChange(() => repository.restoreGoal(id))}
        onAllocate={(goalId, input) => afterLocalChange(() => repository.createGoalAllocation(goalId, input, session.userId))} />}
      {page === 'analysis' && <AnalysisView transactions={transactions} budgets={budgets} categories={categories} closures={monthlyClosures} goals={goals} allocations={goalAllocations} />}
      {page === 'settings' && <ConfigurationHome session={session} pendingCount={pendingCount} onAccounts={() => setPage('accounts')} onCategories={() => setPage('categories')} onRecurring={() => setPage('recurring')} onBackup={() => setPage('backup')} onSync={() => void synchronize()} onLogout={() => void logout()} />}
      {page === 'portfolio' && <PortfolioView accounts={accounts} transactions={transactions} goals={goals} allocations={goalAllocations} onManageAccounts={() => setPage('accounts')} />}
      {page === 'backup' && <BackupManager userId={session.userId} hasLocalData={hasLocalData} accounts={accounts} categories={categories} transactions={transactions}
        recurringRules={recurringRules} budgets={budgets} plannedItems={plannedItems} monthlyPlans={monthlyPlans} goals={goals}
        goalAllocations={goalAllocations} monthlyClosures={monthlyClosures}
        onImport={(payload) => afterLocalChange(() => repository.importBackup(payload, session.userId))} />}
      {page === 'accounts' && <AccountManager accounts={accounts} balances={portfolio.balances}
        onCreate={(input) => afterLocalChange(() => repository.createAccount(input, session.userId))}
        onUpdate={(id, input) => afterLocalChange(() => repository.updateAccount(id, input))}
        onArchive={(id) => afterLocalChange(() => repository.archiveAccount(id))}
        onRestore={(id) => afterLocalChange(() => repository.restoreAccount(id))}
        onAdjustBalance={(id) => openMovements('add', { initialKind: 'adjustment', initialAccountId: id })} />}
      {page === 'categories' && <CategoryManager categories={categories}
        onCreate={(input) => afterLocalChange(() => repository.createCategory(input, session.userId))}
        onUpdate={(id, input) => afterLocalChange(() => repository.updateCategory(id, input))}
        onArchive={(id) => afterLocalChange(() => repository.archiveCategory(id))}
        onRestore={(id) => afterLocalChange(() => repository.restoreCategory(id))} />}
      {page === 'recurring' && <RecurringManager rules={recurringRules} transactions={transactions} accounts={accounts} categories={categories}
        onCreate={(input) => afterLocalChange(() => repository.createRecurringRule(input, session.userId))}
        onUpdate={(id, input) => afterLocalChange(() => repository.updateRecurringRule(id, input))}
        onSetActive={(id, active) => afterLocalChange(() => repository.setRecurringRuleActive(id, active))}
        onMaterialize={(id, date) => afterLocalChange(() => repository.materializeRecurringOccurrence(id, date, session.userId))} />}
    </main><BottomNavigation active={activeTab} onSelect={(tab) => { if (tab === 'movements') openMovements('list'); else setPage(tab) }} /><footer>Hogar Finanzas · datos disponibles sin conexión</footer>
  </div>
}

function ConfigurationHome({ session, pendingCount, onAccounts, onCategories, onRecurring, onBackup, onSync, onLogout }: {
  session: Session; pendingCount: number; onAccounts(): void; onCategories(): void; onRecurring(): void; onBackup(): void; onSync(): void; onLogout(): void
}) {
  return <section className="settings-home"><div className="settings-links"><button className="card" onClick={onAccounts}><strong>Cuentas</strong><span>Crear, editar, archivar o reactivar</span></button><button className="card" onClick={onCategories}><strong>Categorías</strong><span>Organizar ingresos y gastos</span></button><button className="card" onClick={onRecurring}><strong>Recurrentes</strong><span>Programar y registrar próximas ocurrencias</span></button><button className="card" onClick={onBackup}><strong>Copia de seguridad</strong><span>Exportar o restaurar todos los datos</span></button></div>
    <div className="card session-card"><h2>Datos y sincronización</h2><p>Sesión iniciada como <strong>{session.userId === 'david' ? 'David' : 'Esther'}</strong>.</p><p>{pendingCount ? `${pendingCount} cambios pendientes.` : 'No hay cambios pendientes.'}</p><div className="form-actions"><button className="secondary" onClick={onLogout}>Cerrar sesión</button><button onClick={onSync}>Sincronizar ahora</button></div></div></section>
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

function isMainTab(page: Page): page is MainTab { return ['home', 'movements', 'plan', 'goals', 'analysis'].includes(page) }
function pageTitle(page: Page): string { return page === 'home' ? 'Inicio' : page === 'movements' ? 'Movimientos' : page === 'plan' ? 'Plan' : page === 'goals' ? 'Objetivos' : page === 'analysis' ? 'Análisis' : page === 'accounts' ? 'Cuentas' : page === 'categories' ? 'Categorías' : page === 'recurring' ? 'Recurrentes' : page === 'portfolio' ? 'Patrimonio' : page === 'backup' ? 'Copia de seguridad' : 'Ajustes' }
function addMonth(month: string, offset: number): string { const [year, value] = month.split('-').map(Number); const date = new Date(Date.UTC(year, value - 1 + offset, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` }

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { BACKUP_SCHEMA_VERSION, buildBackupFilename, parseBackupPayload, serializeBackup, summarizeBackup, type BackupPayload, type BackupSummary } from '../domain/backup'
import type { Account, Budget, Category, Goal, GoalAllocation, MonthlyClosure, MonthlyPlan, PlannedItem, RecurringRule, Transaction, UserId } from '../domain/types'

interface Props {
  userId: UserId
  hasLocalData: boolean
  accounts: Account[]; categories: Category[]; transactions: Transaction[]; recurringRules: RecurringRule[]
  budgets: Budget[]; plannedItems: PlannedItem[]; monthlyPlans: MonthlyPlan[]; goals: Goal[]
  goalAllocations: GoalAllocation[]; monthlyClosures: MonthlyClosure[]
  onImport(payload: BackupPayload): Promise<void>
}

export function BackupManager({ userId, hasLocalData, accounts, categories, transactions, recurringRules, budgets, plannedItems, monthlyPlans, goals, goalAllocations, monthlyClosures, onImport }: Props) {
  const [pending, setPending] = useState<{ payload: BackupPayload; summary: BackupSummary } | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const summaryRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (pending) summaryRef.current?.focus() }, [pending])

  function exportBackup() {
    const payload: BackupPayload = { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: new Date().toISOString(), exportedBy: userId,
      accounts, categories, transactions, recurringRules, budgets, plannedItems, monthlyPlans, goals, goalAllocations, monthlyClosures }
    const blob = new Blob([serializeBackup(payload)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = buildBackupFilename(payload.exportedAt)
    document.body.appendChild(link); link.click(); link.remove()
    URL.revokeObjectURL(url)
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setError(''); setPending(null)
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const payload = parseBackupPayload(JSON.parse(await readFileAsText(file)))
      setPending({ payload, summary: summarizeBackup(payload) })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo leer el archivo de copia.') }
  }

  async function confirmImport() {
    if (!pending) return
    setImporting(true); setError('')
    try { await onImport(pending.payload); setPending(null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo restaurar la copia.') }
    finally { setImporting(false) }
  }

  return <section className="management backup-management">
    <div className="section-title"><h2>Copia de seguridad</h2></div>
    <div className="card">
      <h3>Exportar</h3>
      <p>Descarga un archivo con todos los datos del hogar. Sincroniza antes de exportar para incluir los últimos cambios.</p>
      <button onClick={exportBackup}>Exportar copia</button>
    </div>
    <div className="card">
      <h3>Restaurar</h3>
      {hasLocalData
        ? <p>Ya hay datos en este dispositivo; la restauración solo está disponible en una casa recién inicializada, antes de la primera sincronización.</p>
        : <>
          {!pending && <label>Selecciona un archivo de copia<input type="file" accept="application/json" onChange={(event) => void handleFile(event)} /></label>}
          {pending && <div>
            <p ref={summaryRef} tabIndex={-1}>Vas a restaurar: {summaryText(pending.summary)}.</p>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setPending(null)} disabled={importing}>Cancelar</button>
              <button onClick={() => void confirmImport()} disabled={importing}>{importing ? 'Restaurando…' : 'Confirmar restauración'}</button>
            </div>
          </div>}
        </>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  </section>
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de copia.'))
    reader.readAsText(file)
  })
}

function summaryText(summary: BackupSummary): string {
  return `${summary.accounts} cuentas, ${summary.categories} categorías, ${summary.transactions} movimientos, ${summary.recurringRules} recurrentes, `
    + `${summary.budgets} presupuestos, ${summary.plannedItems} previstos, ${summary.monthlyPlans} distribuciones mensuales, ${summary.goals} objetivos, `
    + `${summary.goalAllocations} aportaciones/retiradas de objetivos y ${summary.monthlyClosures} cierres mensuales`
}

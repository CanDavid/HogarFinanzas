import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { buildAnalysis, type AnalysisPeriod, type AnalysisResult } from '../domain/analysis'
import { localDateOnly } from '../domain/dates'
import { formatEuro } from '../domain/money'
import type { Budget, Category, Goal, GoalAllocation, MonthlyClosure, Transaction } from '../domain/types'

interface Props {
  transactions: Transaction[]
  budgets: Budget[]
  categories: Category[]
  closures: MonthlyClosure[]
  goals: Goal[]
  allocations: GoalAllocation[]
}

const PERIODS: { id: AnalysisPeriod; label: string }[] = [
  { id: '3m', label: '3 meses' }, { id: '6m', label: '6 meses' }, { id: '12m', label: '12 meses' },
  { id: 'year', label: 'Este año' }, { id: 'custom', label: 'A medida' },
]

export function AnalysisView(props: Props) {
  const { transactions, budgets, categories, closures, goals, allocations } = props
  const today = localDateOnly()
  const [period, setPeriod] = useState<AnalysisPeriod>('6m')
  const [customFrom, setCustomFrom] = useState(`${today.slice(0, 4)}-01-01`)
  const [customTo, setCustomTo] = useState(today)
  const calculation = useMemo(() => {
    try { return { result: buildAnalysis({ today, period, customFrom, customTo, transactions, budgets, categories, closures, goals, allocations }), error: '' } }
    catch (cause) { return { result: null, error: cause instanceof Error ? cause.message : 'No se pudo calcular el análisis.' } }
  }, [today, period, customFrom, customTo, transactions, budgets, categories, closures, goals, allocations])

  return <section className="analysis-view">
    <div className="analysis-period" aria-label="Periodo del análisis">
      {PERIODS.map((item) => <button key={item.id} aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>)}
    </div>
    {period === 'custom' && <div className="card custom-period">
      <label>Desde<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
      <label>Hasta<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
    </div>}
    {calculation.error && <p className="error" role="alert">{calculation.error}</p>}
    {calculation.result && <AnalysisContent result={calculation.result} />}
  </section>
}

function AnalysisContent({ result }: { result: AnalysisResult }) {
  const from = shortDate(result.range.from); const to = shortDate(result.range.to)
  return <>
    <section className="card analysis-hero">
      <span>Resultado real · {from} – {to}</span>
      <strong className={result.resultCents < 0 ? 'negative' : ''}>{signedEuro(result.resultCents)}</strong>
      <div><Metric label="Ingresos" value={result.totalIncomeCents} /><Metric label="Gastos" value={result.totalExpenseCents} /></div>
    </section>

    <AnalysisSection title="Gasto mensual" intro="Total de gastos reales registrados en cada mes. Las transferencias y ajustes no cuentan.">
      <MonthlyBars result={result} />
    </AnalysisSection>

    <AnalysisSection title="Gasto por categoría" intro="Ranking del gasto real del periodo y su peso sobre el total.">
      {result.categories.length === 0 ? <Empty>No hay gastos en este periodo.</Empty> : <ol className="analysis-ranking">
        {result.categories.map((item) => <li key={item.categoryId}><span className="rank-icon" aria-hidden="true">{item.icon}</span><div><strong>{item.name}</strong><small>{item.percentage}% del gasto</small></div><strong>{formatEuro(item.amountCents)}</strong></li>)}
      </ol>}
    </AnalysisSection>

    <AnalysisSection title="Presupuesto frente a gasto" intro="Compara el presupuesto variable con el gasto variable real; los pagos recurrentes y previstos se excluyen aquí.">
      {result.budgets.length === 0 ? <Empty>No hay presupuestos en este periodo.</Empty> : <BudgetHistory result={result} />}
    </AnalysisSection>

    <AnalysisSection title="Patrimonio en cierres" intro="Evolución basada solo en snapshots de meses cerrados; no reconstruye saldos históricos.">
      <NetWorthChart result={result} />
    </AnalysisSection>

    <AnalysisSection title="Ahorro orientativo" intro="Es ingresos menos gastos y puede ser negativo; no es el dinero transferido a una cuenta de ahorro.">
      <div className="analysis-metrics"><Metric label="Ahorro neto del periodo" value={result.savingsCents} /><Metric label="Tasa orientativa" value={`${result.savingsRatePercent}%`} /><Metric label="Neto acumulado del año" value={result.yearSavingsCents} /></div>
      <ul className="savings-history">{result.months.map((item) => <li key={item.month}><span>{monthName(item.month)}</span><span>{formatEuro(item.savingsCents)} · {item.savingsRatePercent}%</span></li>)}</ul>
    </AnalysisSection>

    <AnalysisSection title="Objetivos activos" intro="Importe acumulado hasta el final del periodo. Las asignaciones son reservas virtuales y no mueven dinero.">
      {result.goals.length === 0 ? <Empty>No hay objetivos activos.</Empty> : <ul className="analysis-goals">{result.goals.map((item) => <li key={item.goalId}>
        <div><strong>{item.icon} {item.name}</strong><span>{formatEuro(item.assignedCents)} de {formatEuro(item.targetAmountCents)}</span></div>
        <progress max={100} value={Math.min(item.percentage, 100)} aria-label={`${item.name}: ${item.percentage}% completado`} />
        <small>{item.addedInPeriodCents === 0 ? 'Sin cambios en el periodo' : `${signedEuro(item.addedInPeriodCents)} en el periodo`} · {item.percentage}%</small>
      </li>)}</ul>}
    </AnalysisSection>

    <AnalysisSection title="Lecturas del periodo" intro="Reglas matemáticas locales, sin inteligencia artificial ni recomendaciones de inversión.">
      <ul className="analysis-insights">{result.insights.map((item) => <li key={item}>{item}</li>)}</ul>
    </AnalysisSection>
  </>
}

function MonthlyBars({ result }: { result: AnalysisResult }) {
  const max = Math.max(...result.months.map((item) => item.expenseCents), 1)
  return <ul className="monthly-bars">{result.months.map((item) => <li key={item.month}>
    <span>{monthName(item.month)}</span><div className="bar-track" aria-hidden="true"><i style={{ '--bar-width': `${Math.round(item.expenseCents / max * 100)}%` } as CSSProperties} /></div><strong>{formatEuro(item.expenseCents)}</strong>
  </li>)}</ul>
}

function BudgetHistory({ result }: { result: AnalysisResult }) {
  const months = [...new Set(result.budgets.map((item) => item.month))].sort().reverse()
  return <div className="budget-history">{months.map((month, index) => <details key={month} open={index === 0}>
    <summary>{monthName(month)}</summary><ul>{result.budgets.filter((item) => item.month === month).map((item) => {
      const exceeded = item.differenceCents < 0
      return <li key={`${item.month}:${item.categoryId}`}><div><strong>{item.categoryIcon} {item.categoryName}</strong><span>{formatEuro(item.actualCents)} de {formatEuro(item.budgetCents)}</span></div>
        <progress className={exceeded ? 'over-budget' : ''} max={100} value={Math.min(item.percentage, 100)} aria-label={`${item.categoryName}: ${item.percentage}% consumido`} />
        <small className={exceeded ? 'negative' : ''}>{exceeded ? `Excedido en ${formatEuro(Math.abs(item.differenceCents))}` : `${formatEuro(item.differenceCents)} disponible`} · {item.percentage}%</small></li>
    })}</ul>
  </details>)}</div>
}

function NetWorthChart({ result }: { result: AnalysisResult }) {
  if (result.closures.length === 0) return <Empty>No hay cierres mensuales en este periodo.</Empty>
  const values = result.closures.map((item) => item.netWorthCents); const min = Math.min(...values); const max = Math.max(...values); const span = Math.max(max - min, 1)
  const points = result.closures.map((item, index) => `${result.closures.length === 1 ? 150 : 10 + index * 280 / (result.closures.length - 1)},${105 - (item.netWorthCents - min) / span * 90}`).join(' ')
  return <div className="net-worth-history">
    {result.closures.length > 1 && <svg viewBox="0 0 300 120" role="img" aria-label={`Patrimonio desde ${formatEuro(values[0])} hasta ${formatEuro(values.at(-1)!)}`}><polyline points={points} /><line x1="10" y1="105" x2="290" y2="105" /></svg>}
    <ul>{result.closures.map((item) => <li key={item.id}><span>{monthName(item.month)}</span><strong>{formatEuro(item.netWorthCents)}</strong></li>)}</ul>
  </div>
}

function AnalysisSection({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <section className="card analysis-section"><h2>{title}</h2><p>{intro}</p>{children}</section>
}
function Metric({ label, value }: { label: string; value: number | string }) { return <div><span>{label}</span><strong className={typeof value === 'number' && value < 0 ? 'negative' : ''}>{typeof value === 'number' ? formatEuro(value) : value}</strong></div> }
function Empty({ children }: { children: ReactNode }) { return <p className="empty">{children}</p> }
function signedEuro(value: number): string { return `${value < 0 ? '−' : '+'}${formatEuro(Math.abs(value))}` }
function shortDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) }
function monthName(value: string): string { return new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`)) }

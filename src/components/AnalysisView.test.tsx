import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { localDateOnly } from '../domain/dates'
import type { Budget, Category, Goal, GoalAllocation, MonthlyClosure, Transaction } from '../domain/types'
import { AnalysisView } from './AnalysisView'

const today = localDateOnly(); const month = today.slice(0, 7)
const previousMonth = shiftMonth(month, -1)
const sync = { createdAt: `${today}T10:00:00.000Z`, updatedAt: `${today}T10:00:00.000Z`, deletedAt: null,
  createdBy: 'david' as const, version: 1, changeSequence: 1 }
const category: Category = { ...sync, id: 'food', name: 'Alimentación', kind: 'expense', icon: '🍓', archivedAt: null }
const expense: Transaction = { ...sync, id: 'expense', kind: 'expense', amountCents: 12_000, concept: 'Compra', note: '', date: `${month}-02`,
  accountId: 'account', categoryId: category.id, sourceAccountId: null, destinationAccountId: null }
const income: Transaction = { ...expense, id: 'income', kind: 'income', amountCents: 50_000, concept: 'Nómina', categoryId: null }
const budget: Budget = { ...sync, id: 'budget', month, categoryId: category.id, amountCents: 10_000 }
const goal: Goal = { ...sync, id: 'goal', name: 'Viaje', targetAmountCents: 100_000, targetDate: null, icon: '✈️', note: '', completedAt: null, archivedAt: null }
const allocation: GoalAllocation = { ...sync, id: 'allocation', goalId: goal.id, amountCents: 25_000, date: `${month}-01`, note: '' }
const closure: MonthlyClosure = { ...sync, id: 'closure', month: previousMonth, status: 'closed', revision: 1, closedAt: `${previousMonth}-28T20:00:00.000Z`,
  closedBy: 'david', reopenedAt: null, reopenedBy: null, transactionCount: 0, pendingIncomeCount: 0, pendingExpenseCount: 0,
  actualIncomeCents: 0, actualExpenseCents: 0, realSurplusCents: 0, projectedSurplusCents: 0, netWorthCents: 200_000,
  liquidityCents: 200_000, savingsCents: 0, investmentCents: 0, goalReservedCents: 0 }

function props() { return { transactions: [income, expense], budgets: [budget], categories: [category], closures: [closure], goals: [goal], allocations: [allocation] } }

describe('AnalysisView', () => {
  it('renders every Phase 8 block with explicit financial context', () => {
    render(<AnalysisView {...props()} />)
    expect(screen.getByRole('heading', { name: 'Gasto mensual' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gasto por categoría' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Presupuesto frente a gasto' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Patrimonio en cierres' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ahorro orientativo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Objetivos activos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lecturas del periodo' })).toBeInTheDocument()
    expect(screen.getByText(/transferencias y ajustes no cuentan/i)).toBeInTheDocument()
    expect(screen.getByText(/reservas virtuales y no mueven dinero/i)).toBeInTheDocument()
    expect(screen.getByText(/sin inteligencia artificial ni recomendaciones de inversión/i)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /Alimentación: 120% consumido/ })).toHaveValue(100)
    expect(screen.getByRole('progressbar', { name: /Viaje: 25% completado/ })).toHaveValue(25)
  })

  it('changes period and validates a custom date range', () => {
    render(<AnalysisView {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: '3 meses' }))
    expect(screen.getByRole('button', { name: '3 meses' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'A medida' }))
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: today } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: shiftDate(today, -1) } })
    expect(screen.getByRole('alert')).toHaveTextContent(/fecha inicial/)
  })

  it('presents useful empty states without inventing data', () => {
    render(<AnalysisView transactions={[]} budgets={[]} categories={[]} closures={[]} goals={[]} allocations={[]} />)
    expect(screen.getByText('No hay gastos en este periodo.')).toBeInTheDocument()
    expect(screen.getByText('No hay presupuestos en este periodo.')).toBeInTheDocument()
    expect(screen.getByText('No hay cierres mensuales en este periodo.')).toBeInTheDocument()
    expect(screen.getByText('No hay objetivos activos.')).toBeInTheDocument()
    expect(screen.getByText('Aún no hay suficiente historial para comparar periodos.')).toBeInTheDocument()
  })
})

function shiftMonth(value: string, offset: number): string { const [year, monthValue] = value.split('-').map(Number); const date = new Date(year, monthValue - 1 + offset, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` }
function shiftDate(value: string, offset: number): string { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + offset); return localDateOnly(date) }

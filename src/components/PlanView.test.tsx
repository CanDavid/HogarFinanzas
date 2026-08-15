import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { localDateOnly } from '../domain/dates'
import type { Account, Budget, Category, PlannedItem, RecurringRule, Transaction } from '../domain/types'
import { PlanView } from './PlanView'

const today = localDateOnly(); const month = today.slice(0, 7)
const sync = { createdAt: `${today}T10:00:00.000Z`, updatedAt: `${today}T10:00:00.000Z`, deletedAt: null,
  createdBy: 'david' as const, version: 1, changeSequence: 1 }
const account: Account = { ...sync, id: 'account', name: 'Principal', type: 'checking', initialBalanceCents: 0,
  includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }
const category: Category = { ...sync, id: 'category', name: 'Vivienda', kind: 'expense', icon: '●', archivedAt: null }
const rule: RecurringRule = { ...sync, id: 'rule', kind: 'expense', amountCents: 6_500, concept: 'Internet', note: '',
  accountId: account.id, categoryId: category.id, frequency: 'monthly', startDate: `${month}-01`, endDate: null, active: true }
const item: PlannedItem = { ...sync, id: 'planned', source: 'manual', recurringRuleId: null, kind: 'expense', amountCents: 4_000,
  concept: 'Seguro puntual', note: '', date: `${month}-20`, accountId: account.id, categoryId: category.id, status: 'pending' }
const budget: Budget = { ...sync, id: 'budget', month, categoryId: category.id, amountCents: 20_000 }

function props() {
  return { transactions: [], rules: [rule], plannedItems: [item], budgets: [budget], monthlyPlans: [], accounts: [account], categories: [category],
    onCreateItem: vi.fn(), onUpdateItem: vi.fn(), onDeleteItem: vi.fn(), onSetItemStatus: vi.fn(), onSetRecurringStatus: vi.fn(),
    onMaterialize: vi.fn().mockResolvedValue(undefined), onSetBudget: vi.fn().mockResolvedValue(undefined), onSetDistribution: vi.fn().mockResolvedValue(undefined) }
}

describe('PlanView', () => {
  it('shows recurring and manual pending items and materializes the selected one', async () => {
    const callbacks = props(); render(<PlanView {...callbacks} />)
    expect(screen.getByText('Internet')).toBeInTheDocument()
    expect(screen.getByText('Seguro puntual')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcar pagado' })[1])
    await vi.waitFor(() => expect(callbacks.onMaterialize).toHaveBeenCalledWith(expect.objectContaining({ id: item.id, status: 'pending' })))
  })

  it('edits a budget in integer cents and saves the monthly distribution', async () => {
    const callbacks = props(); render(<PlanView {...callbacks} />)
    fireEvent.click(screen.getByRole('button', { name: 'Presupuestos' }))
    fireEvent.click(screen.getByRole('button', { name: /Vivienda/ }))
    fireEvent.change(screen.getByLabelText('Presupuesto'), { target: { value: '250,50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar presupuesto' }))
    await vi.waitFor(() => expect(callbacks.onSetBudget).toHaveBeenCalledWith(month, category.id, 25_050))

    fireEvent.click(screen.getByRole('button', { name: 'Distribución' }))
    fireEvent.change(screen.getByLabelText('Ahorro'), { target: { value: '50,00' } })
    fireEvent.change(screen.getByLabelText('Inversión'), { target: { value: '25,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar distribución' }))
    await vi.waitFor(() => expect(callbacks.onSetDistribution).toHaveBeenCalledWith(month, 5_000, 2_500))
  })

  it('states the exceeded amount without relying only on the progress color', () => {
    const expense: Transaction = { ...sync, id: 'expense', kind: 'expense', amountCents: 121_000, concept: 'Compra grande', note: '',
      date: `${month}-15`, accountId: account.id, categoryId: category.id, sourceAccountId: null, destinationAccountId: null }
    render(<PlanView {...props()} transactions={[expense]} budgets={[{ ...budget, amountCents: 100_000 }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Presupuestos' }))
    expect(screen.getByText(/Excedido en 210,00/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /Presupuesto excedido en 210,00.*121% consumido/ })).toHaveValue(100)
  })
})

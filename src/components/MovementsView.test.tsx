import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MovementsView } from './MovementsView'
import type { Account, Category, Transaction } from '../domain/types'

const base = { createdAt: '', updatedAt: '', deletedAt: null, createdBy: 'david' as const, version: 1, changeSequence: 1 }
const accounts: Account[] = [{ ...base, id: 'account-1', name: 'Principal', type: 'checking', initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }]
const categories: Category[] = [{ ...base, id: 'category-1', name: 'Compra', kind: 'expense', icon: '●', archivedAt: null }]

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return { ...base, id: 'tx-1', kind: 'expense', amountCents: 1500, concept: 'Supermercado', note: '', date: '2026-01-10',
    accountId: 'account-1', categoryId: 'category-1', sourceAccountId: null, destinationAccountId: null,
    recurringRuleId: null, recurringOccurrenceDate: null, plannedItemId: null, ...overrides }
}

function showAllPeriods() {
  fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
  fireEvent.change(screen.getByLabelText('Periodo'), { target: { value: 'all' } })
}

function baseProps(transactions: Transaction[]) {
  return { transactions, accounts, categories, closures: [], onSave: vi.fn().mockResolvedValue(undefined), onDelete: vi.fn().mockResolvedValue(undefined) }
}

describe('MovementsView', () => {
  it('lists a movement with its account, category and author', () => {
    render(<MovementsView {...baseProps([transaction()])} />)
    showAllPeriods()
    expect(screen.getByText('Supermercado')).toBeInTheDocument()
    expect(screen.getByText(/Compra · Principal · David/)).toBeInTheDocument()
  })

  it('filters out movements that do not match the search query', () => {
    render(<MovementsView {...baseProps([transaction(), transaction({ id: 'tx-2', concept: 'Gasolina' })])} />)
    showAllPeriods()
    fireEvent.change(screen.getByPlaceholderText('Buscar concepto, nota, cuenta…'), { target: { value: 'gasolina' } })
    expect(screen.queryByText('Supermercado')).not.toBeInTheDocument()
    expect(screen.getByText('Gasolina')).toBeInTheDocument()
  })

  it('opens the add form and moves focus to its heading', async () => {
    render(<MovementsView {...baseProps([])} />)
    fireEvent.click(screen.getByLabelText('Añadir movimiento'))
    const heading = await screen.findByRole('heading', { name: 'Añadir movimiento' })
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('deletes a movement through its explicit action', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<MovementsView {...baseProps([transaction()])} onDelete={onDelete} />)
    showAllPeriods()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Supermercado' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-1' })))
  })

  it('locks a movement from a closed month instead of letting it be edited or deleted', () => {
    const closure = { ...base, id: 'closure-1', month: '2026-01', status: 'closed' as const, revision: 1, closedAt: '2026-01-31T20:00:00.000Z',
      closedBy: 'david' as const, reopenedAt: null, reopenedBy: null, transactionCount: 1, pendingIncomeCount: 0, pendingExpenseCount: 0,
      actualIncomeCents: 0, actualExpenseCents: 1500, realSurplusCents: -1500, projectedSurplusCents: 0, netWorthCents: 0, liquidityCents: 0,
      savingsCents: 0, investmentCents: 0, goalReservedCents: 0 }
    render(<MovementsView {...baseProps([transaction()])} closures={[closure]} />)
    showAllPeriods()
    expect(screen.getByRole('button', { name: 'Supermercado, mes cerrado' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Eliminar Supermercado' })).not.toBeInTheDocument()
  })
})

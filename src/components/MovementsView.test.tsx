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
  return { transactions, accounts, categories, closures: [], onSave: vi.fn().mockResolvedValue(undefined), onDelete: vi.fn().mockResolvedValue(undefined),
    onConvertToPlanned: vi.fn().mockResolvedValue(undefined) }
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

  it('offers converting a wrongly-entered future movement into a planned item', async () => {
    const onConvertToPlanned = vi.fn().mockResolvedValue(undefined)
    render(<MovementsView {...baseProps([transaction({ date: '2099-01-01' })])} onConvertToPlanned={onConvertToPlanned} />)
    showAllPeriods()
    fireEvent.click(screen.getByRole('button', { name: 'Convertir Supermercado en previsto' }))
    await waitFor(() => expect(onConvertToPlanned).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx-1' })))
  })

  it('does not offer converting a past movement or a transfer', () => {
    render(<MovementsView {...baseProps([
      transaction({ id: 'past', date: '2020-01-01' }),
      transaction({ id: 'transfer', kind: 'transfer', accountId: null, sourceAccountId: 'account-1', destinationAccountId: 'account-1', date: '2099-01-01' }),
    ])} />)
    showAllPeriods()
    expect(screen.queryByRole('button', { name: /Convertir .* en previsto/ })).not.toBeInTheDocument()
  })

  it('also offers converting a future movement already materialized from a recurrence or a planned item', () => {
    render(<MovementsView {...baseProps([
      transaction({ id: 'recurring', concept: 'Internet', date: '2099-01-01', recurringRuleId: 'rule-1', recurringOccurrenceDate: '2099-01-01' }),
      transaction({ id: 'planned', concept: 'Seguro', date: '2099-01-01', plannedItemId: 'planned-1' }),
    ])} />)
    showAllPeriods()
    expect(screen.getByRole('button', { name: 'Convertir Internet en previsto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Convertir Seguro en previsto' })).toBeInTheDocument()
  })

  it('shows the resulting account balance below the amount, using the destination account for transfers', () => {
    const twoAccounts: Account[] = [...accounts, { ...base, id: 'account-2', name: 'Ahorro', type: 'savings', initialBalanceCents: 5000, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }]
    const income = transaction({ id: 'tx-income', kind: 'income', amountCents: 12345, concept: 'Salario', date: '2026-01-05' })
    const transfer = transaction({ id: 'tx-transfer', kind: 'transfer', concept: 'Traspaso', amountCents: 3000, accountId: null, categoryId: null, sourceAccountId: 'account-1', destinationAccountId: 'account-2', date: '2026-01-06' })
    render(<MovementsView {...baseProps([income, transfer])} accounts={twoAccounts} />)
    showAllPeriods()
    expect(screen.getByText('123,45 €')).toBeInTheDocument()
    expect(screen.getByText('80,00 €')).toBeInTheDocument()
  })

  it('pre-filters the list by account and shows every period when opened with an initial account outside add mode', () => {
    render(<MovementsView {...baseProps([transaction({ date: '2020-01-01' })])} initialAccountId="account-1" />)
    expect(screen.getByText('Supermercado')).toBeInTheDocument()
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

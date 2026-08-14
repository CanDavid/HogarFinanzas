import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { localDateOnly } from '../domain/dates'
import type { Account, Category, Transaction } from '../domain/types'
import { BottomNavigation } from './BottomNavigation'
import { MovementsView } from './MovementsView'

const sync = { createdAt: '', updatedAt: '', deletedAt: null, version: 1, changeSequence: 1 }
const accounts: Account[] = [{ ...sync, id: 'account-1', createdBy: 'david', name: 'Principal', type: 'checking', initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }]
const categories: Category[] = [{ ...sync, id: 'category-1', createdBy: 'david', name: 'Alimentación', kind: 'expense', icon: '●', archivedAt: null }]
const transactions: Transaction[] = [
  { ...sync, id: 'expense-1', createdBy: 'david', kind: 'expense', amountCents: 1234, concept: 'Supermercado', note: 'Cena especial', date: localDateOnly(), accountId: 'account-1', categoryId: 'category-1', sourceAccountId: null, destinationAccountId: null },
  { ...sync, id: 'expense-2', createdBy: 'esther', kind: 'expense', amountCents: 500, concept: 'Café', note: '', date: localDateOnly(), accountId: 'account-1', categoryId: 'category-1', sourceAccountId: null, destinationAccountId: null },
]

describe('Phase 3 navigation and movements', () => {
  it('exposes the five primary areas and reports the active one', () => {
    const select = vi.fn()
    render(<BottomNavigation active="home" onSelect={select} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    expect(select).toHaveBeenCalledWith('plan')
  })

  it('searches notes and filters movements by member', () => {
    render(<MovementsView transactions={transactions} accounts={accounts} categories={categories} onSave={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'especial' } })
    expect(screen.getByText('Supermercado')).toBeInTheDocument()
    expect(screen.queryByText('Café')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    fireEvent.change(screen.getByLabelText('Registrado por'), { target: { value: 'esther' } })
    expect(screen.getByText('Café')).toBeInTheDocument()
    expect(screen.queryByText('Supermercado')).not.toBeInTheDocument()
  })

  it('opens the add form from the movements toolbar', () => {
    render(<MovementsView transactions={transactions} accounts={accounts} categories={categories} onSave={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir movimiento' }))
    expect(screen.getByRole('form', { name: 'Añadir movimiento' })).toBeInTheDocument()
  })
})

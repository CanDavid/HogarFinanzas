import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TransactionForm } from './TransactionForm'

const base = { createdAt: '', updatedAt: '', deletedAt: null, createdBy: 'david' as const, version: 1, changeSequence: 1, archivedAt: null }
const accounts = [
  { ...base, id: 'account-1', name: 'Principal', type: 'checking' as const, initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true },
  { ...base, id: 'account-2', name: 'Ahorro', type: 'savings' as const, initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: false },
]
const categories = [{ ...base, id: 'category-1', name: 'Compra', kind: 'expense' as const, icon: '●' }]

describe('TransactionForm', () => {
  it('submits integer cents at the UI boundary', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<TransactionForm accounts={accounts} categories={categories} onSave={save} />)
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '12,34' } })
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Compra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }))
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 1234, concept: 'Compra', kind: 'expense' })))
  })

  it('reports invalid decimal precision accessibly', async () => {
    render(<TransactionForm accounts={accounts} categories={categories} onSave={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '1,234' } })
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Compra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('importe válido')
  })

  it('submits a transfer as one movement with distinct accounts', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<TransactionForm accounts={accounts} categories={categories} onSave={save} />)
    fireEvent.click(screen.getByRole('button', { name: 'Transferencia' }))
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '25,00' } })
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'A ahorro' } })
    fireEvent.change(screen.getByLabelText('Cuenta origen'), { target: { value: 'account-1' } })
    fireEvent.change(screen.getByLabelText('Cuenta destino'), { target: { value: 'account-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }))
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'transfer', amountCents: 2500,
      accountId: null, categoryId: null, sourceAccountId: 'account-1', destinationAccountId: 'account-2' })))
  })

  it('allows a signed account adjustment without changing normal amount parsing', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<TransactionForm accounts={accounts} categories={categories} onSave={save} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ajuste' }))
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '-10,50' } })
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Corrección' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }))
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'adjustment', amountCents: -1050, accountId: 'account-1' })))
  })
})

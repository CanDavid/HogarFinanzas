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
    fireEvent.click(screen.getByText('Nota opcional'))
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: 'Compra semanal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }))
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 1234, concept: 'Compra', note: 'Compra semanal', kind: 'expense' })))
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

  it('offers an explicit negative adjustment without depending on the iPhone keyboard sign', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<TransactionForm accounts={accounts} categories={categories} initialKind="adjustment" initialAccountId="account-1" onSave={save} />)
    expect(screen.getByText('Ajuste manual de saldo')).toBeInTheDocument()
    expect(screen.getByLabelText('Importe')).toHaveAttribute('inputmode', 'decimal')
    fireEvent.click(screen.getByRole('button', { name: '− Restar saldo' }))
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '10,50' } })
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Corrección' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }))
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'adjustment', amountCents: -1050, accountId: 'account-1' })))
  })

  it('preserves the negative direction when editing an adjustment', () => {
    render(<TransactionForm accounts={accounts} categories={categories} transaction={{ ...base, id: 'adjustment-1', kind: 'adjustment', amountCents: -1050,
      concept: 'Corrección', note: '', date: '2026-08-15', accountId: 'account-1', categoryId: null, sourceAccountId: null, destinationAccountId: null }} onSave={vi.fn()} />)
    expect(screen.getByRole('button', { name: '− Restar saldo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Importe')).toHaveValue('10.50')
  })

  it('creates the current movement together with a future recurrence', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<TransactionForm accounts={accounts} categories={categories} onSave={save} />)
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '65,00' } })
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Internet' } })
    fireEvent.click(screen.getByLabelText('Se repite'))
    fireEvent.change(screen.getByLabelText('Frecuencia'), { target: { value: 'quarterly' } })
    fireEvent.change(screen.getByLabelText('Próxima fecha'), { target: { value: '2026-11-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }))
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ kind: 'expense', amountCents: 6500 }),
      expect.objectContaining({ frequency: 'quarterly', startDate: '2026-11-15', amountCents: 6500 })))
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TransactionForm } from './TransactionForm'

describe('TransactionForm', () => {
  it('submits integer cents at the UI boundary', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<TransactionForm onSave={save} />)
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '12,34' } })
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Compra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }))
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 1234, concept: 'Compra', kind: 'expense' })))
  })

  it('reports invalid decimal precision accessibly', async () => {
    render(<TransactionForm onSave={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '1,234' } })
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Compra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('importe válido')
  })
})

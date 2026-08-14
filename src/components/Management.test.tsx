import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccountManager } from './AccountManager'
import { CategoryManager } from './CategoryManager'

describe('Phase 2 management', () => {
  it('creates an account using integer cents', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    render(<AccountManager accounts={[]} balances={new Map()} onCreate={create} onUpdate={vi.fn()} onArchive={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Principal' } })
    fireEvent.change(screen.getByLabelText('Saldo inicial'), { target: { value: '123,45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cuenta' }))
    await vi.waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Principal', initialBalanceCents: 12345 })))
  })

  it('creates an expense category', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    render(<CategoryManager categories={[]} onCreate={create} onUpdate={vi.fn()} onArchive={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Alimentación' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoría' }))
    await vi.waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Alimentación', kind: 'expense', icon: '●' }))
  })
})

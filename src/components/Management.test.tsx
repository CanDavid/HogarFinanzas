import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccountManager } from './AccountManager'
import { CategoryManager } from './CategoryManager'

describe('Phase 2 management', () => {
  it('creates an account using integer cents', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    render(<AccountManager accounts={[]} balances={new Map()} onCreate={create} onUpdate={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Principal' } })
    fireEvent.change(screen.getByLabelText('Saldo inicial'), { target: { value: '123,45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cuenta' }))
    await vi.waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Principal', initialBalanceCents: 12345 })))
  })

  it('creates an expense category', async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    render(<CategoryManager categories={[]} onCreate={create} onUpdate={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Alimentación' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoría' }))
    await vi.waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Alimentación', kind: 'expense', icon: '●' }))
  })

  it('offers restoring an archived account', () => {
    const restore = vi.fn().mockResolvedValue(undefined)
    const account = { id: 'account-1', createdAt: '', updatedAt: '', deletedAt: null, createdBy: 'david' as const, version: 2, changeSequence: 2,
      name: 'Ahorro', type: 'savings' as const, initialBalanceCents: 1000, includeInNetWorth: true, includeInLiquidity: false, archivedAt: '2026-08-14T12:00:00.000Z' }
    render(<AccountManager accounts={[account]} balances={new Map([[account.id, 1000]])} onCreate={vi.fn()} onUpdate={vi.fn()} onArchive={vi.fn()} onRestore={restore} />)
    fireEvent.click(screen.getByRole('button', { name: 'Desarchivar' }))
    expect(restore).toHaveBeenCalledWith(account.id)
  })

  it('opens balance adjustments from an active account', () => {
    const adjust = vi.fn()
    const account = { id: 'account-1', createdAt: '', updatedAt: '', deletedAt: null, createdBy: 'david' as const, version: 1, changeSequence: 1,
      name: 'Principal', type: 'checking' as const, initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }
    render(<AccountManager accounts={[account]} balances={new Map()} onCreate={vi.fn()} onUpdate={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} onAdjustBalance={adjust} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar saldo' }))
    expect(adjust).toHaveBeenCalledWith(account.id)
  })

  it('in browse mode, selecting an account navigates instead of editing it and hides management controls', () => {
    const select = vi.fn()
    const account = { id: 'account-1', createdAt: '', updatedAt: '', deletedAt: null, createdBy: 'david' as const, version: 1, changeSequence: 1,
      name: 'Principal', type: 'checking' as const, initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }
    render(<AccountManager accounts={[account]} balances={new Map()} onCreate={vi.fn()} onUpdate={vi.fn()} onArchive={vi.fn()} onRestore={vi.fn()} onSelectAccount={select} />)
    fireEvent.click(screen.getByRole('button', { name: /Principal/ }))
    expect(select).toHaveBeenCalledWith(account.id)
    expect(screen.queryByLabelText('Nombre')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajustar saldo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument()
  })
})

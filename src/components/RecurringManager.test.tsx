import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Account, Category, RecurringRule } from '../domain/types'
import { RecurringManager } from './RecurringManager'

const sync = { createdAt: '2026-08-15T10:00:00.000Z', updatedAt: '2026-08-15T10:00:00.000Z', deletedAt: null, createdBy: 'david' as const, version: 1, changeSequence: 1 }
const account: Account = { ...sync, id: 'account-1', name: 'Principal', type: 'checking', initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }
const category: Category = { ...sync, id: 'category-1', name: 'Vivienda', kind: 'expense', icon: '●', archivedAt: null }
const rule: RecurringRule = { ...sync, id: 'rule-1', kind: 'expense', amountCents: 6500, concept: 'Internet', note: '', accountId: account.id,
  categoryId: category.id, frequency: 'monthly', startDate: '2026-09-01', endDate: null, active: true }

describe('RecurringManager', () => {
  it('shows future occurrences and exposes idempotent materialization', async () => {
    const materialize = vi.fn().mockResolvedValue(undefined)
    render(<RecurringManager rules={[rule]} transactions={[]} accounts={[account]} categories={[category]} onCreate={vi.fn()} onUpdate={vi.fn()}
      onSetActive={vi.fn()} onMaterialize={materialize} />)
    expect(screen.getByText('Mensual', { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar' })[0])
    await vi.waitFor(() => expect(materialize).toHaveBeenCalledWith(rule.id, '2026-09-01'))
  })

  it('pauses and reactivates a rule without deleting it', async () => {
    const setActive = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<RecurringManager rules={[rule]} transactions={[]} accounts={[account]} categories={[category]} onCreate={vi.fn()} onUpdate={vi.fn()}
      onSetActive={setActive} onMaterialize={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    await vi.waitFor(() => expect(setActive).toHaveBeenCalledWith(rule.id, false))
    rerender(<RecurringManager rules={[{ ...rule, active: false }]} transactions={[]} accounts={[account]} categories={[category]} onCreate={vi.fn()} onUpdate={vi.fn()}
      onSetActive={setActive} onMaterialize={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }))
    await vi.waitFor(() => expect(setActive).toHaveBeenCalledWith(rule.id, true))
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PortfolioView } from './PortfolioView'
import type { Account, Goal, GoalAllocation } from '../domain/types'

describe('PortfolioView', () => {
  it('shows account balances, virtual reservations and unassigned net worth without mixing them', () => {
    const common = { createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z', deletedAt: null,
      createdBy: 'david' as const, version: 1, changeSequence: 1 }
    const accounts: Account[] = [{ ...common, id: 'account-1', name: 'Ahorro', type: 'savings', initialBalanceCents: 100_000,
      includeInNetWorth: true, includeInLiquidity: false, archivedAt: null }]
    const goals: Goal[] = [{ ...common, id: 'goal-1', name: 'Viaje', targetAmountCents: 80_000, targetDate: null, icon: '✈️', note: '', completedAt: null, archivedAt: null }]
    const allocations: GoalAllocation[] = [{ ...common, id: 'allocation-1', goalId: 'goal-1', amountCents: 30_000, date: '2026-08-15', note: '' }]
    render(<PortfolioView accounts={accounts} transactions={[]} goals={goals} allocations={allocations} onManageAccounts={vi.fn()} />)
    expect(screen.getAllByText(/1000,00/)).toHaveLength(3)
    expect(screen.getByText(/300,00/)).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === '+700,00 €')).toBeInTheDocument()
    expect(screen.getByText(/reservan dinero de forma virtual/)).toBeInTheDocument()
  })
})

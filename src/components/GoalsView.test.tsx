import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GoalsView } from './GoalsView'
import type { Goal, GoalAllocation } from '../domain/types'

const goal: Goal = { id: 'goal-1', createdAt: '2026-06-01T10:00:00.000Z', updatedAt: '2026-06-01T10:00:00.000Z', deletedAt: null,
  createdBy: 'david', version: 1, changeSequence: 1, name: 'Viaje', targetAmountCents: 100_000, targetDate: '2027-06-01',
  icon: '✈️', note: 'Vacaciones familiares', completedAt: null, archivedAt: null }
const allocation: GoalAllocation = { id: 'allocation-1', createdAt: '2026-07-01T10:00:00.000Z', updatedAt: '2026-07-01T10:00:00.000Z',
  deletedAt: null, createdBy: 'esther', version: 1, changeSequence: 2, goalId: goal.id, amountCents: 25_000, date: '2026-07-01', note: 'Verano' }

function props() {
  return { goals: [goal], allocations: [allocation], netWorthCents: 200_000, onCreate: vi.fn(), onUpdate: vi.fn(),
    onSetCompleted: vi.fn(), onArchive: vi.fn(), onRestore: vi.fn(), onAllocate: vi.fn().mockResolvedValue(undefined) }
}

describe('GoalsView', () => {
  it('shows virtual assignment separately from net worth and opens its history', () => {
    render(<GoalsView {...props()} />)
    expect(screen.getAllByText(/250,00/)).toHaveLength(2)
    expect(screen.getByText('Patrimonio total')).toBeInTheDocument()
    expect(screen.getByLabelText('Viaje: 25% completado')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Viaje'))
    expect(screen.getByText('Vacaciones familiares')).toBeInTheDocument()
    expect(screen.getByText(/Esther · Verano/)).toBeInTheDocument()
  })

  it('uses an explicit withdrawal control and submits signed integer cents', async () => {
    const handlers = props(); render(<GoalsView {...handlers} />); fireEvent.click(screen.getByText('Viaje'))
    fireEvent.click(screen.getByRole('button', { name: '− Retirar' }))
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '10,50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar retirada' }))
    await waitFor(() => expect(handlers.onAllocate).toHaveBeenCalledWith(goal.id,
      expect.objectContaining({ amountCents: -1050, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })))
  })
})

import { describe, expect, it } from 'vitest'
import { buildGoalPortfolio } from './goals'
import type { Goal, GoalAllocation } from './types'

function goal(overrides: Partial<Goal> = {}): Goal {
  return { id: 'goal-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
    createdBy: 'david', version: 1, changeSequence: 1, name: 'Viaje', targetAmountCents: 100_000, targetDate: null,
    icon: '✈️', note: '', completedAt: null, archivedAt: null, ...overrides }
}

function allocation(id: string, amountCents: number, date: string): GoalAllocation {
  return { id, createdAt: `${date}T10:00:00.000Z`, updatedAt: `${date}T10:00:00.000Z`, deletedAt: null, createdBy: 'esther',
    version: 1, changeSequence: 1, goalId: 'goal-1', amountCents, date, note: '' }
}

describe('goal portfolio', () => {
  it('adds contributions and withdrawals without changing net worth', () => {
    const result = buildGoalPortfolio([goal()], [allocation('a', 40_000, '2026-06-01'), allocation('b', -5_000, '2026-07-01')], 250_000, '2026-08-15')
    expect(result.goals[0]).toMatchObject({ assignedCents: 35_000, remainingCents: 65_000, overallocatedCents: 0, percentage: 35 })
    expect(result).toMatchObject({ reservedCents: 35_000, unassignedNetWorthCents: 215_000 })
  })

  it('keeps completed goals reserved and releases archived goals', () => {
    const saved = allocation('a', 30_000, '2026-08-01')
    expect(buildGoalPortfolio([goal({ completedAt: '2026-08-10T00:00:00.000Z' })], [saved], 100_000, '2026-08-15').reservedCents).toBe(30_000)
    const archived = buildGoalPortfolio([goal({ archivedAt: '2026-08-11T00:00:00.000Z' })], [saved], 100_000, '2026-08-15')
    expect(archived.reservedCents).toBe(0)
    expect(archived.goals[0].allocations).toHaveLength(1)
  })

  it('calculates a deterministic monthly pace, estimate and overage', () => {
    const paced = buildGoalPortfolio([goal()], [allocation('a', 10_000, '2026-06-01'), allocation('b', 20_000, '2026-08-01')], 100_000, '2026-08-15').goals[0]
    expect(paced.monthlyAverageCents).toBe(10_000)
    expect(paced.estimatedCompletionMonth).toBe('2027-03')
    const exceeded = buildGoalPortfolio([goal()], [allocation('c', 120_000, '2026-08-01')], 200_000, '2026-08-15').goals[0]
    expect(exceeded).toMatchObject({ remainingCents: 0, overallocatedCents: 20_000, percentage: 120 })
  })
})

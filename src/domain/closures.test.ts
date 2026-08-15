import { describe, expect, it } from 'vitest'
import { closureForMonth, isMonthClosed, latestClosedClosure, netWorthChangeSinceClosure, validateClosureInput } from './closures'
import type { MonthlyClosure } from './types'

const base = { id: 'closure', createdAt: '2026-07-31T22:00:00.000Z', updatedAt: '2026-07-31T22:00:00.000Z', deletedAt: null,
  createdBy: 'david' as const, version: 1, changeSequence: 1, status: 'closed' as const, revision: 1,
  month: '2026-07',
  closedAt: '2026-07-31T22:00:00.000Z', closedBy: 'david' as const, reopenedAt: null, reopenedBy: null,
  transactionCount: 2, pendingIncomeCount: 0, pendingExpenseCount: 1, actualIncomeCents: 10_000, actualExpenseCents: 4_000,
  realSurplusCents: 6_000, projectedSurplusCents: 5_000, netWorthCents: -2_000, liquidityCents: -3_000,
  savingsCents: -1_000, investmentCents: 2_000, goalReservedCents: 0 }

describe('monthly closures', () => {
  it('finds the latest closed snapshot before a month and ignores reopened records', () => {
    const july: MonthlyClosure = { ...base, month: '2026-07' }
    const june: MonthlyClosure = { ...base, id: 'june', month: '2026-06', status: 'open' }
    expect(latestClosedClosure([june, july], '2026-08')).toBe(july)
    expect(isMonthClosed('2026-06', [june, july])).toBe(false)
    expect(closureForMonth('2026-06', [june, july])).toBe(june)
    expect(netWorthChangeSinceClosure(3_000, july)).toBe(5_000)
  })

  it('accepts signed portfolio balances but rejects an inconsistent real result', () => {
    expect(() => validateClosureInput(base)).not.toThrow()
    expect(() => validateClosureInput({ ...base, realSurplusCents: 5_999 })).toThrow('no cuadra')
  })
})

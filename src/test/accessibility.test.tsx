import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it, vi } from 'vitest'
import { AnalysisView } from '../components/AnalysisView'
import { BackupManager } from '../components/BackupManager'
import { MovementsView } from '../components/MovementsView'
import { localDateOnly } from '../domain/dates'
import type { Account, Category, Transaction } from '../domain/types'

const today = localDateOnly()
const sync = { createdAt: `${today}T10:00:00.000Z`, updatedAt: `${today}T10:00:00.000Z`, deletedAt: null, createdBy: 'david' as const, version: 1, changeSequence: 1 }
const category: Category = { ...sync, id: 'food', name: 'Alimentación', kind: 'expense', icon: '🍓', archivedAt: null }
const account: Account = { ...sync, id: 'account-1', name: 'Principal', type: 'checking', initialBalanceCents: 0, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }
const transaction: Transaction = { ...sync, id: 'expense', kind: 'expense', amountCents: 1_500, concept: 'Supermercado', note: '', date: today,
  accountId: account.id, categoryId: category.id, sourceAccountId: null, destinationAccountId: null, recurringRuleId: null, recurringOccurrenceDate: null, plannedItemId: null }

describe('accessibility smoke tests', () => {
  it('AnalysisView has no critical accessibility violations', async () => {
    const { container } = render(<AnalysisView transactions={[transaction]} budgets={[]} categories={[category]} closures={[]} goals={[]} allocations={[]} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('MovementsView has no critical accessibility violations', async () => {
    const { container } = render(<MovementsView transactions={[transaction]} accounts={[account]} categories={[category]} closures={[]}
      onSave={vi.fn().mockResolvedValue(undefined)} onDelete={vi.fn().mockResolvedValue(undefined)} onConvertToPlanned={vi.fn().mockResolvedValue(undefined)} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('BackupManager has no critical accessibility violations', async () => {
    const { container } = render(<BackupManager userId="david" hasLocalData={false} accounts={[account]} categories={[category]} transactions={[transaction]}
      recurringRules={[]} budgets={[]} plannedItems={[]} monthlyPlans={[]} goals={[]} goalAllocations={[]} monthlyClosures={[]}
      onImport={vi.fn().mockResolvedValue(undefined)} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

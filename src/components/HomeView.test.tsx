import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomeView } from './HomeView'
import { localDateOnly } from '../domain/dates'
import type { Account, Category, PlannedItem, Transaction } from '../domain/types'

const today = localDateOnly(); const month = today.slice(0, 7)
const sync = { createdAt: `${today}T10:00:00.000Z`, updatedAt: `${today}T10:00:00.000Z`, deletedAt: null, createdBy: 'david' as const, version: 1, changeSequence: 1 }
const account: Account = { ...sync, id: 'account-1', name: 'Principal', type: 'checking', initialBalanceCents: 100_000, includeInNetWorth: true, includeInLiquidity: true, archivedAt: null }
const category: Category = { ...sync, id: 'category-1', name: 'Vivienda', kind: 'expense', icon: '●', archivedAt: null }
const expense: Transaction = { ...sync, id: 'expense', kind: 'expense', amountCents: 12_000, concept: 'Compra', note: '', date: `${month}-02`,
  accountId: account.id, categoryId: category.id, sourceAccountId: null, destinationAccountId: null, recurringRuleId: null, recurringOccurrenceDate: null, plannedItemId: null }
const pendingPlanned: PlannedItem = { ...sync, id: 'planned-1', source: 'manual', recurringRuleId: null, kind: 'expense', amountCents: 6_500,
  concept: 'Reforma', note: '', date: `${month}-25`, accountId: account.id, categoryId: category.id, status: 'pending' }

function props(overrides: Partial<Parameters<typeof HomeView>[0]> = {}) {
  return {
    transactions: [expense], accounts: [account], categories: [category], goals: [], allocations: [], closures: [],
    recurringRules: [], plannedItems: [pendingPlanned], budgets: [],
    monthlyPlans: [], onAddMovement: vi.fn(), onOpenMovements: vi.fn(), onOpenPortfolio: vi.fn(), onOpenGoals: vi.fn(),
    onOpenAccounts: vi.fn(), onOpenCategories: vi.fn(), ...overrides,
  }
}

describe('HomeView', () => {
  it('shows real income, expenses and result alongside pending expenses for the current month', () => {
    render(<HomeView {...props()} />)
    expect(screen.getByText('Gastos previstos')).toBeInTheDocument()
    expect(screen.getAllByText('120,00 €')).toHaveLength(1)
    expect(screen.getByText('65,00 €')).toBeInTheDocument()
  })

  it('stops counting a planned item as pending once it has been materialized into a real movement', () => {
    const materializedTransaction: Transaction = { ...expense, id: 'materialized', concept: 'Reforma', amountCents: 6_500,
      date: `${month}-25`, plannedItemId: pendingPlanned.id }
    render(<HomeView {...props({ transactions: [expense, materializedTransaction] })} />)
    expect(screen.queryByText('65,00 €')).not.toBeInTheDocument()
  })
})

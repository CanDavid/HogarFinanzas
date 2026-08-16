import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BackupManager } from './BackupManager'
import { BACKUP_SCHEMA_VERSION, type BackupPayload } from '../domain/backup'

function props(overrides: Partial<Parameters<typeof BackupManager>[0]> = {}) {
  return {
    userId: 'david' as const, hasLocalData: false,
    accounts: [], categories: [], transactions: [], recurringRules: [], budgets: [], plannedItems: [],
    monthlyPlans: [], goals: [], goalAllocations: [], monthlyClosures: [],
    onImport: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function validPayload(): BackupPayload {
  return { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: '2026-08-16T10:00:00.000Z', exportedBy: 'esther',
    accounts: [], categories: [], transactions: [], recurringRules: [], budgets: [], plannedItems: [],
    monthlyPlans: [], goals: [], goalAllocations: [], monthlyClosures: [] }
}

describe('BackupManager', () => {
  afterEach(() => vi.restoreAllMocks())

  it('exports a JSON file named after the export date', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<BackupManager {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Exportar copia' }))
    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('hides the restore form when the device already has local data', () => {
    render(<BackupManager {...props({ hasLocalData: true })} />)
    expect(screen.getByText(/recién inicializada/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Selecciona un archivo de copia')).not.toBeInTheDocument()
  })

  it('shows a summary before restoring a valid backup file and confirms explicitly', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined)
    render(<BackupManager {...props({ onImport })} />)
    const file = new File([JSON.stringify(validPayload())], 'copia.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Selecciona un archivo de copia'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText(/Vas a restaurar/)).toBeInTheDocument())
    expect(onImport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar restauración' }))
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(validPayload()))
  })

  it('shows an error for a malformed backup file without importing', async () => {
    const onImport = vi.fn()
    render(<BackupManager {...props({ onImport })} />)
    const file = new File(['{"schemaVersion": 99}'], 'copia.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Selecciona un archivo de copia'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('no es compatible'))
    expect(onImport).not.toHaveBeenCalled()
  })
})

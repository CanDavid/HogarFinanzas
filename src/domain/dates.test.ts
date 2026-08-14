import { describe, expect, it } from 'vitest'
import { localDateOnly, monthRange, normalizeDateOnly } from './dates'

describe('normalizeDateOnly', () => {
  it('preserves an ISO date without timezone conversion', () => {
    expect(normalizeDateOnly('2026-08-14')).toBe('2026-08-14')
  })

  it('repairs the textual Date representation returned by Google Sheets', () => {
    expect(normalizeDateOnly('Fri Aug 14 2026 00:00:00 GMT+0200 (Central European Summer Time)')).toBe('2026-08-14')
  })

  it('rejects values that cannot represent a date', () => {
    expect(normalizeDateOnly('fecha rota')).toBeNull()
  })
})

describe('calendar helpers', () => {
  it('uses local calendar fields instead of UTC for today', () => {
    expect(localDateOnly(new Date(2026, 7, 15, 23, 30))).toBe('2026-08-15')
  })

  it('returns month boundaries across years', () => {
    expect(monthRange('2026-01-12', -1)).toEqual({ from: '2025-12-01', to: '2025-12-31' })
    expect(monthRange('2026-02-12')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
})

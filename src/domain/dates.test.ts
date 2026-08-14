import { describe, expect, it } from 'vitest'
import { normalizeDateOnly } from './dates'

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

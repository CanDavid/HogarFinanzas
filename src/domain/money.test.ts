import { describe, expect, it } from 'vitest'
import { formatEuro, parseEuroToCents } from './money'

describe('money boundaries', () => {
  it.each([['12', 1200], ['12,3', 1230], ['12.34', 1234], ['0,01', 1]])('parses %s exactly', (input, expected) => {
    expect(parseEuroToCents(input)).toBe(expected)
  })

  it.each(['0', '-1', '1,234', 'texto'])('rejects invalid amount %s', (input) => {
    expect(() => parseEuroToCents(input)).toThrow()
  })

  it('formats integer cents as euros', () => {
    expect(formatEuro(1234)).toContain('12,34')
  })
})

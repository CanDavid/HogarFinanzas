// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

function loadScript() {
  const outputs: string[] = []
  const context: Record<string, unknown> = {
    Date, JSON, Math, Number, String, Error,
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput(value: string) {
        outputs.push(value)
        return { setMimeType() { return this } }
      },
    },
  }
  runInNewContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), context)
  return { context, outputs }
}

describe('Apps Script public router', () => {
  it('returns a minimal health response without financial data', () => {
    const { context, outputs } = loadScript()
    ;(context.doGet as () => unknown)()
    expect(JSON.parse(outputs[0])).toEqual({ ok: true, data: { service: 'Hogar Finanzas', version: '4.0.0-phase4' } })
  })

  it('rejects unknown actions with a stable envelope', () => {
    const { context, outputs } = loadScript()
    ;(context.doPost as (event: unknown) => unknown)({ postData: { contents: '{"action":"future"}' } })
    expect(JSON.parse(outputs[0])).toEqual({ ok: false, error: { code: 'unknown_action', message: 'Acción no reconocida.' } })
  })

  it('compares secrets without returning early on matching prefixes', () => {
    const { context } = loadScript()
    const compare = context.constantTimeEqual_ as (left: string, right: string) => boolean
    expect(compare('abcdef', 'abcdef')).toBe(true)
    expect(compare('abcdef', 'abcdeg')).toBe(false)
    expect(compare('abc', 'abcd')).toBe(false)
  })

  it('rejects identities outside David and Esther before reading credentials', () => {
    const { context } = loadScript()
    expect(() => (context.login_ as (request: unknown) => unknown)({ userId: 'otro', householdKey: '1234567890' })).toThrow('Usuario no permitido')
  })
})

import { describe, expect, it } from 'vitest'
import { SingleFlightRunner } from './singleFlightRunner'

describe('SingleFlightRunner', () => {
  it('serializes overlapping requests and performs a final pass', async () => {
    const runner = new SingleFlightRunner(); let releaseFirst!: () => void
    const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve })
    let calls = 0; let active = 0; let maximumActive = 0
    const task = async () => {
      calls += 1; active += 1; maximumActive = Math.max(maximumActive, active)
      if (calls === 1) await firstBlocked
      active -= 1
    }
    const first = runner.run(task)
    const overlapping = runner.run(task)
    expect(overlapping).toBe(first)
    releaseFirst(); await first
    expect(calls).toBe(2)
    expect(maximumActive).toBe(1)
  })
})

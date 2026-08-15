export class SingleFlightRunner {
  private inFlight: Promise<void> | null = null
  private runAgain = false

  run(task: () => Promise<void>): Promise<void> {
    if (this.inFlight) {
      this.runAgain = true
      return this.inFlight
    }
    const execution = (async () => {
      do {
        this.runAgain = false
        await task()
      } while (this.runAgain)
    })()
    this.inFlight = execution.finally(() => { this.inFlight = null })
    return this.inFlight
  }
}

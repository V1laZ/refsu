export interface RateLimiterOptions {
  maxRequests: number
  intervalMs: number
}

export class RateLimiter {
  private readonly maxRequests: number
  private readonly intervalMs: number
  private readonly queue: Array<() => void> = []
  private startTimes: number[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor({ maxRequests, intervalMs }: RateLimiterOptions) {
    this.maxRequests = maxRequests
    this.intervalMs = intervalMs
  }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        task().then(resolve, reject)
      })
      this.process()
    })
  }

  private process() {
    const now = Date.now()
    this.startTimes = this.startTimes.filter(t => now - t < this.intervalMs)

    while (this.queue.length > 0 && this.startTimes.length < this.maxRequests) {
      this.startTimes.push(now)
      const run = this.queue.shift()!
      run()
    }

    if (this.queue.length > 0 && this.timer === null) {
      const waitMs = this.intervalMs - (now - this.startTimes[0])
      this.timer = setTimeout(() => {
        this.timer = null
        this.process()
      }, Math.max(0, waitMs))
    }
  }
}

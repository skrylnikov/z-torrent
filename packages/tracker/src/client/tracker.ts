import { EventEmitter } from 'eventemitter3'

import type { TrackerClientContext } from '../client-context.js'

export class Tracker extends EventEmitter {
  client: TrackerClientContext
  announceUrl: string
  interval: ReturnType<typeof setInterval> | null
  destroyed: boolean
  DEFAULT_ANNOUNCE_INTERVAL = 30 * 60 * 1000

  constructor(client: TrackerClientContext, announceUrl: string) {
    super()

    this.client = client
    this.announceUrl = announceUrl

    this.interval = null
    this.destroyed = false
  }

  setInterval(intervalMs?: number): void {
    if (intervalMs == null) intervalMs = this.DEFAULT_ANNOUNCE_INTERVAL

    clearInterval(this.interval!)

    if (intervalMs) {
      this.interval = setInterval(() => {
        this.announce(this.client.getDefaultAnnounceOpts())
      }, intervalMs)
      if (this.interval.unref) this.interval.unref()
    }
  }

  announce(_opts: unknown): void {
    throw new Error('announce must be implemented by subclass')
  }

  scrape(_opts: unknown): void {
    throw new Error('scrape must be implemented by subclass')
  }

  destroy(_cb?: (err?: Error | null) => void): void {
    throw new Error('destroy must be implemented by subclass')
  }
}

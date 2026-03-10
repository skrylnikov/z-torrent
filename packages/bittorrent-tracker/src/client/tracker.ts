import { EventEmitter } from 'eventemitter3'

class Tracker extends EventEmitter {
  client: any
  announceUrl: string
  interval: NodeJS.Timeout | null
  destroyed: boolean
  DEFAULT_ANNOUNCE_INTERVAL: number = 30 * 60 * 1000

  constructor(client: any, announceUrl: string) {
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
        this.announce(this.client._defaultAnnounceOpts())
      }, intervalMs)
      if (this.interval.unref) this.interval.unref()
    }
  }

  announce(_opts: any): void {
    throw new Error('announce must be implemented by subclass')
  }

  scrape(_opts: any): void {
    throw new Error('scrape must be implemented by subclass')
  }

  destroy(_cb?: (err?: Error | null) => void): void {
    throw new Error('destroy must be implemented by subclass')
  }
}

export default Tracker

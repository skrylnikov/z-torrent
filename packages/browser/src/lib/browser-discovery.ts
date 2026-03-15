/**
 * Browser-only peer discovery — WebSocket trackers only.
 * No DHT, LSD, HTTP or UDP trackers (Node.js-only).
 */

import Tracker from '@z-torrent/tracker/client'
import type { Discovery, DiscoveryOptions } from '../../../core/src/interfaces.js'

/** Minimal EventEmitter (no eventemitter3 dep) */
class DiscoveryEmitter implements Discovery {
  private _listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  on(event: string, fn: (...args: unknown[]) => void): void {
    ;(this._listeners[event] ??= []).push(fn)
  }
  removeListener(event: string, fn: (...args: unknown[]) => void): void {
    const arr = this._listeners[event]
    if (arr) {
      const i = arr.indexOf(fn)
      if (i >= 0) arr.splice(i, 1)
    }
  }
  emit(event: string, ...args: unknown[]): void {
    for (const fn of this._listeners[event] ?? []) fn(...args)
  }
}

function isWebSocketUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:'
  } catch {
    return false
  }
}

class BrowserDiscovery extends DiscoveryEmitter implements Discovery {
  private _tracker: Tracker | null = null
  private _announce: string[] = []
  destroyed = false

  constructor(opts: DiscoveryOptions) {
    super()
    const wsAnnounce = (opts.announce || []).filter(isWebSocketUrl)
    if (wsAnnounce.length === 0) {
      console.warn(
        '[z-torrent] No WebSocket trackers (wss://) in announce list — P2P discovery disabled. announce=',
        opts.announce
      )
      return
    }
    const trackerOpts = (opts.tracker || {}) as Record<string, unknown>
    this._tracker = new Tracker({
      infoHash: opts.infoHash,
      peerId: opts.peerId,
      port: opts.port,
      announce: wsAnnounce,
      getAnnounceOpts: trackerOpts.getAnnounceOpts as (() => Record<string, unknown>) | undefined,
      userAgent: opts.userAgent,
    })
    this._tracker.on('warning', (err: Error) => this.emit('warning', err))
    this._tracker.on('error', (err: Error) => this.emit('error', err))
    this._tracker.on('peer', (peer: string) => this.emit('peer', peer as unknown, 'tracker'))
    this._tracker.on('update', () => this.emit('trackerAnnounce'))
    this._tracker.setInterval(opts.intervalMs ?? 15 * 60 * 1000)
    this._tracker.start()
  }

  complete(opts?: object): void {
    if (this._tracker && !this.destroyed) {
      this._tracker.complete(opts)
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this._tracker) {
      this._tracker.destroy()
      this._tracker = null
    }
  }
}

export default BrowserDiscovery

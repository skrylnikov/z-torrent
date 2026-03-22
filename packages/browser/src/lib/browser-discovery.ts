/**
 * Browser-only peer discovery — WebSocket trackers only.
 * No DHT, LSD, HTTP or UDP trackers (Node.js-only).
 */

import { Client } from '@z-torrent/tracker/client'
import type { Discovery, DiscoveryOptions } from '@z-torrent/core'

function isWebSocketUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:'
  } catch {
    return false
  }
}

export class BrowserDiscovery implements Discovery {
  #listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  #tracker: InstanceType<typeof Client> | null = null
  destroyed = false

  constructor(opts: DiscoveryOptions) {
    const wsAnnounce = (opts.announce || []).filter(isWebSocketUrl)
    if (wsAnnounce.length === 0) {
      console.warn(
        '[z-torrent] No WebSocket trackers (wss://) in announce list — P2P discovery disabled. announce=',
        opts.announce
      )
      return
    }
    const trackerOpts = (opts.tracker || {}) as Record<string, unknown>
    this.#tracker = new Client({
      infoHash: opts.infoHash,
      peerId: opts.peerId,
      port: opts.port,
      announce: wsAnnounce,
      getAnnounceOpts: trackerOpts.getAnnounceOpts as (() => Record<string, unknown>) | undefined,
      userAgent: opts.userAgent,
    })
    this.#tracker.on('warning', (err: Error) => this.#emit('warning', err))
    this.#tracker.on('error', (err: Error) => this.#emit('error', err))
    this.#tracker.on('peer', (peer: string) => this.#emit('peer', peer as unknown, 'tracker'))
    this.#tracker.on('update', () => this.#emit('trackerAnnounce'))
    this.#tracker.setInterval(opts.intervalMs ?? 15 * 60 * 1000)
    this.#tracker.start()
  }

  on(event: string, fn: (...args: unknown[]) => void): void {
    ;(this.#listeners[event] ??= []).push(fn)
  }

  removeListener(event: string, fn: (...args: unknown[]) => void): void {
    const arr = this.#listeners[event]
    if (arr) {
      const i = arr.indexOf(fn)
      if (i >= 0) arr.splice(i, 1)
    }
  }

  #emit(event: string, ...args: unknown[]): void {
    for (const fn of this.#listeners[event] ?? []) fn(...args)
  }

  complete(opts?: object): void {
    if (this.#tracker && !this.destroyed) {
      this.#tracker.complete(opts)
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.#tracker) {
      this.#tracker.destroy()
      this.#tracker = null
    }
  }
}

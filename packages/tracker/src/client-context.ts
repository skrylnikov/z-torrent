import type { EventEmitter } from 'eventemitter3'

export interface TrackerProxyOpts {
  httpsAgent?: unknown
  httpAgent?: unknown
  socksProxy?: unknown
}

/** Subset of {@link Client} exposed to protocol tracker implementations. */
export interface TrackerClientContext extends EventEmitter {
  readonly infoHash: string
  readonly peerId: string
  readonly infoHashBinary: string
  readonly peerIdBinary: string
  readonly infoHashBuffer: Uint8Array
  readonly peerIdBuffer: Uint8Array
  readonly port: number
  readonly userAgent?: string
  readonly rtcConfig?: RTCConfiguration
  readonly wrtc?: unknown
  readonly proxyOpts?: TrackerProxyOpts
  getDefaultAnnounceOpts(opts?: Record<string, unknown>): object & { event?: string }
}

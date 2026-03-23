import arrayRemove from 'unordered-array-remove'
import Debug from 'debug'
import dgram, { Socket } from 'dgram'
import Socks from 'socks'
import { concat, hex2arr, randomBytes } from 'uint8-util'

import * as common from '../common.js'
import type { TrackerClientContext } from '../client-context.js'
import { Tracker } from './tracker.js'
import { compact2stringMulti } from '@z-torrent/utils'

const debug = Debug('@z-torrent/tracker:udp-tracker')

const clone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

interface AnnounceOpts {
  uploaded?: number
  downloaded?: number
  left?: number | string
  numwant?: number
  event?: string
  infoHash?: string | string[] | Uint8Array
  _scrape?: boolean
}

export class UDPTracker extends Tracker {
  cleanupFns: Array<() => void>
  maybeDestroyCleanup: (() => void) | null
  DEFAULT_ANNOUNCE_INTERVAL = 30 * 60 * 1000

  constructor(client: TrackerClientContext, announceUrl: string) {
    super(client, announceUrl)
    debug('new udp tracker %s', announceUrl)

    this.cleanupFns = []
    this.maybeDestroyCleanup = null
  }

  announce(opts: AnnounceOpts): void {
    if (this.destroyed) return
    this._request(opts)
  }

  scrape(opts: AnnounceOpts): void {
    if (this.destroyed) return
    opts._scrape = true
    this._request(opts)
  }

  destroy(cb?: (err?: Error | null) => void): void {
    const self = this
    if (this.destroyed) return cb?.()
    this.destroyed = true
    clearInterval(this.interval!)

    let timeout: NodeJS.Timeout | null

    if (this.cleanupFns.length === 0) return destroyCleanup()

    timeout = setTimeout(destroyCleanup, common.DESTROY_TIMEOUT)

    this.maybeDestroyCleanup = () => {
      if (this.cleanupFns.length === 0) destroyCleanup()
    }

    function destroyCleanup() {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      self.maybeDestroyCleanup = null
      self.cleanupFns.slice(0).forEach((cleanup) => {
        cleanup()
      })
      self.cleanupFns = []
      cb?.()
    }
  }

  _request(opts: AnnounceOpts): void {
    const self = this
    if (!opts) opts = {}

    let { hostname, port } = common.parseUrl(this.announceUrl)
    if (port === '') port = '80'

    let timeout: NodeJS.Timeout | null
    let proxySocket: any
    let socket: Socket | null
    let relay: any

    let transactionId = genTransactionId()

    let proxyOpts: Record<string, any> | undefined
    if (this.client.proxyOpts?.socksProxy) {
      proxyOpts = clone(this.client.proxyOpts.socksProxy) as Record<string, any>
    }
    if (proxyOpts) {
      if (!proxyOpts.proxy) proxyOpts.proxy = {}
      proxyOpts.proxy.command = 'associate'
      if (!proxyOpts.target) {
        proxyOpts.target = {
          host: '0.0.0.0',
          port: 0,
        }
      }

      if (proxyOpts.proxy.type === 5) {
        Socks.SocksClient.createConnection(
          proxyOpts as Parameters<typeof Socks.SocksClient.createConnection>[0],
          onGotConnection as any
        )
      } else {
        debug('Ignoring Socks proxy for UDP request because type 5 is required')
        onGotConnection(null, null, null)
      }
    } else {
      onGotConnection(null, null, null)
    }

    this.cleanupFns.push(cleanup)

    function onGotConnection(err: Error | null, s?: any, info?: any) {
      if (err) return onError(err)

      proxySocket = s
      socket = dgram.createSocket('udp4')
      relay = info

      timeout = setTimeout(() => {
        if (opts!.event === 'stopped') cleanup()
        else onError(new Error(`tracker request timed out (${opts!.event})`))
        timeout = null
      }, common.REQUEST_TIMEOUT)
      if (timeout.unref) timeout.unref()

      send(
        concat([common.CONNECTION_ID, common.toUInt32(common.ACTIONS.CONNECT), transactionId]),
        relay
      )

      socket!.once('error', onError)
      socket!.on('message', onSocketMessage)
    }

    function cleanup() {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      if (socket) {
        arrayRemove(self.cleanupFns, self.cleanupFns.indexOf(cleanup))
        socket.removeListener('error', onError)
        socket.removeListener('message', onSocketMessage)
        socket.on('error', noop)
        try {
          socket.close()
        } catch (err) {}
        socket = null
        if (proxySocket) {
          try {
            proxySocket.close()
          } catch (err) {}
          proxySocket = null
        }
      }
      if (self.maybeDestroyCleanup) self.maybeDestroyCleanup()
    }

    function onError(err: Error) {
      cleanup()
      if (self.destroyed) return

      try {
        ;(err as any).message += ` (${self.announceUrl})`
      } catch (ignoredErr) {}
      self.client.emit('warning', err)
    }

    function onSocketMessage(msg: Buffer) {
      if (proxySocket) msg = msg.slice(10) as Buffer
      const view = new DataView(transactionId.buffer)
      if (msg.length < 8 || msg.readUInt32BE(4) !== view.getUint32(0)) {
        return onError(new Error('tracker sent invalid transaction id'))
      }

      const action = msg.readUInt32BE(0)
      debug('UDP response %s, action %s', self.announceUrl, action)
      switch (action) {
        case 0: {
          if (msg.length < 16) return onError(new Error('invalid udp handshake'))

          if (opts!._scrape) scrape(msg.slice(8, 16) as Uint8Array)
          else announce(msg.slice(8, 16) as Uint8Array, opts!)

          break
        }
        case 1: {
          cleanup()
          if (self.destroyed) return

          if (msg.length < 20) return onError(new Error('invalid announce message'))

          const interval = msg.readUInt32BE(8)
          if (interval) {
            self.setInterval(interval * 1000)
            self.client.emit('update', {
              announce: self.announceUrl,
              complete: msg.readUInt32BE(16),
              incomplete: msg.readUInt32BE(12),
            })
          }

          let addrs: string[]
          try {
            addrs = compact2stringMulti(msg.slice(20))
          } catch (err: any) {
            return self.client.emit('warning', err)
          }
          addrs.forEach((addr) => {
            self.client.emit('peer', addr)
          })

          break
        }
        case 2: {
          cleanup()
          if (self.destroyed) return

          if (msg.length < 20 || (msg.length - 8) % 12 !== 0) {
            return onError(new Error('invalid scrape message'))
          }
          const infoHashes =
            Array.isArray(opts!.infoHash) && opts!.infoHash.length > 0
              ? opts!.infoHash.map((infoHash) => (infoHash as any).toString('hex'))
              : [
                  (opts!.infoHash && (opts!.infoHash as any).toString('hex')) ||
                    self.client.infoHash,
                ]

          for (let i = 0, len = (msg.length - 8) / 12; i < len; i += 1) {
            self.client.emit('scrape', {
              announce: self.announceUrl,
              infoHash: infoHashes[i],
              complete: msg.readUInt32BE(8 + i * 12),
              downloaded: msg.readUInt32BE(12 + i * 12),
              incomplete: msg.readUInt32BE(16 + i * 12),
            })
          }

          break
        }
        case 3: {
          cleanup()
          if (self.destroyed) return

          if (msg.length < 8) {
            onError(new Error('invalid error message'))
            return self.client.emit('warning', new Error(msg.slice(8).toString()))
          }

          break
        }
        default:
          onError(new Error('tracker sent invalid action'))
          break
      }
    }

    function send(message: Uint8Array, proxyInfo: any) {
      if (proxyInfo) {
        const pack = Socks.createUDPFrame({ host: hostname, port: parseInt(port) }, message)
        socket!.send(pack, 0, pack.length, proxyInfo.port, proxyInfo.host)
      } else {
        socket!.send(message, 0, message.length, parseInt(port), hostname)
      }
    }

    function announce(connectionId: Uint8Array, opts: AnnounceOpts) {
      transactionId = genTransactionId()

      send(
        concat([
          connectionId,
          common.toUInt32(common.ACTIONS.ANNOUNCE),
          transactionId,
          self.client.infoHashBuffer,
          self.client.peerIdBuffer,
          toUInt64(opts.downloaded || 0),
          opts.left != null ? toUInt64(opts.left as any) : hex2arr('ffffffffffffffff'),
          toUInt64(opts.uploaded || 0),
          common.toUInt32((common.EVENTS as any)[opts.event || ''] || 0),
          common.toUInt32(0),
          common.toUInt32(0),
          common.toUInt32(opts.numwant || 0),
          toUInt16(self.client.port),
        ]),
        relay
      )
    }

    function scrape(connectionId: Uint8Array) {
      transactionId = genTransactionId()

      const infoHash =
        Array.isArray(opts!.infoHash) && opts!.infoHash.length > 0
          ? concat((opts!.infoHash as any[]).map((h) => (typeof h === 'string' ? hex2arr(h) : h)))
          : ((opts!.infoHash && typeof opts!.infoHash === 'string'
              ? hex2arr(opts!.infoHash as string)
              : opts!.infoHash) as Uint8Array) || self.client.infoHashBuffer

      send(
        concat([connectionId, common.toUInt32(common.ACTIONS.SCRAPE), transactionId, infoHash]),
        relay
      )
    }
  }
}

function genTransactionId(): Uint8Array {
  return randomBytes(4)
}

function toUInt16(n: number): Uint8Array {
  const buf = new Uint8Array(2)
  const view = new DataView(buf.buffer)
  view.setUint16(0, n)
  return buf
}

const MAX_UINT = 4294967295

function toUInt64(n: number | string): Uint8Array {
  if (typeof n === 'string') {
    n = parseInt(n)
  }
  if (n > MAX_UINT) {
    const buf = new Uint8Array(8)
    const view = new DataView(buf.buffer)
    view.setBigUint64(0, BigInt(n))
    return buf
  }
  return concat([new Uint8Array(4), common.toUInt32(n)])
}

function noop() {}

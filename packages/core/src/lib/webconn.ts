import BitField from 'bitfield'
import debugFactory from 'debug'
import ltDontHave from 'lt_donthave'
import { hash, concat } from 'uint8-util'
import Wire from '@z-torrent/protocol'
import { once } from '@z-torrent/utils'

import { VERSION } from '../version.js'
import type { TorrentWire } from './types.js'

const debug = debugFactory('@z-torrent/core:webconn')

const SOCKET_TIMEOUT = 60000
const RETRY_DELAY = 10000

/**
 * WebConn extends Wire; protocol `Wire` uses BitTorrent event names not listed in @types/streamx StreamEvents.
 * `any[]` matches heterogeneous `wire.on` / `wire.once` payloads without fighting strict StreamEvents.
 */
type WebConnInit = {
  setKeepAlive(keepAlive: boolean): void
  use(ext: unknown): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- protocol event argument tuples
  once(event: string, listener: (...args: any[]) => void): void
  handshake(infoHash: string, peerId: string): void
  bitfield(field: unknown): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- protocol event argument tuples
  on(event: string, listener: (...args: any[]) => void): void
  unchoke(): void
}

export interface FileWireForWebConn {
  path: string
  offset: number
  length: number
}

export class WebConn extends Wire {
  url: string
  connId: string
  private _torrent: TorrentWire & {
    path: string | null
    pieceLength: number
    files: FileWireForWebConn[]
  }
  lt_donthave!: {
    on: (event: string, listener: () => void) => void
    donthave: (index: number) => void
  }

  constructor(
    url: string,
    torrent: TorrentWire & { path: string | null; pieceLength: number; files: FileWireForWebConn[] }
  ) {
    super()

    this.url = url
    this.connId = url
    this._torrent = torrent

    this._init(url)
  }

  private _init(url: string): void {
    const wire = this as unknown as WebConnInit
    this.setKeepAlive(true)

    wire.use(ltDontHave())

    wire.once('handshake', async (infoHash: string, _peerId: string) => {
      const hex = await hash(url, 'hex')
      if (this.destroyed) return
      wire.handshake(infoHash, hex)

      const numPieces = this._torrent.pieces.length
      const bitfield = new BitField(numPieces)
      for (let i = 0; i <= numPieces; i++) {
        bitfield.set(i, true)
      }
      wire.bitfield(bitfield)
    })

    wire.once('interested', () => {
      debug('interested')
      wire.unchoke()
    })

    wire.on('uninterested', () => {
      debug('uninterested')
    })
    wire.on('choke', () => {
      debug('choke')
    })
    wire.on('unchoke', () => {
      debug('unchoke')
    })
    wire.on('bitfield', () => {
      debug('bitfield')
    })
    ;(this as any).lt_donthave.on('donthave', () => {
      debug('donthave')
    })

    wire.on(
      'request',
      (
        pieceIndex: number,
        offset: number,
        length: number,
        callback: (err: Error | null, data?: Uint8Array) => void
      ) => {
        debug('request pieceIndex=%d offset=%d length=%d', pieceIndex, offset, length)
        this.httpRequest(pieceIndex, offset, length, (err, data) => {
          if (err) {
            ;(this as any).lt_donthave.donthave(pieceIndex)

            const retryTimeout = setTimeout(() => {
              if (this.destroyed) return

              this.have(pieceIndex)
            }, RETRY_DELAY)
            if ((retryTimeout as any).unref) (retryTimeout as any).unref()
          }

          callback(err, data)
        })
      }
    )
  }

  async httpRequest(
    pieceIndex: number,
    offset: number,
    length: number,
    cb: (err: Error | null, data?: Uint8Array) => void
  ): Promise<void> {
    cb = once(cb) as typeof cb
    const pieceOffset = pieceIndex * this._torrent.pieceLength
    const rangeStart = pieceOffset + offset
    const rangeEnd = rangeStart + length - 1

    const files = this._torrent.files
    let requests: Array<{
      url: string
      start: number
      end: number
      fileOffsetInRange?: number
    }>
    if (files.length <= 1) {
      requests = [
        {
          url: this.url,
          start: rangeStart,
          end: rangeEnd,
        },
      ]
    } else {
      const requestedFiles = files.filter(
        (file) => file.offset <= rangeEnd && file.offset + file.length > rangeStart
      )
      if (requestedFiles.length < 1) {
        return cb(new Error('Could not find file corresponding to web seed range request'))
      }

      requests = requestedFiles.map((requestedFile) => {
        const fileEnd = requestedFile.offset + requestedFile.length - 1
        const pathForUrl = requestedFile.path.replace(/\\/g, '/')
        const url = this.url + (this.url[this.url.length - 1] === '/' ? '' : '/') + pathForUrl
        return {
          url,
          fileOffsetInRange: Math.max(requestedFile.offset - rangeStart, 0),
          start: Math.max(rangeStart - requestedFile.offset, 0),
          end: Math.min(fileEnd, rangeEnd - requestedFile.offset),
        }
      })
    }
    let chunks: Uint8Array[]
    try {
      chunks = await Promise.all(
        requests.map(async ({ start, end, url }) => {
          debug(
            'Requesting url=%s pieceIndex=%d offset=%d length=%d start=%d end=%d',
            url,
            pieceIndex,
            offset,
            length,
            start,
            end
          )
          const res = await fetch(url, {
            cache: 'no-store',
            method: 'GET',
            headers: {
              'Cache-Control': 'no-store',
              'user-agent': `Z-Torrent/0.1 (https://github.com/skrylnikov/z-torrent)`,
              range: `bytes=${start}-${end}`,
            },
            signal: AbortSignal.timeout(SOCKET_TIMEOUT),
          })
          if (!res.ok) {
            throw new Error(`Unexpected HTTP status code ${res.status}`)
          }
          const data = new Uint8Array(await res.arrayBuffer())

          debug('Got data of length %d', data.length)

          return data
        })
      )
    } catch (e) {
      return cb(e as Error)
    }

    cb(null, concat(chunks))
  }

  override destroy(): this {
    super.destroy()
    this._torrent = null as any
    return this
  }
}

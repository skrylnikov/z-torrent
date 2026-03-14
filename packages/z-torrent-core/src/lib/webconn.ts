import BitField from 'bitfield'
import debugFactory from 'debug'
import fetch from 'cross-fetch-ponyfill'
import ltDontHave from 'lt_donthave'
import { hash, concat } from 'uint8-util'
import Wire from 'bittorrent-protocol'
import once from 'once'

import VERSION from '../version.js'
import type { TorrentWire } from './types.js'

const debug = debugFactory('webtorrent:webconn')

const SOCKET_TIMEOUT = 60000
const RETRY_DELAY = 10000

export interface FileWireForWebConn {
  path: string
  offset: number
  length: number
}

export default class WebConn extends Wire {
  url: string
  connId: string
  private _torrent: TorrentWire & { path: string | null; pieceLength: number; files: FileWireForWebConn[] }
  lt_donthave: {
    on: (event: string, listener: () => void) => void
    donthave: (index: number) => void
  }

  constructor(url: string, torrent: TorrentWire & { path: string | null; pieceLength: number; files: FileWireForWebConn[] }) {
    super()

    this.url = url
    this.connId = url
    this._torrent = torrent

    this._init(url)
  }

  private _init(url: string): void {
    this.setKeepAlive(true)

    this.use(ltDontHave())

    this.once('handshake', async (infoHash: string, peerId: string) => {
      const hex = await hash(url, 'hex')
      if (this.destroyed) return
      this.handshake(infoHash, hex)

      const numPieces = this._torrent.pieces.length
      const bitfield = new BitField(numPieces)
      for (let i = 0; i <= numPieces; i++) {
        bitfield.set(i, true)
      }
      this.bitfield(bitfield)
    })

    this.once('interested', () => {
      debug('interested')
      this.unchoke()
    })

    this.on('uninterested', () => {
      debug('uninterested')
    })
    this.on('choke', () => {
      debug('choke')
    })
    this.on('unchoke', () => {
      debug('unchoke')
    })
    this.on('bitfield', () => {
      debug('bitfield')
    })
    ;(this as any).lt_donthave.on('donthave', () => {
      debug('donthave')
    })

    this.on(
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
        const url =
          this.url +
          (this.url[this.url.length - 1] === '/' ? '' : '/') +
          pathForUrl
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
              'user-agent': `Z-Torrent/${VERSION} (https://github.com/webtorrent/webtorrent)`,
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

  destroy(): void {
    super.destroy()
    this._torrent = null as any
  }
}

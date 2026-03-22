/*! z-torrent. MIT License. Fork of WebTorrent by Feross Aboukhadijeh and WebTorrent LLC */

import path from 'path'
import { createTorrent, parseInput } from '@z-torrent/create'
import parallel from 'run-parallel'
import { concat } from 'uint8-util'
import SimplePeerLite from '@thaunknown/simple-peer/lite.js'

import {
  WebTorrentCore,
  VERSION_STR,
  Torrent,
  FileIterator,
  Peer,
  RarityMap,
  WebConn,
  ServerBase,
} from '@z-torrent/core'
import { createNodePlatformAdapter } from './platform.js'
import { ConnPool } from './lib/conn-pool.js'

import VERSION from '../version.cjs'

export { FileIterator, Torrent, Peer, RarityMap, WebConn, ServerBase, File } from '@z-torrent/core'

export class WebTorrent extends WebTorrentCore {
  static readonly WEBRTC_SUPPORT: boolean = SimplePeerLite.WEBRTC_SUPPORT
  static readonly UTP_SUPPORT: boolean = ConnPool.UTP_SUPPORT
  static readonly VERSION: string = VERSION

  constructor(opts: Record<string, unknown> = {}) {
    const platform = createNodePlatformAdapter()
    super({
      ...opts,
      platform,
    })
  }

  seed(
    input: string | File | FileList | Buffer | Array<string | File | Buffer>,
    opts: Record<string, unknown> = {},
    onseed?: (torrent: Torrent) => void
  ): Torrent {
    if (this.destroyed) throw new Error('client is destroyed')
    if (typeof opts === 'function') [opts, onseed] = [{}, opts]

    opts = opts ? Object.assign({}, opts) : {}
    opts.skipVerify = true

    const isFilePath = typeof input === 'string'

    if (isFilePath) opts.path = path.dirname(input as string)
    if (!opts.createdBy) opts.createdBy = `Z-Torrent/${VERSION_STR}`

    const onTorrent = (torrent: Torrent) => {
      const tasks: Array<(cb: (err?: Error | null) => void) => void> = [
        (cb) => {
          if (isFilePath || opts.preloadedStore) return cb()
          torrent.load((opts as { streams?: unknown }).streams, cb)
        },
      ]
      if (this.dht) {
        tasks.push((cb) => {
          torrent.once('dhtAnnounce', () => cb())
        })
      }
      parallel(tasks, (err) => {
        if (this.destroyed) return
        if (err) return torrent.destroyWithError(err)
        if (typeof onseed === 'function') onseed(torrent)
        torrent.emit('seed')
        this.emit('seed', torrent)
      })
    }

    const torrent = this.add(null, opts, onTorrent)

    let items: Array<string | File | Buffer>
    if (isFileList(input)) {
      items = Array.from(input as FileList)
    } else if (Array.isArray(input)) {
      items = input
    } else {
      items = [input as string | File | Buffer]
    }

    parallel(
      items.map(
        (item) => async (cb: (err?: Error | null, result?: unknown) => void) => {
          if (!opts.preloadedStore && isReadable(item)) {
            const chunks: Uint8Array[] = []
            try {
              for await (const chunk of item as unknown as AsyncIterable<Uint8Array>) {
                chunks.push(chunk)
              }
            } catch (err) {
              return cb(err as Error)
            }
            const buf = concat(chunks)
            ;(buf as { name?: string }).name = (item as { name?: string }).name
            cb(undefined, buf)
          } else {
            cb(undefined, item)
          }
        }
      ),
      (err, inputResult) => {
        if (this.destroyed) return
        if (err) return torrent.destroyWithError(err)

        parseInput(inputResult as never, opts, (parseErr, files) => {
          if (this.destroyed) return
          if (parseErr) return torrent.destroyWithError(parseErr)
          if (!files) return torrent.destroyWithError(new Error('parseInput returned no files'))

          const streams = files.map((f) => f.getStream)
          ;(opts as { streams?: unknown }).streams = streams

          createTorrent(inputResult as never, opts, async (createErr, torrentBuf) => {
            if (this.destroyed) return
            if (createErr) return torrent.destroyWithError(createErr)
            if (!torrentBuf) return torrent.destroyWithError(new Error('createTorrent returned no buffer'))

            const existingTorrent = await this.get(torrentBuf)
            if (existingTorrent) {
              console.warn('A torrent with the same id is already being seeded')
              if (this.torrents.includes(torrent)) {
                this.detachTorrent(torrent, null, () => {
                  if (typeof onseed === 'function') onseed(existingTorrent)
                })
              } else if (typeof onseed === 'function') {
                onseed(existingTorrent)
              }
            } else {
              void torrent.applyTorrentInput(torrentBuf)
            }
          })
        })
      }
    )

    return torrent
  }
}

function isReadable(obj: unknown): boolean {
  return typeof obj === 'object' && obj != null && typeof (obj as { pipe?: unknown }).pipe === 'function'
}

function isFileList(obj: unknown): boolean {
  return typeof FileList !== 'undefined' && obj instanceof FileList
}

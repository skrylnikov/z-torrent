/*! z-torrent. MIT License. Fork of WebTorrent by Feross Aboukhadijeh and WebTorrent LLC */

import path from 'path'
import createTorrent, { parseInput } from 'create-torrent'
import parallel from 'run-parallel'
import { concat } from 'uint8-util'
import Peer from '@thaunknown/simple-peer/lite.js'

import { WebTorrentCore } from 'z-torrent-core'
import { Torrent, FileIterator } from 'z-torrent-core'
import { createNodePlatformAdapter } from './platform.js'
import ConnPool from './lib/conn-pool.js'

import VERSION from '../version.cjs'

export { FileIterator }

const VERSION_STR = VERSION.replace(/\d*./g, (v: string) => `0${parseInt(v, 10) % 100}`.slice(-2)).slice(0, 4)

export default class WebTorrent extends WebTorrentCore {
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

    if (isFilePath) opts.path = path.dirname(input)
    if (!opts.createdBy) opts.createdBy = `Z-Torrent/${VERSION_STR}`

    const onTorrent = (torrent: Torrent) => {
      const tasks = [
        (cb: (err?: Error) => void) => {
          if (isFilePath || opts.preloadedStore) return cb()
          torrent.load((opts as any).streams, cb)
        },
      ]
      if (this.dht) {
        tasks.push((cb: () => void) => {
          torrent.once('dhtAnnounce', cb)
        })
      }
      parallel(tasks, (err) => {
        if (this.destroyed) return
        if (err) return (torrent as any)._destroy(err)
        if (typeof onseed === 'function') onseed(torrent)
        torrent.emit('seed')
        this.emit('seed', torrent)
      })
    }

    const torrent = this.add(null, opts, onTorrent)
    let streams: any

    if (isFileList(input)) input = Array.from(input)
    else if (!Array.isArray(input)) input = [input]

    parallel(
      (input as any[]).map((item) => async (cb: (err?: Error, result?: any) => void) => {
        if (!opts.preloadedStore && isReadable(item)) {
          const chunks = []
          try {
            for await (const chunk of item) {
              chunks.push(chunk)
            }
          } catch (err) {
            return cb(err as Error)
          }
          const buf = concat(chunks)
          ;(buf as any).name = (item as any).name
          cb(null, buf)
        } else {
          cb(null, item)
        }
      }),
      (err, inputResult) => {
        if (this.destroyed) return
        if (err) return (torrent as any)._destroy(err)

        parseInput(inputResult, opts, (parseErr, files) => {
          if (this.destroyed) return
          if (parseErr) return (torrent as any)._destroy(parseErr)

          streams = files.map((f: any) => f.getStream)
          ;(opts as any).streams = streams

          createTorrent(inputResult, opts, async (createErr, torrentBuf) => {
            if (this.destroyed) return
            if (createErr) return (torrent as any)._destroy(createErr)

            const existingTorrent = await this.get(torrentBuf)
            if (existingTorrent) {
              console.warn('A torrent with the same id is already being seeded')
              this._remove(torrent, null, () => {
                if (typeof onseed === 'function') onseed(existingTorrent)
              })
            } else {
              ;(torrent as any)._onTorrentId(torrentBuf)
            }
          })
        })
      }
    )

    return torrent
  }

  throttleDownload(rate: number): boolean {
    rate = Number(rate)
    if (isNaN(rate) || !isFinite(rate) || (rate < 0 && rate !== -1)) return false
    ;(this.throttleGroups.down as any).setRate?.(Math.round(rate))
    return true
  }

  throttleUpload(rate: number): boolean {
    rate = Number(rate)
    if (isNaN(rate) || !isFinite(rate) || (rate < 0 && rate !== -1)) return false
    ;(this.throttleGroups.up as any).setRate?.(Math.round(rate))
    return true
  }
}

WebTorrent.WEBRTC_SUPPORT = Peer.WEBRTC_SUPPORT
WebTorrent.UTP_SUPPORT = ConnPool.UTP_SUPPORT
WebTorrent.VERSION = VERSION

function isReadable(obj: unknown): boolean {
  return typeof obj === 'object' && obj != null && typeof (obj as any).pipe === 'function'
}

function isFileList(obj: unknown): boolean {
  return typeof FileList !== 'undefined' && obj instanceof FileList
}

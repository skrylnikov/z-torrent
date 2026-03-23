import path from 'path'
import {
  createTorrent,
  parseInput,
  type CreateTorrentOptions,
  type FileItem,
} from '@z-torrent/create'
import parallel from 'run-parallel'
import { concat } from 'uint8-util'
import SimplePeerLite from '@thaunknown/simple-peer/lite.js'

import {
  ZTorrentCore,
  VERSION_STR,
  Torrent,
  FileIterator,
  Peer,
  RarityMap,
  WebConn,
  ServerBase,
  type ZTorrentCoreOpts,
  type TorrentOpts,
} from '@z-torrent/core'
import { createNodePlatformAdapter } from './platform.js'
import { ConnPool } from './lib/conn-pool.js'

import VERSION from '../version.cjs'

export { FileIterator, Torrent, Peer, RarityMap, WebConn, ServerBase, File } from '@z-torrent/core'

export type ZTorrentNodeOpts = Omit<ZTorrentCoreOpts, 'platform'>

export type SeedOpts = TorrentOpts &
  CreateTorrentOptions & {
    /** Filled while seeding; elements match `FileItem.getStream` from parseInput */
    streams?: Array<FileItem['getStream']>
  }

type ParseInputInput = Parameters<typeof parseInput>[0]

export class ZTorrent extends ZTorrentCore {
  static readonly WEBRTC_SUPPORT: boolean = SimplePeerLite.WEBRTC_SUPPORT
  static readonly UTP_SUPPORT: boolean = ConnPool.UTP_SUPPORT
  static readonly VERSION: string = VERSION

  constructor(opts: ZTorrentNodeOpts = {}) {
    const platform = createNodePlatformAdapter()
    super({
      ...opts,
      platform,
    })
  }

  seed(
    input: string | File | FileList | Buffer | Array<string | File | Buffer>,
    onseed?: (torrent: Torrent) => void
  ): Torrent
  seed(
    input: string | File | FileList | Buffer | Array<string | File | Buffer>,
    opts: SeedOpts,
    onseed?: (torrent: Torrent) => void
  ): Torrent
  seed(
    input: string | File | FileList | Buffer | Array<string | File | Buffer>,
    optsOrOnseed?: SeedOpts | ((torrent: Torrent) => void),
    onseed?: (torrent: Torrent) => void
  ): Torrent {
    if (this.destroyed) throw new Error('client is destroyed')

    let opts: SeedOpts
    let seedCallback: ((torrent: Torrent) => void) | undefined
    if (typeof optsOrOnseed === 'function') {
      opts = {}
      seedCallback = optsOrOnseed
    } else {
      opts = optsOrOnseed ? { ...optsOrOnseed } : {}
      seedCallback = onseed
    }

    opts.skipVerify = true

    const isFilePath = typeof input === 'string'

    if (isFilePath) opts.path = path.dirname(input as string)
    if (!opts.createdBy) opts.createdBy = `Z-Torrent/${VERSION_STR}`

    const onTorrent = (torrent: Torrent) => {
      const tasks: Array<(cb: (err?: Error | null) => void) => void> = [
        (cb) => {
          if (isFilePath || opts.preloadedStore) return cb()
          torrent.load(opts.streams, cb)
        },
      ]
      if (this.dht) {
        tasks.push((cb) => {
          torrent.once('dhtAnnounce', () => cb())
        })
      }
      parallel(tasks, (err?: Error | null) => {
        if (this.destroyed) return
        if (err) return torrent.destroyWithError(err)
        if (typeof seedCallback === 'function') seedCallback(torrent)
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
      items.map((item) => async (cb: (err?: Error | null, result?: unknown) => void) => {
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
      }),
      (err: Error | null | undefined, inputResult: unknown[] | undefined) => {
        if (this.destroyed) return
        if (err) return torrent.destroyWithError(err)

        parseInput(inputResult as ParseInputInput, opts, (parseErr, files) => {
          if (this.destroyed) return
          if (parseErr) return torrent.destroyWithError(parseErr)
          if (!files) return torrent.destroyWithError(new Error('parseInput returned no files'))

          const streams = files.map((f) => f.getStream)
          opts.streams = streams

          createTorrent(inputResult as ParseInputInput, opts, async (createErr, torrentBuf) => {
            if (this.destroyed) return
            if (createErr) return torrent.destroyWithError(createErr)
            if (!torrentBuf)
              return torrent.destroyWithError(new Error('createTorrent returned no buffer'))

            const existingTorrent = await this.get(torrentBuf)
            if (existingTorrent) {
              console.warn('A torrent with the same id is already being seeded')
              if (this.torrents.includes(torrent)) {
                this.detachTorrent(torrent, null, () => {
                  if (typeof seedCallback === 'function') seedCallback(existingTorrent)
                })
              } else if (typeof seedCallback === 'function') {
                seedCallback(existingTorrent)
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
  return (
    typeof obj === 'object' && obj != null && typeof (obj as { pipe?: unknown }).pipe === 'function'
  )
}

function isFileList(obj: unknown): boolean {
  return typeof FileList !== 'undefined' && obj instanceof FileList
}

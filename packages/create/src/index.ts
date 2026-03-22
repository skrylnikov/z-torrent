/*! create-torrent. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */
import bencode from 'bencode'
import blockIterator from 'block-iterator'
import calcPieceLength from 'piece-length'
import corePath from 'path'
import isFile from 'is-file'
import { isJunk } from 'junk'
import joinIterator from 'join-async-iterator'
import parallel from 'run-parallel'

import { hash, hex2arr } from 'uint8-util'

import type { ReadStream } from 'node:fs'
import type { Readable } from 'node:stream'

import { getFiles } from './get-files.js'

export const announceList = [
  ['udp://tracker.leechers-paradise.org:6969'],
  ['udp://tracker.coppersurfer.tk:6969'],
  ['udp://tracker.opentrackr.org:1337'],
  ['udp://explodie.org:6969'],
  ['udp://tracker.empire-js.us:1337'],
  ['wss://tracker.btorrent.xyz'],
  ['wss://tracker.openwebtorrent.com'],
  ['wss://tracker.webtorrent.dev'],
]

const pathSymbol = Symbol('itemPath')

export interface FileItem {
  getStream?: AsyncIterable<Uint8Array> | (() => ReadStream)
  length: number
  path?: string[]
  fullPath?: string
  name?: string
  unknownName?: boolean
  [pathSymbol]?: string[]
}

export interface CreateTorrentOptions {
  name?: string
  creationDate?: Date | number
  comment?: string
  createdBy?: string
  private?: boolean | number
  pieceLength?: number
  maxPieceLength?: number
  announceList?: string[][]
  announce?: string | string[]
  urlList?: string | string[]
  info?: Record<string, unknown>
  onProgress?: (hashedLength: number, totalLength: number) => void
  filterJunkFiles?: boolean
  sslCert?: string
  singleFileTorrent?: boolean
}

type InputItem = string | File | Blob | Uint8Array | Readable | FileItem

class CreateTorrentImpl {
  static readonly #MAX_OUTSTANDING_HASHES = 5

  static #isJunkPath(segments: string[]): boolean {
    const filename = segments[segments.length - 1]
    if (!filename) return false
    return filename[0] === '.' && isJunk(filename)
  }

  static #sumLength(sum: number, file: FileItem): number {
    return sum + file.length
  }

  static #isBlob(obj: unknown): boolean {
    return typeof Blob !== 'undefined' && obj instanceof Blob
  }

  static #isFileList(obj: unknown): boolean {
    return typeof FileList !== 'undefined' && obj instanceof FileList
  }

  static #isReadable(obj: unknown): boolean {
    return typeof obj === 'object' && obj != null && typeof (obj as Readable).pipe === 'function'
  }

  static async *#readStream(readable: Readable, file: FileItem): AsyncGenerator<Uint8Array> {
    for await (const chunk of readable as unknown as AsyncIterable<Uint8Array>) {
      file.length += chunk.length
      yield chunk
    }
  }

  static async *#streamSource(
    source: AsyncIterable<Uint8Array> | (() => ReadStream)
  ): AsyncGenerator<Uint8Array> {
    if (typeof source === 'function') {
      const rs = source()
      for await (const chunk of rs as unknown as AsyncIterable<Uint8Array>) {
        yield chunk
      }
      return
    }
    for await (const chunk of source) {
      yield chunk
    }
  }

  static async #getPieceList(
    files: FileItem[],
    pieceLength: number,
    estimatedTorrentLength: number,
    opts: CreateTorrentOptions,
    cb: (err: Error | null, pieces?: Uint8Array, length?: number) => void
  ): Promise<void> {
    const pieces: string[] = []
    let length = 0
    let hashedLength = 0

    const streams = files.map((file) => CreateTorrentImpl.#streamSource(file.getStream!))

    const onProgress = opts.onProgress

    let remainingHashes = 0
    let pieceNum = 0
    let ended = false

    const iterator = blockIterator(joinIterator(streams), pieceLength, {
      zeroPadding: false,
    })
    try {
      for await (const chunk of iterator) {
        await new Promise<void>((resolve) => {
          length += chunk.length
          const i = pieceNum
          ++pieceNum
          if (++remainingHashes < CreateTorrentImpl.#MAX_OUTSTANDING_HASHES) resolve()
          hash(chunk, 'hex').then((hexHash) => {
            pieces[i] = hexHash
            --remainingHashes
            hashedLength += chunk.length
            if (onProgress) onProgress(hashedLength, estimatedTorrentLength)
            resolve()
            if (ended && remainingHashes === 0) cb(null, hex2arr(pieces.join('')), length)
          })
        })
      }
      if (remainingHashes === 0) return cb(null, hex2arr(pieces.join('')), length)
      ended = true
    } catch (err) {
      cb(err as Error)
    }
  }

  static #onFiles(
    files: FileItem[],
    opts: CreateTorrentOptions,
    cb: (err: Error | null, torrent?: Uint8Array) => void
  ): void {
    let list = opts.announceList

    if (!list) {
      if (typeof opts.announce === 'string') list = [[opts.announce]]
      else if (Array.isArray(opts.announce)) {
        list = opts.announce.map((u) => [u])
      }
    }

    if (!list) list = []

    const g = globalThis as typeof globalThis & {
      WEBTORRENT_ANNOUNCE?: string | string[]
    }
    if (g.WEBTORRENT_ANNOUNCE) {
      if (typeof g.WEBTORRENT_ANNOUNCE === 'string') {
        list.push([g.WEBTORRENT_ANNOUNCE])
      } else if (Array.isArray(g.WEBTORRENT_ANNOUNCE)) {
        list = list.concat(g.WEBTORRENT_ANNOUNCE.map((u: string) => [u]))
      }
    }

    if (opts.announce === undefined && opts.announceList === undefined) {
      list = list.concat(announceList)
    }

    if (typeof opts.urlList === 'string') opts.urlList = [opts.urlList]

    const torrent: Record<string, unknown> = {
      info: {
        name: opts.name,
      },
      'creation date': Math.ceil((Number(opts.creationDate) || Date.now()) / 1000),
      encoding: 'UTF-8',
    }

    if (list.length !== 0) {
      torrent.announce = list[0]![0]!
      torrent['announce-list'] = list
    }

    if (opts.comment !== undefined) torrent.comment = opts.comment

    if (opts.createdBy !== undefined) torrent['created by'] = opts.createdBy

    if (opts.private !== undefined)
      (torrent.info as Record<string, unknown>).private = Number(opts.private)

    if (opts.info !== undefined) Object.assign(torrent.info as Record<string, unknown>, opts.info)

    if (opts.sslCert !== undefined)
      (torrent.info as Record<string, unknown>)['ssl-cert'] = opts.sslCert

    if (opts.urlList !== undefined) torrent['url-list'] = opts.urlList

    const estimatedTorrentLength = files.reduce(CreateTorrentImpl.#sumLength, 0)
    const pieceLength =
      opts.pieceLength || Math.min(calcPieceLength(estimatedTorrentLength), opts.maxPieceLength!)
    ;(torrent.info as Record<string, unknown>)['piece length'] = pieceLength

    void CreateTorrentImpl.#getPieceList(
      files,
      pieceLength,
      estimatedTorrentLength,
      opts,
      (err, pieces, torrentLength) => {
        if (err) return cb(err)
        ;(torrent.info as Record<string, unknown>).pieces = pieces

        files.forEach((file) => {
          delete file.getStream
        })

        if (opts.singleFileTorrent) {
          ;(torrent.info as Record<string, unknown>).length = torrentLength
        } else {
          ;(torrent.info as Record<string, unknown>).files = files
        }

        cb(null, bencode.encode(torrent))
      }
    )
  }

  static #parseInput(
    input: InputItem | InputItem[],
    opts: CreateTorrentOptions,
    cb: (err: Error | null, files?: FileItem[], single?: boolean) => void
  ): void {
    let items: InputItem[]
    if (CreateTorrentImpl.#isFileList(input)) {
      items = Array.from(input as unknown as FileList) as unknown as InputItem[]
    } else if (!Array.isArray(input)) {
      items = [input]
    } else {
      items = input
    }

    if (items.length === 0) throw new Error('invalid input type')

    items.forEach((item) => {
      if (item == null) throw new Error(`invalid input type: ${item}`)
    })

    items = items.map((item) => {
      const fileWithPath = item as File & { path?: string }
      if (
        CreateTorrentImpl.#isBlob(item) &&
        typeof fileWithPath.path === 'string' &&
        typeof getFiles === 'function'
      )
        return fileWithPath.path as InputItem
      return item
    })

    if (items.length === 1 && typeof items[0] !== 'string' && !(items[0] as FileItem).name)
      (items[0] as FileItem).name = opts.name

    let commonPrefix: string | null = null
    items.forEach((item, i) => {
      if (typeof item === 'string') {
        return
      }

      let itemPath = (item as FileItem).fullPath || (item as FileItem).name
      if (!itemPath) {
        itemPath = `Unknown File ${i + 1}`
        ;(item as FileItem).unknownName = true
      }

      ;(item as FileItem)[pathSymbol] = itemPath.split('/')

      if (!(item as FileItem)[pathSymbol]![0]) {
        ;(item as FileItem)[pathSymbol]!.shift()
      }

      if ((item as FileItem)[pathSymbol]!.length < 2) {
        commonPrefix = null
      } else if (i === 0 && items.length > 1) {
        commonPrefix = (item as FileItem)[pathSymbol]![0] ?? null
      } else if ((item as FileItem)[pathSymbol]![0] !== commonPrefix) {
        commonPrefix = null
      }
    })

    const filterJunkFiles = opts.filterJunkFiles === undefined ? true : opts.filterJunkFiles
    if (filterJunkFiles) {
      items = items.filter((item) => {
        if (typeof item === 'string') {
          return true
        }
        return !CreateTorrentImpl.#isJunkPath((item as FileItem)[pathSymbol]!)
      })
    }

    if (commonPrefix) {
      items.forEach((item) => {
        const pathless =
          (ArrayBuffer.isView(item) || CreateTorrentImpl.#isReadable(item)) &&
          !(item as FileItem)[pathSymbol]
        if (typeof item === 'string' || pathless) return
        ;(item as FileItem)[pathSymbol]!.shift()
      })
    }

    if (!opts.name && commonPrefix) {
      opts.name = commonPrefix
    }

    if (!opts.name) {
      items.some((item) => {
        if (typeof item === 'string') {
          opts.name = corePath.basename(item)
          return true
        } else if (!(item as FileItem).unknownName) {
          opts.name = (item as FileItem)[pathSymbol]![(item as FileItem)[pathSymbol]!.length - 1]
          return true
        }
        return false
      })
    }

    if (!opts.name) {
      opts.name = 'Unnamed Torrent'
    }

    if (!opts.maxPieceLength) {
      opts.maxPieceLength = 4 * 1024 * 1024
    }

    const numPaths = items.reduce((sum, item) => sum + Number(typeof item === 'string'), 0)

    let isSingleFileTorrent = items.length === 1

    if (items.length === 1 && typeof items[0] === 'string') {
      if (typeof getFiles !== 'function') {
        throw new Error('filesystem paths do not work in the browser')
      }
      isFile(items[0] as string, (err: Error | null, pathIsFile?: boolean) => {
        if (err) return cb(err)
        isSingleFileTorrent = Boolean(pathIsFile)
        processInput()
      })
    } else {
      queueMicrotask(processInput)
    }

    function processInput(): void {
      parallel(
        items.map((item) => (pcb: (err: Error | null, file?: FileItem | FileItem[]) => void) => {
          const file: FileItem = {
            length: 0,
            getStream: undefined,
            path: undefined,
          }

          if (CreateTorrentImpl.#isBlob(item)) {
            file.getStream = (item as File).stream() as unknown as AsyncIterable<Uint8Array>
            file.length = (item as Blob).size
          } else if (ArrayBuffer.isView(item)) {
            file.getStream = [item] as unknown as AsyncIterable<Uint8Array>
            file.length = (item as Uint8Array).length
          } else if (CreateTorrentImpl.#isReadable(item)) {
            file.getStream = CreateTorrentImpl.#readStream(item as Readable, file)
            file.length = 0
          } else if (typeof item === 'string') {
            if (typeof getFiles !== 'function') {
              throw new Error('filesystem paths do not work in the browser')
            }
            const keepRoot = numPaths > 1 || isSingleFileTorrent
            getFiles(item as string, keepRoot, pcb as (err: Error | null, files?: FileItem[]) => void)
            return
          } else {
            throw new Error('invalid input type')
          }
          file.path = (item as FileItem)[pathSymbol]
          pcb(null, file)
        }),
        (err: Error | null, files?: FileItem[]) => {
          if (err) return cb(err)
          const flat = (files as FileItem[]).flat()
          cb(null, flat, isSingleFileTorrent)
        }
      )
    }
  }

  static execCreate(
    input: InputItem | InputItem[],
    opts?: CreateTorrentOptions | ((err: Error | null, torrent?: Uint8Array) => void),
    cb?: (err: Error | null, torrent?: Uint8Array) => void
  ): void {
    if (typeof opts === 'function') [opts, cb] = [undefined, opts]
    opts = opts ? Object.assign({}, opts) : {}

    CreateTorrentImpl.#parseInput(input, opts, (err, files, singleFileTorrent) => {
      if (err) return cb!(err)
      opts!.singleFileTorrent = singleFileTorrent
      CreateTorrentImpl.#onFiles(files!, opts!, cb!)
    })
  }

  static execParseInput(
    input: InputItem | InputItem[],
    opts?: CreateTorrentOptions | ((err: Error | null, files?: FileItem[], single?: boolean) => void),
    cb?: (err: Error | null, files?: FileItem[], single?: boolean) => void
  ): void {
    if (typeof opts === 'function') [opts, cb] = [undefined, opts]
    opts = opts ? Object.assign({}, opts) : {}
    CreateTorrentImpl.#parseInput(input, opts, cb!)
  }
}

export function createTorrent(
  input: InputItem | InputItem[],
  opts?: CreateTorrentOptions | ((err: Error | null, torrent?: Uint8Array) => void),
  cb?: (err: Error | null, torrent?: Uint8Array) => void
): void {
  CreateTorrentImpl.execCreate(input, opts, cb)
}

export function parseInput(
  input: InputItem | InputItem[],
  opts?: CreateTorrentOptions | ((err: Error | null, files?: FileItem[], single?: boolean) => void),
  cb?: (err: Error | null, files?: FileItem[], single?: boolean) => void
): void {
  CreateTorrentImpl.execParseInput(input, opts, cb)
}

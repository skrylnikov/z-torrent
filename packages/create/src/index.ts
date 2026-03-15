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
import 'fast-readable-async-iterator'

import getFiles from './get-files.js'

const announceList = [
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

interface FileItem {
  getStream?: AsyncIterable<Uint8Array> | (() => fs.ReadStream)
  length: number
  path?: string[]
  fullPath?: string
  name?: string
  unknownName?: boolean
  [pathSymbol]?: string[]
}

interface CreateTorrentOptions {
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

type InputItem = string | File | Blob | Uint8Array | NodeJS.ReadableStream | FileItem

function createTorrent(
  input: InputItem | InputItem[],
  opts?: CreateTorrentOptions | ((err: Error | null, torrent?: Uint8Array) => void),
  cb?: (err: Error | null, torrent?: Uint8Array) => void
): void {
  if (typeof opts === 'function') [opts, cb] = [undefined, opts]
  opts = opts ? Object.assign({}, opts) : {}

  _parseInput(input, opts, (err, files, singleFileTorrent) => {
    if (err) return cb!(err)
    opts!.singleFileTorrent = singleFileTorrent
    onFiles(files, opts!, cb!)
  })
}

function parseInput(
  input: InputItem | InputItem[],
  opts?: CreateTorrentOptions | ((err: Error | null, files?: FileItem[], single?: boolean) => void),
  cb?: (err: Error | null, files?: FileItem[], single?: boolean) => void
): void {
  if (typeof opts === 'function') [opts, cb] = [undefined, opts]
  opts = opts ? Object.assign({}, opts) : {}
  _parseInput(input, opts, cb!)
}

function _parseInput(
  input: InputItem | InputItem[],
  opts: CreateTorrentOptions,
  cb: (err: Error | null, files?: FileItem[], single?: boolean) => void
): void {
  if (isFileList(input)) input = Array.from(input as unknown as FileList)
  if (!Array.isArray(input)) input = [input]

  if (input.length === 0) throw new Error('invalid input type')

  input.forEach((item) => {
    if (item == null) throw new Error(`invalid input type: ${item}`)
  })

  input = input.map((item) => {
    if (isBlob(item) && typeof (item as File).path === 'string' && typeof getFiles === 'function')
      return (item as File).path
    return item
  })

  if (input.length === 1 && typeof input[0] !== 'string' && !(input[0] as FileItem).name)
    (input[0] as FileItem).name = opts.name

  let commonPrefix: string | null = null
  input.forEach((item, i) => {
    if (typeof item === 'string') {
      return
    }

    let path = (item as FileItem).fullPath || (item as FileItem).name
    if (!path) {
      path = `Unknown File ${i + 1}`
      ;(item as FileItem).unknownName = true
    }

    ;(item as FileItem)[pathSymbol] = path.split('/')

    if (!(item as FileItem)[pathSymbol]![0]) {
      ;(item as FileItem)[pathSymbol]!.shift()
    }

    if ((item as FileItem)[pathSymbol]!.length < 2) {
      commonPrefix = null
    } else if (i === 0 && input.length > 1) {
      commonPrefix = (item as FileItem)[pathSymbol]![0]
    } else if ((item as FileItem)[pathSymbol]![0] !== commonPrefix) {
      commonPrefix = null
    }
  })

  const filterJunkFiles = opts.filterJunkFiles === undefined ? true : opts.filterJunkFiles
  if (filterJunkFiles) {
    input = input.filter((item) => {
      if (typeof item === 'string') {
        return true
      }
      return !isJunkPath((item as FileItem)[pathSymbol]!)
    })
  }

  if (commonPrefix) {
    input.forEach((item) => {
      const pathless =
        (ArrayBuffer.isView(item) || isReadable(item)) && !(item as FileItem)[pathSymbol]
      if (typeof item === 'string' || pathless) return
      ;(item as FileItem)[pathSymbol]!.shift()
    })
  }

  if (!opts.name && commonPrefix) {
    opts.name = commonPrefix
  }

  if (!opts.name) {
    input.some((item) => {
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
    opts.name = `Unnamed Torrent ${Date.now()}`
  }

  if (!opts.maxPieceLength) {
    opts.maxPieceLength = 4 * 1024 * 1024
  }

  const numPaths = input.reduce((sum, item) => sum + Number(typeof item === 'string'), 0)

  let isSingleFileTorrent = input.length === 1

  if (input.length === 1 && typeof input[0] === 'string') {
    if (typeof getFiles !== 'function') {
      throw new Error('filesystem paths do not work in the browser')
    }
    isFile(input[0] as string, (err, pathIsFile) => {
      if (err) return cb(err)
      isSingleFileTorrent = pathIsFile
      processInput()
    })
  } else {
    queueMicrotask(processInput)
  }

  function processInput(): void {
    parallel(
      input.map((item) => (cb: (err: Error | null, file?: FileItem | FileItem[]) => void) => {
        const file: FileItem = {
          length: 0,
          getStream: undefined,
          path: undefined,
        }

        if (isBlob(item)) {
          file.getStream = (item as File).stream() as unknown as AsyncIterable<Uint8Array>
          file.length = (item as Blob).size
        } else if (ArrayBuffer.isView(item)) {
          file.getStream = [item] as unknown as AsyncIterable<Uint8Array>
          file.length = (item as Uint8Array).length
        } else if (isReadable(item)) {
          file.getStream = getStreamStream(item as NodeJS.ReadableStream, file)
          file.length = 0
        } else if (typeof item === 'string') {
          if (typeof getFiles !== 'function') {
            throw new Error('filesystem paths do not work in the browser')
          }
          const keepRoot = numPaths > 1 || isSingleFileTorrent
          getFiles(item as string, keepRoot, cb as (err: Error | null, files?: FileItem[]) => void)
          return
        } else {
          throw new Error('invalid input type')
        }
        file.path = (item as FileItem)[pathSymbol]
        cb(null, file)
      }),
      (err, files) => {
        if (err) return cb(err)
        files = (files as FileItem[]).flat()
        cb(null, files as FileItem[], isSingleFileTorrent)
      }
    )
  }
}

const MAX_OUTSTANDING_HASHES = 5

async function getPieceList(
  files: FileItem[],
  pieceLength: number,
  estimatedTorrentLength: number,
  opts: CreateTorrentOptions,
  cb: (err: Error | null, pieces?: Uint8Array, length?: number) => void
): Promise<void> {
  const pieces: string[] = []
  let length = 0
  let hashedLength = 0

  const streams = files.map((file) => file.getStream!)

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
        if (++remainingHashes < MAX_OUTSTANDING_HASHES) resolve()
        hash(chunk, 'hex').then((hash) => {
          pieces[i] = hash
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

function onFiles(
  files: FileItem[],
  opts: CreateTorrentOptions,
  cb: (err: Error | null, torrent?: Uint8Array) => void
): void {
  let _announceList = opts.announceList

  if (!_announceList) {
    if (typeof opts.announce === 'string') _announceList = [[opts.announce]]
    else if (Array.isArray(opts.announce)) {
      _announceList = opts.announce.map((u) => [u])
    }
  }

  if (!_announceList) _announceList = []

  if (globalThis.WEBTORRENT_ANNOUNCE) {
    if (typeof globalThis.WEBTORRENT_ANNOUNCE === 'string') {
      _announceList.push([globalThis.WEBTORRENT_ANNOUNCE])
    } else if (Array.isArray(globalThis.WEBTORRENT_ANNOUNCE)) {
      _announceList = _announceList.concat(globalThis.WEBTORRENT_ANNOUNCE.map((u) => [u]))
    }
  }

  if (opts.announce === undefined && opts.announceList === undefined) {
    _announceList = _announceList.concat(announceList)
  }

  if (typeof opts.urlList === 'string') opts.urlList = [opts.urlList]

  const torrent: Record<string, unknown> = {
    info: {
      name: opts.name,
    },
    'creation date': Math.ceil((Number(opts.creationDate) || Date.now()) / 1000),
    encoding: 'UTF-8',
  }

  if (_announceList.length !== 0) {
    torrent.announce = _announceList[0][0]
    torrent['announce-list'] = _announceList
  }

  if (opts.comment !== undefined) torrent.comment = opts.comment

  if (opts.createdBy !== undefined) torrent['created by'] = opts.createdBy

  if (opts.private !== undefined)
    (torrent.info as Record<string, unknown>).private = Number(opts.private)

  if (opts.info !== undefined) Object.assign(torrent.info as Record<string, unknown>, opts.info)

  if (opts.sslCert !== undefined)
    (torrent.info as Record<string, unknown>)['ssl-cert'] = opts.sslCert

  if (opts.urlList !== undefined) torrent['url-list'] = opts.urlList

  const estimatedTorrentLength = files.reduce(sumLength, 0)
  const pieceLength =
    opts.pieceLength || Math.min(calcPieceLength(estimatedTorrentLength), opts.maxPieceLength!)
  ;(torrent.info as Record<string, unknown>)['piece length'] = pieceLength

  getPieceList(files, pieceLength, estimatedTorrentLength, opts, (err, pieces, torrentLength) => {
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
  })
}

function isJunkPath(path: string[]): boolean {
  const filename = path[path.length - 1]
  return filename[0] === '.' && isJunk(filename)
}

function sumLength(sum: number, file: FileItem): number {
  return sum + file.length
}

function isBlob(obj: unknown): boolean {
  return typeof Blob !== 'undefined' && obj instanceof Blob
}

function isFileList(obj: unknown): boolean {
  return typeof FileList !== 'undefined' && obj instanceof FileList
}

function isReadable(obj: unknown): boolean {
  return (
    typeof obj === 'object' &&
    obj != null &&
    typeof (obj as NodeJS.ReadableStream).pipe === 'function'
  )
}

async function* getStreamStream(
  readable: NodeJS.ReadableStream,
  file: FileItem
): AsyncGenerator<Uint8Array> {
  for await (const chunk of readable as unknown as AsyncIterable<Uint8Array>) {
    file.length += chunk.length
    yield chunk
  }
}

export default createTorrent
export { parseInput, announceList, isJunkPath }

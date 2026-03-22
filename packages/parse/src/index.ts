/*! @z-torrent/parse. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */
import { createHash } from 'node:crypto'

import bencode from 'bencode'
import rawSha1 from 'sync-sha1/rawSha1.js'
import { magnet } from '@z-torrent/magnet'
import { arr2hex, text2arr, arr2text } from 'uint8-util'

import type { Instance, FileTree, FileTreeEntry, V2FileLayoutEntry } from './types.js'

class TorrentIdParser {
  readonly toMagnetURI = magnet.encode

  async decode(torrentId: string | Uint8Array | Instance): Promise<Instance> {
    return this.#decodeInner(torrentId)
  }

  /** Synchronous decode (Node.js). Uses `crypto.createHash` for BitTorrent v2 info hashes. */
  parseTorrentSync(torrentId: string | Uint8Array | Instance): Instance {
    return this.#decodeInner(torrentId)
  }

  encode(parsed: Instance): Uint8Array {
    const torrent: Record<string, unknown> = {
      info: parsed.info,
    }

    const announceList = (parsed.announce || []).map((url) => {
      if (!torrent.announce) torrent.announce = url
      return [text2arr(url)]
    })
    torrent['announce-list'] = announceList

    torrent['url-list'] = parsed.urlList || []

    if (parsed.private !== undefined) {
      torrent.private = Number(parsed.private)
    }

    if (parsed.created) {
      torrent['creation date'] = (parsed.created.getTime() / 1000) | 0
    }

    if (parsed.createdBy) {
      torrent['created by'] = parsed.createdBy
    }

    if (parsed.comment) {
      torrent.comment = parsed.comment
    }

    if (parsed['piece layers']) {
      torrent['piece layers'] = parsed['piece layers']
    }

    return bencode.encode(torrent)
  }

  remote(
    torrentId: string | Uint8Array | Blob,
    opts: Record<string, unknown> | ((err: Error | null, parsed?: Instance) => void),
    cb?: (err: Error | null, parsed?: Instance) => void
  ): void {
    if (typeof opts === 'function') {
      this.remote(torrentId, {}, opts)
      return
    }
    if (typeof cb !== 'function') throw new Error('second argument must be a Function')

    let parsedTorrent: Instance | undefined

    this.decode(torrentId as string | Uint8Array | Instance)
      .then((result) => {
        parsedTorrent = result
      })
      .catch(() => {
        // If torrent fails to parse, it could be a Blob, http/https URL or
        // filesystem path, so don't consider it an error yet.
      })
      .then(() => {
        if (parsedTorrent && (parsedTorrent.infoHash || parsedTorrent.infoHashV2)) {
          queueMicrotask(() => {
            cb!(null, parsedTorrent)
          })
        } else if (this.#isBlob(torrentId)) {
          ;(torrentId as Blob)
            .arrayBuffer()
            .then((buffer) => {
              const torrentBuf = new Uint8Array(buffer)
              return this.#parseOrThrow(torrentBuf, cb!)
            })
            .catch((err: Error) => {
              cb!(new Error(`Error converting Blob: ${err.message}`))
            })
        } else if (typeof torrentId === 'string' && /^https?:/.test(torrentId)) {
          fetch(torrentId, {
            headers: {
              'user-agent': 'Z-Torrent (https://github.com/webtorrent/webtorrent)',
              ...(opts.headers as Record<string, string> | undefined),
            },
            signal: AbortSignal.timeout(30 * 1000),
            ...opts,
          } as Parameters<typeof fetch>[1])
            .then((res) => res.arrayBuffer())
            .then((buffer) => {
              const torrentBuf = new Uint8Array(buffer)
              return this.#parseOrThrow(torrentBuf, cb!)
            })
            .catch((err: Error) => {
              cb!(new Error(`Error downloading torrent: ${err.message}`))
            })
        } else if (typeof torrentId === 'string' && torrentId.length > 0) {
          import('node:fs')
            .then((fs) => {
              if (typeof fs.readFile === 'function') {
                fs.readFile(torrentId, (err: Error | null, torrentBuf: Buffer) => {
                  if (err) {
                    cb!(new Error('Invalid torrent identifier'))
                    return
                  }
                  void this.#parseOrThrow(torrentBuf, cb!)
                })
              } else {
                cb!(new Error('Invalid torrent identifier'))
              }
            })
            .catch(() => cb!(new Error('Invalid torrent identifier')))
        } else {
          queueMicrotask(() => {
            cb!(new Error('Invalid torrent identifier'))
          })
        }
      })
  }

  async #parseOrThrow(
    torrentBuf: Uint8Array,
    cb: (err: Error | null, parsed?: Instance) => void
  ): Promise<void> {
    try {
      const parsedTorrent = await this.decode(torrentBuf)
      if (parsedTorrent && (parsedTorrent.infoHash || parsedTorrent.infoHashV2)) {
        cb(null, parsedTorrent)
      } else {
        cb(new Error('Invalid torrent identifier'))
      }
    } catch (err) {
      cb(err as Error)
    }
  }

  #sha256BencodedInfo(infoBufferEncoded: Uint8Array): Uint8Array {
    return new Uint8Array(createHash('sha256').update(Buffer.from(infoBufferEncoded)).digest())
  }

  #decodeInner(torrentId: string | Uint8Array | Instance): Instance {
    if (typeof torrentId === 'string' && /^(stream-)?magnet:/.test(torrentId)) {
      const torrentObj = magnet.decode(torrentId)

      if (!torrentObj.infoHash && !torrentObj.infoHashV2) {
        throw new Error('Invalid torrent identifier')
      }

      return torrentObj as Instance
    } else if (
      typeof torrentId === 'string' &&
      (/^[a-f0-9]{40}$/i.test(torrentId) || /^[a-z2-7]{32}$/i.test(torrentId))
    ) {
      return magnet.decode(`magnet:?xt=urn:btih:${torrentId}`) as Instance
    } else if (typeof torrentId === 'string' && /^[a-f0-9]{64}$/i.test(torrentId)) {
      return magnet.decode(`magnet:?xt=urn:btmh:1220${torrentId}`) as Instance
    } else if (ArrayBuffer.isView(torrentId) && torrentId.length === 20) {
      return magnet.decode(`magnet:?xt=urn:btih:${arr2hex(torrentId as Uint8Array)}`) as Instance
    } else if (ArrayBuffer.isView(torrentId) && torrentId.length === 32) {
      return magnet.decode(`magnet:?xt=urn:btmh:1220${arr2hex(torrentId as Uint8Array)}`) as Instance
    } else if (ArrayBuffer.isView(torrentId)) {
      return this.#decodeTorrentFile(torrentId as Uint8Array)
    } else if (
      torrentId &&
      typeof torrentId === 'object' &&
      ('infoHash' in torrentId || 'infoHashV2' in torrentId)
    ) {
      const result = { ...torrentId }
      if (result.infoHash) {
        result.infoHash = result.infoHash.toLowerCase()
      }
      if ((result as Instance).infoHashV2) {
        ;(result as Instance).infoHashV2 = (result as Instance).infoHashV2!.toLowerCase()
      }

      if (!result.announce) result.announce = []

      if (typeof result.announce === 'string') {
        result.announce = [result.announce]
      }

      if (!result.urlList) result.urlList = []

      return result
    } else {
      throw new Error('Invalid torrent identifier')
    }
  }

  #decodeTorrentFile(torrent: Uint8Array | Record<string, unknown>): Instance {
    if (ArrayBuffer.isView(torrent)) {
      torrent = bencode.decode(Buffer.from(torrent)) as Record<string, unknown>
    }

    const torrentObj = torrent as Record<string, unknown>
    const info = torrentObj.info as Record<string, unknown>

    this.#ensure(info, 'info')
    this.#ensure(info['name.utf-8'] || info.name, 'info.name')
    this.#ensure(info['piece length'], "info['piece length']")

    const hasV1Structure = !!(info.pieces || info.files || typeof info.length === 'number')
    const hasV2Structure = !!info['file tree']

    if (hasV2Structure) {
      this.#ensure(info['file tree'], "info['file tree']")
      this.#ensure(torrentObj['piece layers'], "'piece layers'")
      this.#ensure(info['meta version'] === 2, "info['meta version'] must be 2 for BitTorrent v2")
    }

    if (hasV1Structure) {
      this.#ensure(info.pieces, 'info.pieces')

      if (info.files) {
        ;(info.files as Array<Record<string, unknown>>).forEach((file) => {
          this.#ensure(typeof file.length === 'number', 'info.files[0].length')
          this.#ensure(file['path.utf-8'] || file.path, 'info.files[0].path')
        })
      } else {
        this.#ensure(typeof info.length === 'number', 'info.length')
      }
    }

    const result: Instance = {
      info: info as Instance['info'],
      infoBuffer: bencode.encode(info),
      name: arr2text((info['name.utf-8'] || info.name) as Uint8Array),
      announce: [],
    }

    const infoBufferEncoded = result.infoBuffer!

    if (hasV1Structure) {
      result.infoHashBuffer = rawSha1(
        infoBufferEncoded instanceof Uint8Array
          ? infoBufferEncoded
          : new Uint8Array(infoBufferEncoded)
      )
      result.infoHash = arr2hex(result.infoHashBuffer!)
    }

    if (hasV2Structure) {
      const enc =
        infoBufferEncoded instanceof Uint8Array
          ? infoBufferEncoded
          : new Uint8Array(infoBufferEncoded as Buffer)
      result.infoHashV2Buffer = this.#sha256BencodedInfo(enc)
      result.infoHashV2 = arr2hex(result.infoHashV2Buffer!)
    }

    if (hasV1Structure && hasV2Structure) {
      result.version = 'hybrid'
    } else if (hasV2Structure) {
      result.version = 'v2'
    } else {
      result.version = 'v1'
    }

    if (info.private !== undefined) result.private = !!info.private

    if (torrentObj['creation date'])
      result.created = new Date((torrentObj['creation date'] as number) * 1000)
    if (torrentObj['created by']) result.createdBy = arr2text(torrentObj['created by'] as Uint8Array)

    if (ArrayBuffer.isView(torrentObj.comment))
      result.comment = arr2text(torrentObj.comment as Uint8Array)

    if (
      Array.isArray(torrentObj['announce-list']) &&
      (torrentObj['announce-list'] as unknown[]).length > 0
    ) {
      ;(torrentObj['announce-list'] as Uint8Array[][]).forEach((urls) => {
        urls.forEach((url) => {
          result.announce!.push(arr2text(url))
        })
      })
    } else if (torrentObj.announce) {
      result.announce!.push(arr2text(torrentObj.announce as Uint8Array))
    }

    if (ArrayBuffer.isView(torrentObj['url-list'])) {
      torrentObj['url-list'] =
        (torrentObj['url-list'] as Uint8Array).length > 0 ? [torrentObj['url-list']] : []
    }
    result.urlList = ((torrentObj['url-list'] || []) as Uint8Array[]).map((url) => arr2text(url))

    result.announce = Array.from(new Set(result.announce))
    result.urlList = Array.from(new Set(result.urlList))

    let sum = 0
    let files: Array<Record<string, unknown>>

    if (hasV2Structure && !hasV1Structure) {
      files = this.#flattenFileTree(info['file tree'] as FileTree)
    } else {
      files = (info.files || [info]) as Array<Record<string, unknown>>
    }

    result.files = files.map((file) => {
      const pathParts = ((file['path.utf-8'] || file.path || []) as (string | Uint8Array)[]).map(
        (p) => (ArrayBuffer.isView(p) ? arr2text(p as Uint8Array) : (p as string))
      )
      const parts = [result.name as string, ...pathParts]
      sum += file.length as number
      const name = parts[parts.length - 1]!
      const out: NonNullable<Instance['files']>[number] = {
        path: parts.join('/'),
        name,
        length: file.length as number,
        offset: sum - (file.length as number),
      }
      const attr = (file as Record<string, unknown>).attr
      if (typeof attr === 'string') out.attr = attr
      return out
    })

    result.length = sum

    const lastFile = result.files[result.files.length - 1]!

    result.pieceLength = info['piece length'] as number
    result.lastPieceLength =
      (lastFile.offset + lastFile.length) % result.pieceLength || result.pieceLength

    if (info.pieces) {
      result.pieces = this.#splitPieces(info.pieces as Uint8Array)
    }

    if (torrentObj['piece layers']) {
      result['piece layers'] = torrentObj['piece layers'] as Record<string, Uint8Array>
      this.#attachV2PieceLayout(result, torrentObj['piece layers'] as Record<string, Uint8Array>)
    }

    if (hasV2Structure && info['file tree']) {
      result.v2FileLayout = this.#buildV2FileLayout(
        info['file tree'] as FileTree,
        result.pieceLength!
      )
    }

    /** v2-only: `files[].offset` must match piece-aligned layout (padding between files), not raw concatenation */
    if (
      result.version === 'v2' &&
      result.files &&
      result.v2FileLayout &&
      result.files.length === result.v2FileLayout.length
    ) {
      const layout = result.v2FileLayout
      const pl = result.pieceLength!
      for (let i = 0; i < layout.length; i++) {
        result.files[i]!.offset = layout[i]!.byteOffset
      }
      const last = layout[layout.length - 1]!
      const lastFile = result.files[result.files.length - 1]!
      result.lastPieceLength = (last.byteOffset + lastFile.length) % pl || pl
    }

    return result
  }

  /** Split BEP 52 `piece layers` blob into 32-byte layer hashes; index by `pieces root` hex. */
  #attachV2PieceLayout(
    result: Instance,
    pieceLayers: Record<string, Uint8Array | Buffer>
  ): void {
    const byHex: Record<string, Uint8Array[]> = {}
    for (const [key, buf] of Object.entries(pieceLayers)) {
      const rootHex = this.#piecesRootKeyToHex(key)
      const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
      if (u8.length % 32 !== 0) {
        throw new Error(
          `Invalid piece layers length for root ${rootHex.slice(0, 8)}…: expected multiple of 32 bytes, got ${u8.length}`
        )
      }
      const hashes: Uint8Array[] = []
      for (let i = 0; i < u8.length; i += 32) {
        hashes.push(u8.subarray(i, i + 32))
      }
      byHex[rootHex] = hashes
    }
    result.pieceLayersByRootHex = byHex
  }

  /** bencode may use a 64-char hex key or a 32-byte binary string key */
  #piecesRootKeyToHex(key: string): string {
    if (/^[a-f0-9]{64}$/i.test(key)) {
      return key.toLowerCase()
    }
    if (key.length === 32) {
      const u = new Uint8Array(32)
      for (let i = 0; i < 32; i++) {
        u[i] = key.charCodeAt(i) & 0xff
      }
      return arr2hex(u)
    }
    throw new Error('Invalid piece layers dictionary key length')
  }

  #collectV2FilesFromTree(tree: FileTree, prefix: string[] = []): Omit<V2FileLayoutEntry, 'byteOffset' | 'startPiece' | 'endPiece'>[] {
    const names = Object.keys(tree).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const out: Omit<V2FileLayoutEntry, 'byteOffset' | 'startPiece' | 'endPiece'>[] = []
    for (const name of names) {
      const node = tree[name] as FileTree | FileTreeEntry
      if (!node || typeof node !== 'object') continue
      const emptyMeta = (node as Record<string, unknown>)[''] as Record<string, unknown> | undefined
      if (emptyMeta && typeof emptyMeta.length === 'number') {
        const pr = emptyMeta['pieces root'] as Uint8Array | Buffer | undefined
        const root =
          pr && (pr instanceof Uint8Array || ArrayBuffer.isView(pr))
            ? new Uint8Array(pr.buffer, pr.byteOffset, pr.byteLength)
            : undefined
        const path = [...prefix, name]
        out.push({
          path,
          displayPath: path.join('/'),
          length: emptyMeta.length as number,
          piecesRoot: root && root.length === 32 ? root : undefined,
          piecesRootHex: root && root.length === 32 ? arr2hex(root) : undefined,
        })
      } else {
        out.push(...this.#collectV2FilesFromTree(node as FileTree, [...prefix, name]))
      }
    }
    return out
  }

  #alignUp(offset: number, align: number): number {
    if (align <= 0) return offset
    const m = offset % align
    return m === 0 ? offset : offset + (align - m)
  }

  #buildV2FileLayout(fileTree: FileTree, pieceLength: number): V2FileLayoutEntry[] {
    const raw = this.#collectV2FilesFromTree(fileTree)
    let cursor = 0
    const layout: V2FileLayoutEntry[] = []
    for (const f of raw) {
      const startPiece = (cursor / pieceLength) | 0
      const endPiece =
        f.length === 0 ? startPiece : ((cursor + f.length - 1) / pieceLength) | 0
      layout.push({
        ...f,
        byteOffset: cursor,
        startPiece,
        endPiece,
      })
      cursor += f.length
      cursor = this.#alignUp(cursor, pieceLength)
    }
    return layout
  }

  #flattenFileTree(tree: FileTree, currentPath: string[] = []): Array<Record<string, unknown>> {
    const files: Array<Record<string, unknown>> = []
    const names = Object.keys(tree).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    for (const name of names) {
      const entry = tree[name]!
      const fullPath = [...currentPath, name]
      if ('length' in (entry as FileTreeEntry)) {
        files.push({
          ...(entry as object),
          'path.utf-8': fullPath,
        } as Record<string, unknown>)
      } else {
        files.push(...this.#flattenFileTree(entry as FileTree, fullPath))
      }
    }
    return files
  }

  #isBlob(obj: unknown): boolean {
    return typeof Blob !== 'undefined' && obj instanceof Blob
  }

  #splitPieces(buf: Uint8Array): string[] {
    const pieces: string[] = []
    for (let i = 0; i < buf.length; i += 20) {
      pieces.push(arr2hex(buf.slice(i, i + 20)))
    }
    return pieces
  }

  #ensure(bool: unknown, fieldName: string): void {
    if (!bool) throw new Error(`Torrent is missing required field: ${fieldName}`)
  }
}

const parser = new TorrentIdParser()

const parse = {
  decode: (id: string | Uint8Array | Instance) => parser.decode(id),
  encode: (parsed: Instance) => parser.encode(parsed),
  remote: (
    torrentId: string | Uint8Array | Blob,
    opts: Record<string, unknown> | ((err: Error | null, parsed?: Instance) => void),
    cb?: (err: Error | null, parsed?: Instance) => void
  ) => parser.remote(torrentId, opts, cb),
  toMagnetURI: parser.toMagnetURI,
}

/** @deprecated Prefer `parse.decode` */
const parseTorrent = (id: string | Uint8Array | Instance) => parser.decode(id)
const parseTorrentSync = (id: string | Uint8Array | Instance) => parser.parseTorrentSync(id)
const toTorrentFile = (parsed: Instance) => parser.encode(parsed)
const toMagnetURI = parser.toMagnetURI
const decode = parseTorrent
const encode = toTorrentFile
const remote = (
  torrentId: string | Uint8Array | Blob,
  opts: Record<string, unknown> | ((err: Error | null, parsed?: Instance) => void),
  cb?: (err: Error | null, parsed?: Instance) => void
) => parser.remote(torrentId, opts, cb)

export { parse, parseTorrent, parseTorrentSync, toTorrentFile, toMagnetURI, remote, decode, encode }
export type { Instance, V2FileLayoutEntry }

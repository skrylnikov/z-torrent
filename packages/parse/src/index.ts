/*! parse-torrent. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */
import bencode from 'bencode'
import sha1 from 'sync-sha1/rawSha1.js'
import fetch from 'cross-fetch-ponyfill'
import magnet, { encode } from '@z-torrent/magnet'
import { hash, arr2hex, text2arr, arr2text } from 'uint8-util'

import type { Instance } from './types.js'

async function parseTorrent(torrentId: string | Uint8Array | Instance): Promise<Instance> {
  if (typeof torrentId === 'string' && /^(stream-)?magnet:/.test(torrentId)) {
    const torrentObj = magnet(torrentId)

    if (!torrentObj.infoHash) {
      throw new Error('Invalid torrent identifier')
    }

    return torrentObj
  } else if (
    typeof torrentId === 'string' &&
    (/^[a-f0-9]{40}$/i.test(torrentId) || /^[a-z2-7]{32}$/i.test(torrentId))
  ) {
    return magnet(`magnet:?xt=urn:btih:${torrentId}`)
  } else if (ArrayBuffer.isView(torrentId) && torrentId.length === 20) {
    return magnet(`magnet:?xt=urn:btih:${arr2hex(torrentId)}`)
  } else if (ArrayBuffer.isView(torrentId)) {
    return Promise.resolve(decodeTorrentFile(torrentId))
  } else if (torrentId && torrentId.infoHash) {
    torrentId.infoHash = torrentId.infoHash.toLowerCase()

    if (!torrentId.announce) torrentId.announce = []

    if (typeof torrentId.announce === 'string') {
      torrentId.announce = [torrentId.announce]
    }

    if (!torrentId.urlList) torrentId.urlList = []

    return torrentId
  } else {
    throw new Error('Invalid torrent identifier')
  }
}

async function parseTorrentRemote(
  torrentId: string | Uint8Array | Blob,
  opts: Record<string, unknown>,
  cb?: (err: Error | null, parsedTorrent?: Instance) => void
): Promise<Instance> | void {
  if (typeof opts === 'function')
    return parseTorrentRemote(
      torrentId,
      {},
      opts as (err: Error | null, parsedTorrent?: Instance) => void
    )
  if (typeof cb !== 'function') throw new Error('second argument must be a Function')

  let parsedTorrent: Instance | undefined
  try {
    parsedTorrent = await parseTorrent(torrentId as string | Uint8Array | Instance)
  } catch {
    // If torrent fails to parse, it could be a Blob, http/https URL or
    // filesystem path, so don't consider it an error yet.
  }

  if (parsedTorrent && parsedTorrent.infoHash) {
    queueMicrotask(() => {
      cb!(null, parsedTorrent)
    })
  } else if (isBlob(torrentId)) {
    try {
      const torrentBuf = new Uint8Array(await (torrentId as Blob).arrayBuffer())
      parseOrThrow(torrentBuf)
    } catch (err) {
      return cb!(new Error(`Error converting Blob: ${(err as Error).message}`))
    }
  } else if (/^https?:/.test(torrentId as string)) {
    try {
      const res = await fetch(torrentId as string, {
        headers: {
          'user-agent': 'Z-Torrent (https://github.com/webtorrent/webtorrent)',
          ...(opts?.headers as object),
        },
        signal: AbortSignal.timeout(30 * 1000),
        ...opts,
      })
      const torrentBuf = new Uint8Array(await res.arrayBuffer())
      parseOrThrow(torrentBuf)
    } catch (err) {
      return cb!(new Error(`Error downloading torrent: ${(err as Error).message}`))
    }
  } else if (typeof torrentId === 'string' && torrentId.length > 0) {
    import('fs')
      .then((fs) => {
        if (typeof fs.readFile === 'function') {
          fs.readFile(torrentId, (err: Error | null, torrentBuf: Buffer) => {
            if (err) return cb!(new Error('Invalid torrent identifier'))
            parseOrThrow(torrentBuf)
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

  async function parseOrThrow(torrentBuf: Uint8Array): Promise<void> {
    try {
      parsedTorrent = await parseTorrent(torrentBuf)
    } catch (err) {
      return cb!(err as Error)
    }
    if (parsedTorrent && parsedTorrent.infoHash) cb!(null, parsedTorrent)
    else cb!(new Error('Invalid torrent identifier'))
  }
}

function decodeTorrentFile(torrent: Uint8Array | Record<string, unknown>): Instance {
  if (ArrayBuffer.isView(torrent)) {
    torrent = bencode.decode(torrent) as Record<string, unknown>
  }

  const torrentObj = torrent as Record<string, unknown>
  const info = torrentObj.info as Record<string, unknown>

  ensure(info, 'info')
  ensure(info['name.utf-8'] || info.name, 'info.name')
  ensure(info['piece length'], "info['piece length']")
  ensure(info.pieces, 'info.pieces')

  if (info.files) {
    ;(info.files as Array<Record<string, unknown>>).forEach((file) => {
      ensure(typeof file.length === 'number', 'info.files[0].length')
      ensure(file['path.utf-8'] || file.path, 'info.files[0].path')
    })
  } else {
    ensure(typeof info.length === 'number', 'info.length')
  }

  const result: Instance = {
    info: info as Instance['info'],
    infoBuffer: bencode.encode(info),
    name: arr2text((info['name.utf-8'] || info.name) as Uint8Array),
    announce: [],
  }

  result.infoHashBuffer = sha1(
    result.infoBuffer instanceof Uint8Array ? result.infoBuffer : new Uint8Array(result.infoBuffer)
  )
  result.infoHash = arr2hex(result.infoHashBuffer)

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
  const files = (info.files || [info]) as Array<Record<string, unknown>>
  result.files = files.map((file, i) => {
    const parts = [result.name]
      .concat((file['path.utf-8'] || file.path || []) as (string | Uint8Array)[])
      .map((p) => (ArrayBuffer.isView(p) ? arr2text(p as Uint8Array) : (p as string)))
    sum += file.length as number
    return {
      path: parts.join('/'),
      name: parts[parts.length - 1],
      length: file.length as number,
      offset: sum - (file.length as number),
    }
  })

  result.length = sum

  const lastFile = result.files[result.files.length - 1]

  result.pieceLength = info['piece length'] as number
  result.lastPieceLength =
    (lastFile.offset + lastFile.length) % result.pieceLength || result.pieceLength
  result.pieces = splitPieces(info.pieces as Uint8Array)

  return result
}

function encodeTorrentFile(parsed: Instance): Uint8Array {
  const torrent: Record<string, unknown> = {
    info: parsed.info,
  }

  torrent['announce-list'] = (parsed.announce || []).map((url) => {
    if (!torrent.announce) torrent.announce = url
    url = text2arr(url)
    return [url]
  })

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

  return bencode.encode(torrent)
}

function isBlob(obj: unknown): boolean {
  return typeof Blob !== 'undefined' && obj instanceof Blob
}

function splitPieces(buf: Uint8Array): string[] {
  const pieces: string[] = []
  for (let i = 0; i < buf.length; i += 20) {
    pieces.push(arr2hex(buf.slice(i, i + 20)))
  }
  return pieces
}

function ensure(bool: unknown, fieldName: string): void {
  if (!bool) throw new Error(`Torrent is missing required field: ${fieldName}`)
}

export default parseTorrent

/** Sync parse for .torrent buffer - for use in fixtures/tests */
function parseTorrentSync(torrentId: Uint8Array): Instance {
  return decodeTorrentFile(torrentId)
}

const toMagnetURI = encode
export {
  parseTorrentRemote as remote,
  parseTorrentSync,
  encodeTorrentFile as toTorrentFile,
  toMagnetURI,
}
export type { Instance }

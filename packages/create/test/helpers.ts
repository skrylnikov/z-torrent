import { expect } from 'bun:test'

import type { Instance } from '@z-torrent/parse'

import { createTorrent } from '@z-torrent/create'

/** Narrow parsed torrent to a defined multi-file list (asserts in tests). */
export function torrentFilesOf(pt: Instance): NonNullable<Instance['files']> {
  expect(pt.files).toBeDefined()
  return pt.files!
}

export function createTorrentPromise(
  input: Parameters<typeof createTorrent>[0],
  options?: Record<string, unknown>
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const callback = (err: Error | null, torrent?: Uint8Array) => {
      if (err) reject(err)
      else resolve(torrent!)
    }
    if (options === undefined) {
      createTorrent(input, callback)
    } else {
      createTorrent(input, options, callback)
    }
  })
}

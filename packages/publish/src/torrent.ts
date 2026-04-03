import { createTorrent, announceList, type CreateTorrentOptions } from '@z-torrent/create'

import type { PublishConfig, PublishProgress } from './types.js'

export function createSiteTorrent(
  dir: string,
  config: PublishConfig,
  onProgress?: (progress: PublishProgress) => void
): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    const opts: CreateTorrentOptions = {
      createdBy: `Z-Torrent Publish`,
    }

    if (config.publish.pieceLength) {
      opts.pieceLength = config.publish.pieceLength
    }

    const trackers = config.publish.trackers ?? announceList
    if (trackers.length > 0) {
      opts.announceList = trackers
    }

    const webSeedUrl = config.publish.webSeed ?? config.publish.server
    if (webSeedUrl) {
      opts.urlList = webSeedUrl
    }

    opts.onProgress = (bytesDone: number, bytesTotal: number) => {
      onProgress?.({ phase: 'hashing', bytesDone, bytesTotal })
    }

    createTorrent(dir, opts, (err: Error | null, torrent?: Uint8Array) => {
      if (err) return reject(err)
      if (!torrent) return reject(new Error('Failed to create torrent'))
      resolve(torrent)
    })
  })
}

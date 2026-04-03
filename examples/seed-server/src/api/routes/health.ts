import Database from 'bun:sqlite'
import type { ZTorrent } from '@z-torrent/node'
import { json } from '../http.js'
import { getTotalStorage } from '../../storage/db.js'

export function handleHealthMinimal(): Response {
  return json(
    {
      status: 'ok',
      uptime: process.uptime(),
    },
    200
  )
}

export function handleHealthDetailed(
  client: ZTorrent,
  db: Database,
  maxTotalStorage: number
): Response {
  let totalPeers = 0
  for (const torrent of client.torrents) {
    totalPeers += torrent.wires.length
  }

  const body = {
    status: 'ok',
    uptime: process.uptime(),
    torrents: client.torrents.length,
    peers: totalPeers,
    storage: {
      used: getTotalStorage(db),
      total: maxTotalStorage,
    },
  }

  return json(body, 200)
}

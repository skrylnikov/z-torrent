import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, MediaStream } =
  (await import('webrtc-polyfill')) as any
if (!globalThis.RTCPeerConnection) globalThis.RTCPeerConnection = RTCPeerConnection
if (!globalThis.RTCSessionDescription) globalThis.RTCSessionDescription = RTCSessionDescription
if (!globalThis.RTCIceCandidate) globalThis.RTCIceCandidate = RTCIceCandidate
if (!globalThis.MediaStream) globalThis.MediaStream = MediaStream
try {
  require('dotenv/config')
} catch {
  // dotenv optional
}

import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import prettierBytes from 'prettier-bytes'
import { ZTorrent } from '@z-torrent/node'

import { loadConfig } from './config.js'
import { initDatabase, getActiveDeployments } from './storage/db.js'
import { cleanupExpired } from './storage/cleanup.js'
import { createApiServer } from './api/server.js'

const PROTOCOL_NAMES: Record<string, string> = {
  tcpIncoming: 'TCP (incoming)',
  tcpOutgoing: 'TCP (outgoing)',
  utpIncoming: 'µTP (incoming)',
  utpOutgoing: 'µTP (outgoing)',
  webrtc: 'WebRTC',
  webSeed: 'Web Seed',
}

function main() {
  const config = loadConfig()

  console.log('=== Z-Torrent Seed Server ===')
  console.log('Download path:', config.downloadPath)
  console.log('Trackers:', config.trackers.length)
  console.log('Magnets:', config.magnets.length)
  console.log('API port:', config.apiPort)
  console.log('API keys:', config.apiKeys.length)
  console.log('DB path:', config.dbPath)

  if (config.apiKeys.length === 0) {
    console.warn('WARNING: No API_KEYS configured. API will return 503.')
  }

  mkdirSync(config.downloadPath, { recursive: true })
  mkdirSync(dirname(resolve(config.dbPath)), { recursive: true })

  const db = initDatabase(resolve(config.dbPath))
  console.log('Database initialized')

  const iceServers: { urls: string[]; username?: string; credential?: string }[] = [
    {
      urls: [config.stunUrl, 'stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],
    },
  ]
  if (config.turnCredential) {
    iceServers.push({
      urls: [config.turnUrl],
      username: config.turnUsername,
      credential: config.turnCredential,
    })
  }

  const client = new ZTorrent({
    natUpnp: true,
    natPmp: true,
    tracker: {
      rtcConfig: { iceServers },
    },
  })

  client.on('error', (err) => {
    console.error('Client error:', err)
  })

  client.on('warning', (err) => {
    console.warn('Warning:', err.message)
  })

  const downloadPath = resolve(config.downloadPath)

  const deployments = getActiveDeployments(db)
  console.log(`Restoring ${deployments.length} deployment(s) from database...`)

  for (const dep of deployments) {
    const depDownloadPath = resolve(downloadPath, dep.info_hash)
    mkdirSync(depDownloadPath, { recursive: true })

    client.add(dep.torrent, { path: depDownloadPath, announce: config.trackers }, (torrent) => {
      console.log(`[restore] ${torrent.name} (${dep.info_hash.slice(0, 8)}...) — ${dep.status}`)

      torrent.on('done', () => {
        db.run("UPDATE deployments SET status = 'seeding' WHERE info_hash = ?", [dep.info_hash])
      })

      let lastAccessUpdate = 0
      torrent.on('upload', () => {
        const now = Date.now()
        if (now - lastAccessUpdate < 60_000) return
        lastAccessUpdate = now
        db.run('UPDATE deployments SET last_accessed_at = ?, uploaded = ? WHERE info_hash = ?', [
          new Date().toISOString(),
          torrent.uploaded,
          dep.info_hash,
        ])
      })

      attachLogging(torrent)
    })
  }

  for (const magnet of config.magnets) {
    client.add(magnet, { path: downloadPath, announce: config.trackers }, (torrent) => {
      console.log(`[magnet] ${torrent.name} (${torrent.infoHash})`)
      attachLogging(torrent)
    })
  }

  const apiServer = createApiServer(client, db, config)
  console.log(`API server: http://localhost:${config.apiPort}/api`)

  const cleanupTimer = setInterval(() => {
    void cleanupExpired(client, db, downloadPath).catch((err) => {
      console.error('[cleanup] Error:', err)
    })
  }, config.cleanupInterval)
  console.log(`Cleanup job: every ${config.cleanupInterval / 1000}s`)

  const shutdown = (signal: string): void => {
    console.log(`\nShutting down (${signal})...`)
    clearInterval(cleanupTimer)
    apiServer.stop()
    client.destroy(() => {
      db.close()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

function attachLogging(torrent: any) {
  torrent.on('done', () => {
    console.log(`[${torrent.name}] Downloaded ${prettierBytes(torrent.length)} — seeding`)
  })

  type WireLike = {
    type?: string
    remoteAddress?: string
    remotePort?: number
    peerId?: { toString: () => string }
    uploadSpeed?: (bytes?: number) => number
    downloadSpeed?: (bytes?: number) => number
  }

  const wireAddr = (w: WireLike) =>
    w.remoteAddress
      ? `${w.remoteAddress}:${w.remotePort ?? '?'}`
      : w.peerId?.toString?.()?.slice(0, 8) || '?'

  let lastTransferLog = 0
  const logActivePeers = () => {
    const now = Date.now()
    if (now - lastTransferLog < 5000) return
    lastTransferLog = now
    const wires = torrent.wires as WireLike[]
    if (wires.length === 0) return

    for (const w of wires) {
      const up = typeof w.uploadSpeed === 'function' ? w.uploadSpeed() : 0
      const down = typeof w.downloadSpeed === 'function' ? w.downloadSpeed() : 0
      if (up === 0 && down === 0) continue

      const protocol = PROTOCOL_NAMES[w.type || ''] || w.type || '?'
      const addr = wireAddr(w)
      if (down > 0) {
        console.log(
          `[${torrent.name}] Downloading from ${addr} via ${protocol} — ${prettierBytes(down)}/s`
        )
      }
      if (up > 0) {
        console.log(`[${torrent.name}] Seeding to ${addr} via ${protocol} — ${prettierBytes(up)}/s`)
      }
    }
  }
  torrent.on('download', logActivePeers)
  torrent.on('upload', logActivePeers)
  const transferInterval = setInterval(logActivePeers, 10000)
  torrent.on('close', () => clearInterval(transferInterval))

  torrent.on('error', (err: Error) => {
    console.error(`[${torrent.name}] Error:`, err)
  })
}

main()

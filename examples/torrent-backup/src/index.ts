import { createRequire } from 'module'

const require = createRequire(import.meta.url)
try {
  require('dotenv/config')
} catch {
  // dotenv optional — use process.env from shell
}

import { mkdirSync } from 'fs'
import { resolve } from 'path'
import prettierBytes from 'prettier-bytes'
import WebTorrent from 'z-torrent'

const DEFAULT_WSS_TRACKERS = [
  'wss://tracker.btorrent.xyz',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
]

const PROTOCOL_NAMES: Record<string, string> = {
  tcpIncoming: 'TCP (incoming)',
  tcpOutgoing: 'TCP (outgoing)',
  utpIncoming: 'µTP (incoming)',
  utpOutgoing: 'µTP (outgoing)',
  webrtc: 'WebRTC',
  webSeed: 'Web Seed',
}

function parseList(value: string | undefined): string[] {
  if (!value || typeof value !== 'string') return []
  return value
    .split(/[,\n]/)
    .map((s) => s.trim().replace(/^["']|["']$/g, '').replace(/\\"/g, '"'))
    .filter(Boolean)
}

function main() {
  const magnets = parseList(process.env.TORRENT_MAGNETS)
  let trackers = parseList(process.env.TORRENT_TRACKERS)
  const downloadPath = resolve(process.env.TORRENT_DOWNLOAD_PATH || './downloads')
  const httpPort = process.env.TORRENT_HTTP_PORT ? parseInt(process.env.TORRENT_HTTP_PORT, 10) : 0

  if (magnets.length === 0) {
    console.error('TORRENT_MAGNETS is empty. Set magnet links via env (comma or newline separated).')
    process.exit(1)
  }

  if (trackers.length === 0) {
    trackers = DEFAULT_WSS_TRACKERS
    console.log('No TORRENT_TRACKERS set, using default WSS trackers for WebTorrent:', trackers)
  }

  mkdirSync(downloadPath, { recursive: true })
  console.log('Download path:', downloadPath)
  console.log('Trackers:', trackers)
  console.log('Magnets:', magnets.length)

  const client = new WebTorrent({
    natUpnp: true,
    natPmp: true,
  })

  client.on('error', (err) => {
    console.error('Client error:', err)
  })

  client.on('warning', (err) => {
    console.warn('Warning:', err.message)
  })

  if (httpPort > 0) {
    const server = client.createServer()
    server.listen(httpPort, () => {
      const addr = server.address() as { port: number; address: string }
      console.log(`HTTP server: http://${addr.address}:${addr.port}/z-torrent`)
    })
  }

  for (const magnet of magnets) {
    client.add(magnet, { path: downloadPath, announce: trackers }, (torrent) => {
      console.log(`[${torrent.name}] Added (${torrent.infoHash})`)

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
        w.remoteAddress ? `${w.remoteAddress}:${w.remotePort ?? '?'}` : w.peerId?.toString?.()?.slice(0, 8) || '?'

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
            console.log(`[${torrent.name}] Downloading from ${addr} via ${protocol} — ${prettierBytes(down)}/s`)
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

      torrent.on('error', (err) => {
        console.error(`[${torrent.name}] Error:`, err)
      })
    })
  }
}

main()

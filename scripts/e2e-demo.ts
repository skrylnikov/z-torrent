#!/usr/bin/env bun

/**
 * scripts/e2e-demo.ts
 *
 * Starts a local tracker + seed server, publishes the Sintel demo site,
 * seeds it from the CLI process, waits for the seed server to download,
 * then opens the portal. Cleans up on exit.
 *
 * Usage:
 *   bun run scripts/e2e-demo.ts
 *
 * Env vars:
 *   ZT_TRACKER_PORT   default: 9000
 *   ZT_SEED_API_PORT  default: 3001
 *   ZT_SEED_HTTP_PORT default: 8081
 *   ZT_API_KEY        default: zt_e2e_test
 */

import { spawn, ChildProcess, execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { cpSync, mkdirSync, readFileSync, existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const TRACKER_PORT = parseInt(process.env.ZT_TRACKER_PORT ?? '9000', 10)
const SEED_API_PORT = parseInt(process.env.ZT_SEED_API_PORT ?? '3001', 10)
const SEED_HTTP_PORT = parseInt(process.env.ZT_SEED_HTTP_PORT ?? '8081', 10)
const API_KEY = process.env.ZT_API_KEY ?? 'zt_e2e_test'

const SINTEL_WEB_DIR = resolve(ROOT, 'examples/sintel-web')
const SINTEL_DIST_DIR = resolve(SINTEL_WEB_DIR, 'dist')
const TRACKER_BIN = resolve(ROOT, 'packages/tracker/dist/bin/cmd.js')

let trackerProc: ChildProcess | null = null
let seedProc: ChildProcess | null = null
let portalProc: ChildProcess | null = null

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${msg}`)
}

function run(cmd: string, args: string[], env: Record<string, string>): ChildProcess {
  const proc = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  proc.stdout?.on('data', (d: Buffer) => {
    for (const line of d.toString().split('\n')) {
      if (line.trim()) console.log(`  ${line.trim()}`)
    }
  })
  proc.stderr?.on('data', (d: Buffer) => {
    for (const line of d.toString().split('\n')) {
      if (line.trim()) console.log(`  [stderr] ${line.trim()}`)
    }
  })

  return proc
}

async function waitFor(url: string, timeoutMs = 15000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function cleanup() {
  log('Shutting down...')
  if (portalProc) {
    portalProc.kill('SIGINT')
    portalProc = null
  }
  if (seedProc) {
    seedProc.kill('SIGINT')
    seedProc = null
  }
  if (trackerProc) {
    trackerProc.kill('SIGINT')
    trackerProc = null
  }
  await new Promise((r) => setTimeout(r, 1000))
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

async function main() {
  log('=== Z-Torrent E2E Demo ===')
  log('')

  log(`[1/8] Starting WSS tracker on port ${TRACKER_PORT}...`)
  trackerProc = run('bun', [TRACKER_BIN, '--ws', '--port', String(TRACKER_PORT)], {})
  const trackerOk = await waitFor(`http://localhost:${TRACKER_PORT}/stats`, 10000)
  if (!trackerOk) {
    log('FAILED: Tracker did not start')
    await cleanup()
    return
  }
  log(`  Tracker OK — ws://localhost:${TRACKER_PORT}`)
  log('')

  log(`[2/8] Starting seed server (API :${SEED_API_PORT}, HTTP :${SEED_HTTP_PORT})...`)
  seedProc = run('bun', ['run', 'examples/seed-server/src/index.ts'], {
    API_PORT: String(SEED_API_PORT),
    TORRENT_HTTP_PORT: String(SEED_HTTP_PORT),
    TORRENT_DOWNLOAD_PATH: resolve(ROOT, 'examples/seed-server/downloads'),
    DB_PATH: resolve(ROOT, 'examples/seed-server/data/e2e-deployments.db'),
    TORRENT_TRACKERS: `ws://localhost:${TRACKER_PORT}`,
    TORRENT_MAGNETS: '',
    API_KEYS: JSON.stringify([
      {
        key: API_KEY,
        name: 'e2e-test',
        public: false,
        limits: {
          maxDeploySize: '10MB',
          maxTotalStorage: '1GB',
          maxDeployments: 100,
          ttl: '1d',
          rateLimit: '100/min',
        },
      },
    ]),
    PORTAL_URL: `http://localhost:5173`,
    DEFAULT_TTL: '1d',
    CLEANUP_INTERVAL: '1h',
  })

  const healthOk = await waitFor(`http://localhost:${SEED_API_PORT}/api/health`, 15000)
  if (!healthOk) {
    log('FAILED: Seed server did not start')
    await cleanup()
    return
  }
  log(`  Seed server OK — http://localhost:${SEED_API_PORT}/api`)
  log('')

  log('[3/8] Starting web portal on port 5173...')
  const PORTAL_DIR = resolve(ROOT, 'examples/web-portal')
  portalProc = spawn('bun', ['--bun', 'vite', '--host', '0.0.0.0', '--port', '5173'], {
    cwd: PORTAL_DIR,
    env: {
      ...process.env,
      BUN_CONFIG_ALLOW_NO_DASHBOARD: '1',
      VITE_DEV_TRACKER: `ws://localhost:${TRACKER_PORT}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  portalProc.stdout?.on('data', (d: Buffer) => {
    for (const line of d.toString().split('\n')) {
      if (line.trim()) console.log(`  [portal] ${line.trim()}`)
    }
  })
  portalProc.stderr?.on('data', (d: Buffer) => {
    for (const line of d.toString().split('\n')) {
      if (line.trim()) console.log(`  [portal] ${line.trim()}`)
    }
  })
  const portalOk = await waitFor('http://localhost:5173', 15000)
  if (!portalOk) {
    log('FAILED: Portal did not start')
    await cleanup()
    return
  }
  log('  Portal OK — http://localhost:5173')
  log('')

  log('[4/8] Building Sintel demo site (Astro)...')

  if (!existsSync(SINTEL_DIST_DIR)) {
    log('  Running astro build...')
    execSync('bun run build', { cwd: SINTEL_WEB_DIR, stdio: 'inherit' })
    log('  Astro build complete.')
  } else {
    log('  Using existing dist/ (delete to rebuild).')
  }
  log('')

  log('[5/8] Publishing Sintel demo site...')
  const { publish, pushToServer } = await import('../packages/publish/dist/index.js')

  const torrentOutputPath = resolve(ROOT, `/tmp/sintel-demo-${Date.now()}.torrent`)

  let result
  try {
    result = await publish(SINTEL_WEB_DIR, {
      trackers: [[`ws://localhost:${TRACKER_PORT}`]],
      output: torrentOutputPath,
      onProgress: (p: any) => {
        switch (p.phase) {
          case 'scanning':
            log('  Scanning directory...')
            break
          case 'manifest':
            log(`  ${p.message}`)
            break
          case 'hashing':
            process.stdout.write(`\r  Hashing: ${((p.bytesDone / p.bytesTotal) * 100).toFixed(0)}%`)
            break
          case 'writing':
            process.stdout.write(`\n  Writing: ${p.path}`)
            break
          case 'done':
            console.log()
            break
        }
      },
    })
  } catch (err: any) {
    log(`FAILED: ${err.message}`)
    await cleanup()
    return
  }

  console.log()
  log(`  Info hash: ${result.infoHash}`)
  log(`  Torrent:  ${result.torrentPath}`)
  log(`  Files:    ${result.fileCount}`)
  log(`  Size:     ${result.totalSize} bytes`)
  log('')

  log('[6/8] Copying site files to seed server downloads...')
  const downloadsDir = resolve(ROOT, 'examples/seed-server/downloads')
  const torrentFilesDir = resolve(downloadsDir, result.infoHash, 'dist')
  mkdirSync(torrentFilesDir, { recursive: true })
  cpSync(SINTEL_DIST_DIR, torrentFilesDir, { recursive: true })
  log(`  Copied to ${torrentFilesDir}`)
  log('')

  log('[7/8] Uploading to seed server...')
  const torrentBuf = readFileSync(torrentOutputPath)
  try {
    const publishRes = await pushToServer(
      `http://localhost:${SEED_API_PORT}`,
      API_KEY,
      new Uint8Array(torrentBuf),
      result.manifest
    )
    log(`  Uploaded: ${publishRes.infoHash}`)
  } catch (err: any) {
    log(`  Upload failed: ${err.message}`)
    await cleanup()
    return
  }
  log('')

  log('[8/8] Waiting for seed server to verify and start seeding...')
  const statusUrl = `http://localhost:${SEED_API_PORT}/api/status/${result.infoHash}`
  const deadline = Date.now() + 30_000
  let seeded = false

  while (Date.now() < deadline) {
    try {
      const res = await fetch(statusUrl, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      })
      if (res.ok) {
        const status = (await res.json()) as Record<string, unknown>
        const statusStr = String(status.status ?? 'unknown')
        const progress =
          typeof status.progress === 'number' ? (status.progress * 100).toFixed(0) : '?'
        const peers = status.peers ?? 0
        process.stdout.write(`\r  Status: ${statusStr} (${progress}%) peers=${peers}`)
        if (statusStr === 'seeding') {
          seeded = true
          console.log()
          break
        }
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  if (!seeded) {
    log('\n  WARNING: Seed server did not reach seeding state within 120s.')
  } else {
    log('  Seed server is now serving files via P2P.')
  }
  log('')

  log('Verifying deployment...')
  try {
    const res = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    })
    const status = (await res.json()) as Record<string, unknown>
    log(`  Status:  ${status.status}`)
    log(`  Ready:  ${status.ready}`)
    log(`  Peers:  ${status.peers ?? 0}`)
  } catch (err: any) {
    log(`  WARNING: Could not verify: ${err.message}`)
  }
  log('')

  log('=== Demo is running! ===')
  log('')
  log(`  Tracker:      ws://localhost:${TRACKER_PORT}`)
  log(`  Seed API:     http://localhost:${SEED_API_PORT}/api`)
  log(`  Seed HTTP:    http://localhost:${SEED_HTTP_PORT}/z-torrent`)
  log(`  Info hash:    ${result.infoHash}`)
  log(`  Portal URL:   http://localhost:5173/${result.infoHash}`)
  log('')
  log('  Press Ctrl+C to stop all services.')
  log('')
}

main().catch((err) => {
  log(`Fatal: ${err.message}`)
  cleanup()
})

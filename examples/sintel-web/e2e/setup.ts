/**
 * e2e/setup.ts — brings up the full local stack, publishes sintel-web, and
 * exposes the portal URL to the tests. Runs under bun (spawned by
 * e2e/global-setup.ts).
 *
 * It starts three long-lived services (WSS tracker, seed-server, web-portal) as
 * detached processes that survive this script's exit, then builds sintel-web,
 * publishes it as a torrent, pre-seeds the files into the seed-server's download
 * dir, uploads it, and polls until the seed-server reports `seeding`.
 *
 * On success it writes `e2e/.state.json` with the portal URL, infoHash, PIDs and
 * temp dirs. On failure it kills anything it spawned and exits non-zero so the
 * Playwright global setup fails fast.
 *
 * Env overrides:
 *   ZT_TRACKER_PORT   default 9000
 *   ZT_SEED_API_PORT  default 3001
 *   ZT_PORTAL_PORT    default 5173
 *   ZT_API_KEY        default zt_e2e_test
 */

import { spawn, execSync } from 'node:child_process'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { pathToFileURL } from 'node:url'
import bencode from 'bencode'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// examples/sintel-web/e2e -> repo root (up three levels).
const ROOT = resolve(__dirname, '..', '..', '..')
const LOGS_DIR = resolve(__dirname, '.logs')
const STATE_FILE = resolve(__dirname, '.state.json')

const TRACKER_PORT = parseInt(process.env.ZT_TRACKER_PORT ?? '9000', 10)
const SEED_API_PORT = parseInt(process.env.ZT_SEED_API_PORT ?? '3001', 10)
const PORTAL_PORT = parseInt(process.env.ZT_PORTAL_PORT ?? '5173', 10)
const API_KEY = process.env.ZT_API_KEY ?? 'zt_e2e_test'

const SINTEL_WEB_DIR = resolve(ROOT, 'examples/sintel-web')
const SINTEL_DIST_DIR = resolve(SINTEL_WEB_DIR, 'dist')
const TRACKER_BIN = resolve(ROOT, 'packages/tracker/dist/bin/cmd.js')
const PUBLISH_DIST = resolve(ROOT, 'packages/publish/dist/index.js')
const PORTAL_DIR = resolve(ROOT, 'examples/web-portal')

const spawnedPids: number[] = []

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[setup ${ts}] ${msg}`)
}

function ensureBuilt(): void {
  if (!existsSync(TRACKER_BIN)) {
    throw new Error(
      `Tracker bin not found (${TRACKER_BIN}). Run \`bun run build\` at the repo root first.`
    )
  }
  if (!existsSync(PUBLISH_DIST)) {
    throw new Error(
      `Publish dist not found (${PUBLISH_DIST}). Run \`bun run build\` at the repo root first.`
    )
  }
  if (!existsSync(resolve(PORTAL_DIR, 'node_modules'))) {
    throw new Error(
      `Portal deps not installed (${PORTAL_DIR}/node_modules). Run \`bun install\` at the repo root.`
    )
  }
}

/**
 * Spawn a long-lived command detached in its own session/process-group, with
 * stdout+stderr appended to a log file. Because it is detached and unref'd, it
 * keeps running after this script exits; teardown kills it by PID (negative PID
 * = whole group). Uses `exec ... >> log 2>&1` so the recorded PID is the actual
 * server PID and file redirects don't depend on the parent staying alive.
 */
function spawnDetached(
  name: string,
  cmd: string,
  opts: { cwd: string; env: Record<string, string> }
): number {
  mkdirSync(LOGS_DIR, { recursive: true })
  const logPath = join(LOGS_DIR, `${name}.log`)
  writeFileSync(logPath, '')
  const proc = spawn('sh', ['-c', `exec ${cmd} >> "${logPath}" 2>&1`], {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdio: 'ignore',
    detached: true,
  })
  proc.unref()
  const pid = proc.pid
  if (!pid) throw new Error(`Failed to spawn ${name}`)
  spawnedPids.push(pid)
  log(`${name} spawned (pid ${pid}) -> ${logPath}`)
  return pid
}

function killSpawned(): void {
  for (const pid of spawnedPids) {
    try {
      process.kill(-pid, 'SIGTERM') // process group
    } catch {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        /* already gone */
      }
    }
  }
}

async function probe(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) })
    return res.ok
  } catch {
    return false
  }
}

async function waitFor(url: string, timeoutMs = 20_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await probe(url)) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function waitForSeeding(infoHash: string, timeoutMs = 60_000): Promise<boolean> {
  const url = `http://localhost:${SEED_API_PORT}/api/status/${infoHash}`
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        signal: AbortSignal.timeout(2000),
      })
      if (res.ok) {
        const status = (await res.json()) as { status?: string }
        if (status.status === 'seeding') return true
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

async function main(): Promise<void> {
  ensureBuilt()
  mkdirSync(LOGS_DIR, { recursive: true })

  // Guard against orphaned processes from a previous crashed run holding ports.
  const collisions = [
    ['tracker', `http://localhost:${TRACKER_PORT}/stats`],
    ['seed', `http://localhost:${SEED_API_PORT}/api/health`],
    ['portal', `http://localhost:${PORTAL_PORT}/`],
  ] as const
  for (const [name, url] of collisions) {
    if (await probe(url)) {
      throw new Error(
        `${name} appears to already be running (${url}). Clean up orphan processes ` +
          `(see e2e/.state.json PIDs or \`lsof -i :${new URL(url).port}\`) and retry.`
      )
    }
  }

  log(`[1/7] Starting WSS tracker on port ${TRACKER_PORT}...`)
  const trackerPid = spawnDetached(
    'tracker',
    `bun "${TRACKER_BIN}" --ws --port ${TRACKER_PORT}`,
    { cwd: ROOT, env: {} }
  )
  if (!(await waitFor(`http://localhost:${TRACKER_PORT}/stats`, 15_000))) {
    throw new Error('Tracker did not become ready')
  }
  log('  tracker ready')

  log(`[2/7] Starting seed-server (API :${SEED_API_PORT})...`)
  const tmpDir = mkdtempSync(join(tmpdir(), 'zt-sintel-e2e-'))
  const downloadsDir = join(tmpDir, 'downloads')
  const dbPath = join(tmpDir, 'e2e.db')
  const seedPid = spawnDetached('seed', `bun run examples/seed-server/src/index.ts`, {
    cwd: ROOT,
    env: {
      API_PORT: String(SEED_API_PORT),
      TORRENT_TRACKERS: `ws://localhost:${TRACKER_PORT}`,
      TORRENT_MAGNETS: '',
      TORRENT_DOWNLOAD_PATH: downloadsDir,
      DB_PATH: dbPath,
      PORTAL_URL: `http://localhost:${PORTAL_PORT}`,
      DEFAULT_TTL: '1d',
      CLEANUP_INTERVAL: '1h',
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
    },
  })
  if (!(await waitFor(`http://localhost:${SEED_API_PORT}/api/health`, 20_000))) {
    throw new Error('Seed-server did not become ready')
  }
  log('  seed-server ready')

  log(`[3/7] Starting web-portal on port ${PORTAL_PORT}...`)
  const portalPid = spawnDetached(
    'portal',
    `bun --bun vite --host 0.0.0.0 --port ${PORTAL_PORT}`,
    {
      cwd: PORTAL_DIR,
      env: {
        BUN_CONFIG_ALLOW_NO_DASHBOARD: '1',
        VITE_DEV_TRACKER: `ws://localhost:${TRACKER_PORT}`,
      },
    }
  )
  if (!(await waitFor(`http://localhost:${PORTAL_PORT}/`, 20_000))) {
    throw new Error('Portal did not become ready')
  }
  log('  portal ready')

  log('[4/7] Building sintel-web (fresh dist for a deterministic publish)...')
  rmSync(SINTEL_DIST_DIR, { recursive: true, force: true })
  execSync('bun run build', { cwd: SINTEL_WEB_DIR, stdio: 'inherit' })

  log('[5/7] Publishing sintel-web as a torrent...')
  const torrentPath = join(tmpDir, 'site.torrent')
  const { publish, pushToServer } = (await import(pathToFileURL(PUBLISH_DIST).href)) as {
    publish: typeof import('@z-torrent/publish').publish
    pushToServer: typeof import('@z-torrent/publish').pushToServer
  }
  const result = await publish(SINTEL_WEB_DIR, {
    trackers: [[`ws://localhost:${TRACKER_PORT}`]],
    output: torrentPath,
  })
  log(`  infoHash: ${result.infoHash} (${result.fileCount} files, ${result.totalSize} B)`)

  log('[6/7] Pre-seeding site files into seed-server downloads + uploading...')
  // WebTorrent stores a multi-file torrent under `<path>/<info.name>/`, so we
  // must mirror dist into `downloads/<infoHash>/<torrentName>/` for the
  // seed-server to find and verify the already-present bytes. (Pre-seeding flat
  // at `downloads/<infoHash>/` leaves WebTorrent waiting for a download that
  // never starts — peers stay 0.)
  const torrentBuf = new Uint8Array(readFileSync(torrentPath))
  const torrentName = String(bencode.decode(torrentBuf, 'utf8').info.name)
  const seedTarget = join(downloadsDir, result.infoHash, torrentName)
  mkdirSync(seedTarget, { recursive: true })
  cpSync(SINTEL_DIST_DIR, seedTarget, { recursive: true })

  const published = await pushToServer(
    `http://localhost:${SEED_API_PORT}`,
    API_KEY,
    torrentBuf,
    result.manifest
  )
  log(`  uploaded: ${published.infoHash}`)

  log('[7/7] Waiting for seed-server to reach `seeding`...')
  if (!(await waitForSeeding(result.infoHash, 60_000))) {
    throw new Error(`Seed-server did not reach seeding for ${result.infoHash}`)
  }
  log('  seeding')

  writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        portalUrl: `http://localhost:${PORTAL_PORT}/${result.infoHash}`,
        infoHash: result.infoHash,
        seedApiUrl: `http://localhost:${SEED_API_PORT}`,
        apiKey: API_KEY,
        pids: { tracker: trackerPid, seed: seedPid, portal: portalPid },
        tmpDir,
      },
      null,
      2
    )
  )

  log(`Ready — portal: http://localhost:${PORTAL_PORT}/${result.infoHash}`)
}

// Kill spawned servers if this script is interrupted mid-setup.
process.on('SIGINT', () => {
  killSpawned()
  process.exit(130)
})
process.on('SIGTERM', () => {
  killSpawned()
  process.exit(143)
})

main().catch((err: Error) => {
  log(`FAILED: ${err.message}`)
  killSpawned()
  try {
    rmSync(STATE_FILE, { force: true })
  } catch {
    /* ignore */
  }
  process.exit(1)
})

import fs from 'fs'
import path from 'path'
import os from 'os'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'

import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { parseTorrentSync } from '@z-torrent/parse'

import { publish, waitForReady } from '../src/index.js'
import type { StatusResponse } from '../src/server.js'

const SINTEL_WEB_DIR = path.resolve(__dirname, '../../../examples/sintel-web')

const SEED_SERVER_URL = process.env.ZT_SEED_SERVER_URL ?? 'http://localhost:3000'
const SEED_SERVER_API_KEY = process.env.ZT_SEED_SERVER_API_KEY ?? 'zt_live_changeme'

function createTempSite(): string {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'zt-e2e-'))
  writeFileSync(path.join(tmpDir, 'index.html'), '<html><body>E2E Test Site</body></html>', 'utf-8')
  writeFileSync(path.join(tmpDir, 'style.css'), 'body { color: blue; }', 'utf-8')
  return tmpDir
}

async function isServerReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

describe('pushToServer', () => {
  test('rejects with error on invalid API key', async () => {
    if (!(await isServerReachable(SEED_SERVER_URL))) {
      console.log('Skipping: seed server not reachable')
      return
    }

    const tmpDir = createTempSite()
    try {
      await publish(tmpDir, {
        dir: tmpDir,
        dryRun: false,
        server: SEED_SERVER_URL,
        apiKey: 'invalid-key-xyz',
        output: path.join(tmpDir, 'e2e.torrent'),
      })
      expect.unreachable('should have thrown')
    } catch (err: any) {
      expect(err.message).toBeDefined()
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('rejects with connection error on unreachable server', async () => {
    const tmpDir = createTempSite()
    try {
      await publish(tmpDir, {
        dir: tmpDir,
        dryRun: false,
        server: 'http://localhost:19999',
        apiKey: 'test-key',
        output: path.join(tmpDir, 'e2e.torrent'),
      })
      expect.unreachable('should have thrown')
    } catch (err: any) {
      expect(err.message).toBeDefined()
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('waitForReady', () => {
  test('rejects on timeout with non-existent info hash', async () => {
    if (!(await isServerReachable(SEED_SERVER_URL))) {
      console.log('Skipping: seed server not reachable')
      return
    }

    await expect(
      waitForReady(SEED_SERVER_URL, SEED_SERVER_API_KEY, 'a'.repeat(40), 5000)
    ).rejects.toThrow('Resource not found')
  })
})

describe('full publish flow', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = createTempSite()
  })

  afterAll(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('publishes site and returns valid result', async () => {
    const outputPath = path.join(tmpDir, 'e2e-output.torrent')
    const result = await publish(tmpDir, {
      dir: tmpDir,
      output: outputPath,
    })

    expect(result.infoHash).toHaveLength(40)
    expect(result.torrentPath).toBe(outputPath)
    expect(result.fileCount).toBe(2)
    expect(result.totalSize).toBeGreaterThan(0)
    expect(result.manifest.version).toBe(1)

    const torrentData = fs.readFileSync(outputPath)
    const parsed = parseTorrentSync(torrentData)
    expect(parsed.infoHash).toBe(result.infoHash)
    expect(parsed.files!.some((f) => f.path.endsWith('zt-manifest.json'))).toBeTrue()
  })

  test('dry-run with Sintel demo produces valid torrent', async () => {
    if (!fs.existsSync(SINTEL_WEB_DIR)) {
      console.log('Skipping: examples/sintel-web not found')
      return
    }

    const result = await publish(SINTEL_WEB_DIR, {
      dryRun: true,
    })

    expect(result.infoHash).toHaveLength(40)
    expect(result.torrentPath).toBe('<dry-run>')
    expect(result.manifest.site.name).toContain('Sintel')
    expect(result.totalSize).toBeLessThan(1024 * 1024)
  })
})

describe('seed server integration', () => {
  let tmpDir: string
  let infoHash: string

  beforeAll(() => {
    tmpDir = createTempSite()
  })

  afterAll(async () => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
    if (infoHash && (await isServerReachable(SEED_SERVER_URL))) {
      try {
        await fetch(`${SEED_SERVER_URL}/api/deployments/${infoHash}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${SEED_SERVER_API_KEY}` },
        })
      } catch {
        // cleanup best-effort
      }
    }
  })

  test('health endpoint responds', async () => {
    if (!(await isServerReachable(SEED_SERVER_URL))) {
      console.log('Skipping: seed server not reachable')
      return
    }

    const res = await fetch(`${SEED_SERVER_URL}/api/health`)
    expect(res.ok).toBe(true)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.uptime).toBeDefined()
  })

  test('publishes to seed server and gets status', async () => {
    if (!(await isServerReachable(SEED_SERVER_URL))) {
      console.log('Skipping: seed server not reachable')
      return
    }

    const outputPath = path.join(tmpDir, 'e2e-server.torrent')
    const result = await publish(tmpDir, {
      dir: tmpDir,
      output: outputPath,
      server: SEED_SERVER_URL,
      apiKey: SEED_SERVER_API_KEY,
    })

    expect(result.infoHash).toHaveLength(40)
    expect(fs.existsSync(outputPath)).toBeTrue()
    infoHash = result.infoHash

    const statusRes = await fetch(`${SEED_SERVER_URL}/api/status/${infoHash}`, {
      headers: { Authorization: `Bearer ${SEED_SERVER_API_KEY}` },
    })
    expect(statusRes.ok).toBe(true)
    const status = (await statusRes.json()) as StatusResponse
    expect(status.infoHash).toBe(infoHash)
    expect(['downloading', 'seeding']).toContain(status.status)
  })
})

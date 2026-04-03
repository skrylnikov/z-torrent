import fs from 'fs'
import path from 'path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'url'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import os from 'os'

import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { parseTorrentSync } from '@z-torrent/parse'

import { publish, loadConfig, buildManifest } from '../src/index.js'
import type { PublishConfig } from '../src/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/fixtures')

function createTempSite(): string {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'zt-publish-test-'))
  writeFileSync(path.join(tmpDir, 'index.html'), '<html><body>Hello</body></html>', 'utf-8')
  writeFileSync(path.join(tmpDir, 'style.css'), 'body { color: red; }', 'utf-8')
  mkdirSync(path.join(tmpDir, 'assets'))
  writeFileSync(path.join(tmpDir, 'assets', 'logo.png'), Buffer.alloc(100))
  return tmpDir
}

describe('buildManifest', () => {
  test('creates a valid manifest from config', () => {
    const config: PublishConfig = {
      site: { name: 'Test Site', description: 'A test' },
      type: 'static',
      routing: { entry: 'index.html' },
      publish: { dir: '/tmp' },
    }
    const manifest = buildManifest(config, { totalSize: 1024, fileCount: 3 })
    expect(manifest.version).toBe(1)
    expect(manifest.site.name).toBe('Test Site')
    expect(manifest.type).toBe('static')
    expect(manifest._meta).toBeDefined()
    expect(manifest._meta!.totalSize).toBe(1024)
    expect(manifest._meta!.fileCount).toBe(3)
    expect(manifest._meta!.publisherVersion).toBeDefined()
    expect(manifest._meta!.publishedAt).toBeDefined()
  })

  test('preserves routing config from loadConfig defaults', () => {
    const config: PublishConfig = {
      site: { name: 'SPA' },
      type: 'spa',
      routing: { entry: 'index.html', fallback: 'index.html' },
      publish: { dir: '/tmp' },
    }
    const manifest = buildManifest(config, { totalSize: 0, fileCount: 0 })
    expect(manifest.routing?.fallback).toBe('index.html')
    expect(manifest.routing?.entry).toBe('index.html')
  })

  test('builds manifest successfully for valid config', () => {
    const config: PublishConfig = {
      site: { name: 'Bad' },
      type: 'static',
      publish: { dir: '/tmp' },
    }
    const manifest = buildManifest(config, { totalSize: 0, fileCount: 0 })
    expect(manifest.version).toBe(1)
    expect(manifest.site.name).toBe('Bad')
  })
})

describe('loadConfig', () => {
  test('loads JSON config file', async () => {
    const tmpDir = createTempSite()
    const configPath = path.join(tmpDir, 'z-torrent.config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        site: { name: 'JSON Test' },
        type: 'static',
        publish: { dir: tmpDir },
      }),
      'utf-8'
    )
    const config = await loadConfig(tmpDir, { config: configPath })
    expect(config.site.name).toBe('JSON Test')
    expect(config.type).toBe('static')
    expect(config.publish.dir).toBe(tmpDir)
  })

  test('resolves $ENV_VAR placeholders', async () => {
    process.env.ZT_TEST_VALUE = 'resolved-value'
    const tmpDir = createTempSite()
    const configPath = path.join(tmpDir, 'z-torrent.config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        site: { name: '$ZT_TEST_VALUE' },
        type: 'static',
        publish: { dir: tmpDir },
      }),
      'utf-8'
    )
    const config = await loadConfig(tmpDir, { config: configPath })
    expect(config.site.name).toBe('resolved-value')
    delete process.env.ZT_TEST_VALUE
  })

  test('CLI opts override config values', async () => {
    const tmpDir = createTempSite()
    const configPath = path.join(tmpDir, 'z-torrent.config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        site: { name: 'Original' },
        type: 'static',
        publish: { dir: tmpDir },
      }),
      'utf-8'
    )
    const config = await loadConfig(tmpDir, {
      config: configPath,
      dir: FIXTURES_DIR,
      server: 'https://override.example.com',
    })
    expect(config.site.name).toBe('Original')
    expect(config.publish.dir).toBe(FIXTURES_DIR)
    expect(config.publish.server).toBe('https://override.example.com')
  })

  test('throws on missing config file with explicit path', async () => {
    await expect(loadConfig('/tmp', { config: '/nonexistent/config.json' })).rejects.toThrow(
      'Config file not found'
    )
  })

  test('throws when publish.dir is missing or not a string', async () => {
    const tmpDir = createTempSite()
    const configPath = path.join(tmpDir, 'z-torrent.config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        site: { name: 'Test' },
        type: 'static',
        publish: { dir: '' },
      }),
      'utf-8'
    )
    await expect(loadConfig(tmpDir, { config: configPath })).rejects.toThrow(
      'publish.dir is required'
    )
  })

  test('creates default config when no config file found', async () => {
    const tmpDir = createTempSite()
    const config = await loadConfig(tmpDir, { dir: tmpDir })
    expect(config.site.name).toBe(path.basename(tmpDir))
    expect(config.type).toBe('static')
    expect(config.publish.dir).toBe(tmpDir)
  })

  test('loads mjs config file (auto-detect)', async () => {
    const tmpDir = createTempSite()
    try {
      writeFileSync(
        path.join(tmpDir, 'z-torrent.config.mjs'),
        `export default {
  site: { name: 'MJS Test' },
  type: 'static',
  publish: { dir: ${JSON.stringify(tmpDir)} },
}`,
        'utf-8'
      )
      const config = await loadConfig(tmpDir)
      expect(config.site.name).toBe('MJS Test')
      expect(config.publish.dir).toBe(tmpDir)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('loads ts config file (auto-detect)', async () => {
    const tmpDir = createTempSite()
    try {
      writeFileSync(
        path.join(tmpDir, 'z-torrent.config.ts'),
        `export default {
  site: { name: 'TS Test' },
  type: 'static',
  publish: { dir: ${JSON.stringify(tmpDir)} },
}`,
        'utf-8'
      )
      const config = await loadConfig(tmpDir)
      expect(config.site.name).toBe('TS Test')
      expect(config.publish.dir).toBe(tmpDir)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('loads js config file by explicit path', async () => {
    const tmpDir = createTempSite()
    try {
      const configPath = path.join(tmpDir, 'my-config.js')
      writeFileSync(
        configPath,
        `export default {
  site: { name: 'JS Test' },
  type: 'static',
  publish: { dir: ${JSON.stringify(tmpDir)} },
}`,
        'utf-8'
      )
      const config = await loadConfig(tmpDir, { config: configPath })
      expect(config.site.name).toBe('JS Test')
      expect(config.publish.dir).toBe(tmpDir)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('publish', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = createTempSite()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('dry-run produces valid torrent without writing file', async () => {
    const manifestPath = path.join(tmpDir, 'zt-manifest.json')
    expect(fs.existsSync(manifestPath)).toBe(false)

    const result = await publish(tmpDir, {
      dir: tmpDir,
      dryRun: true,
    })

    expect(fs.existsSync(manifestPath)).toBe(false)
    expect(result.infoHash).toBeDefined()
    expect(result.infoHash).toHaveLength(40)
    expect(result.torrentPath).toBe('<dry-run>')
    expect(result.fileCount).toBe(3)
    expect(result.totalSize).toBeGreaterThan(0)
    expect(result.manifest.version).toBe(1)
    expect(result.manifest.site.name).toBeDefined()
  })

  test('writes .torrent file to disk', async () => {
    const outputPath = path.join(tmpDir, 'output.torrent')
    const manifestPath = path.join(tmpDir, 'zt-manifest.json')
    expect(fs.existsSync(manifestPath)).toBe(false)

    const result = await publish(tmpDir, {
      dir: tmpDir,
      output: outputPath,
    })

    expect(fs.existsSync(manifestPath)).toBe(true)
    expect(result.torrentPath).toBe(outputPath)
    expect(fs.existsSync(outputPath)).toBeTrue()

    const torrentData = fs.readFileSync(outputPath)
    const parsed = parseTorrentSync(torrentData)
    expect(parsed.infoHash).toBe(result.infoHash)
    expect(parsed.files).toBeDefined()
    const fileNames = parsed.files!.map((f) => f.path)
    expect(fileNames.some((f) => f.endsWith('zt-manifest.json'))).toBeTrue()
    expect(fileNames.some((f) => f.endsWith('index.html'))).toBeTrue()
    expect(fileNames.some((f) => f.endsWith('style.css'))).toBeTrue()
  })

  test('manifest in torrent is valid JSON', async () => {
    const outputPath = path.join(tmpDir, 'output.torrent')
    const result = await publish(tmpDir, {
      dir: tmpDir,
      output: outputPath,
    })

    expect(result.manifest.version).toBe(1)
    expect(result.manifest.type).toBe('static')
    expect(result.manifest.site.name).toBe(path.basename(tmpDir))
    expect(result.manifest._meta).toBeDefined()
    expect(result.manifest._meta!.totalSize).toBeGreaterThan(0)
    expect(result.manifest._meta!.fileCount).toBe(3)
  })

  test('throws on missing directory', async () => {
    await expect(
      publish(tmpDir, {
        dir: '/nonexistent/directory/path',
      })
    ).rejects.toThrow('Directory not found')
  })

  test('throws on missing entry file', async () => {
    const badDir = mkdtempSync(path.join(os.tmpdir(), 'zt-publish-bad-'))
    writeFileSync(path.join(badDir, 'readme.txt'), 'no index', 'utf-8')
    try {
      await expect(publish(badDir, { dir: badDir })).rejects.toThrow('Entry file not found')
    } finally {
      fs.rmSync(badDir, { recursive: true, force: true })
    }
  })

  test('works with JSON config file', async () => {
    const configPath = path.join(tmpDir, 'z-torrent.config.json')
    writeFileSync(
      configPath,
      JSON.stringify({
        site: { name: 'Configured Site', description: 'From config' },
        type: 'static',
        routing: { entry: 'index.html' },
        publish: { dir: tmpDir },
      }),
      'utf-8'
    )

    const result = await publish(tmpDir, {
      config: configPath,
      dryRun: true,
    })

    expect(result.manifest.site.name).toBe('Configured Site')
    expect(result.manifest.site.description).toBe('From config')
    expect(result.infoHash).toHaveLength(40)
  })
})

test('cli dist --help when built', () => {
  const cliJs = path.resolve(__dirname, '../dist/cli.js')
  if (!fs.existsSync(cliJs)) return

  const r = spawnSync(process.execPath, [cliJs, '--help'], { encoding: 'utf-8' })
  expect(r.status).toBe(0)
  expect(r.stdout ?? '').toContain('z-torrent-publish')
})

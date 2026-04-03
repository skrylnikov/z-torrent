import fs from 'fs'
import os from 'os'
import path from 'path'

import { parseTorrentSync } from '@z-torrent/parse'

import type { PublishConfig, PublishOptions, PublishResult } from './types.js'
import { loadConfig } from './config.js'
import { buildManifest, validateEntryFile } from './manifest.js'
import { createSiteTorrent } from './torrent.js'
import { pushToServer, waitForReady } from './server.js'

const FORBIDDEN_EXTENSIONS = new Set([
  '.exe',
  '.msi',
  '.msix',
  '.bat',
  '.cmd',
  '.ps1',
  '.sh',
  '.bash',
  '.dll',
  '.so',
  '.dylib',
  '.deb',
  '.rpm',
  '.app',
  '.dmg',
  '.pkg',
  '.scr',
  '.com',
  '.vbs',
  '.wsf',
  '.hta',
  '.cpl',
])

const ROOT_RELATIVE_RE = /(?:href|src|action|data-src|data-href)\s*=\s*["']\//g

function scanDir(dir: string): { totalSize: number; fileCount: number; warnings: string[] } {
  let totalSize = 0
  let fileCount = 0
  const warnings: string[] = []

  let rootResolved: string
  try {
    rootResolved = fs.realpathSync(path.resolve(dir))
  } catch {
    return { totalSize: 0, fileCount: 0, warnings: [`Directory unreadable: ${dir}`] }
  }

  function walk(p: string): void {
    const entries = fs.readdirSync(p, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name[0] === '.' || entry.name === 'node_modules') continue
      const full = path.join(p, entry.name)
      let realFull: string
      try {
        realFull = fs.realpathSync(full)
      } catch {
        warnings.push(`Unreadable path: ${path.relative(dir, full)}`)
        continue
      }
      const relReal = path.relative(rootResolved, realFull)
      if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
        warnings.push(`Path escapes publish directory: ${path.relative(dir, full)}`)
        continue
      }
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile()) {
        fileCount++
        const size = fs.statSync(full).size
        totalSize += size

        const ext = path.extname(entry.name).toLowerCase()
        if (FORBIDDEN_EXTENSIONS.has(ext)) {
          warnings.push(`Forbidden file type: ${relReal} (${ext})`)
        }

        if (size > 100 * 1024 * 1024) {
          warnings.push(`Large file: ${relReal} (${(size / 1024 / 1024).toFixed(1)} MB)`)
        }

        if (ext === '.html' || ext === '.htm') {
          try {
            const content = fs.readFileSync(full, 'utf-8')
            const matches = content.match(ROOT_RELATIVE_RE)
            if (matches && matches.length > 0) {
              warnings.push(
                `Root-relative paths in ${relReal}: ${matches.length} occurrence(s). Consider using relative paths instead.`
              )
            }
          } catch {
            // skip unreadable files
          }
        }
      }
    }
  }

  walk(rootResolved)
  return { totalSize, fileCount, warnings }
}

export async function publish(cwd: string, opts?: PublishOptions): Promise<PublishResult> {
  const config = await loadConfig(cwd, opts)
  const onProgress = opts?.onProgress

  if (!fs.existsSync(config.publish.dir)) {
    throw new Error(`Directory not found: ${config.publish.dir}`)
  }

  const stat = fs.statSync(config.publish.dir)
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${config.publish.dir}`)
  }

  onProgress?.({ phase: 'scanning' })
  const { totalSize, fileCount, warnings } = scanDir(config.publish.dir)

  if (fileCount > 500) {
    warnings.push(`Large file count: ${fileCount} files. Consider reducing the number of assets.`)
  }

  for (const warning of warnings) {
    onProgress?.({ phase: 'manifest', message: `Warning: ${warning}` })
  }

  onProgress?.({ phase: 'manifest', message: 'Generating zt-manifest.json' })
  const manifest = buildManifest(config, { totalSize, fileCount })

  validateEntryFile(config.publish.dir, manifest)

  const manifestPath = path.join(config.publish.dir, 'zt-manifest.json')
  const manifestJson = JSON.stringify(manifest, null, 2)

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'zt-publish-staging-'))
  fs.cpSync(config.publish.dir, staging, {
    recursive: true,
    dereference: true,
  })
  fs.writeFileSync(path.join(staging, 'zt-manifest.json'), manifestJson, 'utf-8')
  const tearDownTorrentDir = (): void => fs.rmSync(staging, { recursive: true, force: true })

  let torrentBuffer: Uint8Array
  try {
    torrentBuffer = await createSiteTorrent(staging, config, onProgress)
    if (!opts?.dryRun) {
      fs.writeFileSync(manifestPath, manifestJson, 'utf-8')
    }
  } finally {
    tearDownTorrentDir()
  }

  const parsed = parseTorrentSync(torrentBuffer)
  const infoHash = parsed.infoHash ?? parsed.infoHashV2 ?? ''
  if (!infoHash) throw new Error('Failed to parse info hash from created torrent')

  const torrentFiles = parsed.files?.map((f) => f.path) ?? []
  const manifestInTorrent = torrentFiles.some(
    (p) => p === 'zt-manifest.json' || p.endsWith('/zt-manifest.json')
  )
  if (!manifestInTorrent) {
    throw new Error(
      `zt-manifest.json missing from torrent files. Available: ${torrentFiles.slice(0, 10).join(', ')}${torrentFiles.length > 10 ? '...' : ''}`
    )
  }
  const entryName = manifest.routing?.entry ?? 'index.html'
  const entryInTorrent = torrentFiles.some((p) => p === entryName || p.endsWith('/' + entryName))
  if (!entryInTorrent) {
    throw new Error(
      `Entry file "${entryName}" not found in torrent files. Available: ${torrentFiles.slice(0, 10).join(', ')}${torrentFiles.length > 10 ? '...' : ''}`
    )
  }

  if (opts?.dryRun) {
    const result: PublishResult = {
      infoHash,
      torrentPath: '<dry-run>',
      manifest,
      totalSize,
      fileCount,
    }
    onProgress?.({ phase: 'done', result })
    return result
  }

  const outputPath = opts?.output
    ? path.resolve(cwd, opts.output)
    : path.resolve(cwd, `${config.site.name.replace(/[^a-zA-Z0-9._-]/g, '-')}.torrent`)

  onProgress?.({ phase: 'writing', path: outputPath })
  fs.writeFileSync(outputPath, torrentBuffer)

  const result: PublishResult = {
    infoHash,
    torrentPath: outputPath,
    manifest,
    totalSize,
    fileCount,
  }

  if (config.publish.server && config.publish.apiKey) {
    onProgress?.({ phase: 'uploading', message: 'Pushing to seed server...' })
    await pushToServer(config.publish.server, config.publish.apiKey, torrentBuffer, manifest)
    await waitForReady(config.publish.server, config.publish.apiKey, infoHash)
  }

  onProgress?.({ phase: 'done', result })
  return result
}

export { loadConfig } from './config.js'
export { buildManifest, validateEntryFile } from './manifest.js'
export { createSiteTorrent } from './torrent.js'
export { pushToServer, waitForReady } from './server.js'
export type { PublishConfig, PublishOptions, PublishResult, PublishProgress } from './types.js'

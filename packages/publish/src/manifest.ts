import fs from 'fs'
import path from 'path'

import type { ZTManifest } from '@z-torrent/core'
import { createRequire } from 'module'

import type { PublishConfig } from './types.js'

const require = createRequire(import.meta.url)
let publisherVersion = '0.0.1'
try {
  const pkg = require('../package.json')
  publisherVersion = pkg.version
} catch {}

function validateManifest(manifest: ZTManifest): void {
  if (manifest.version !== 1) {
    throw new Error(`Unknown manifest version: ${manifest.version}`)
  }
  if (!manifest.site || typeof manifest.site !== 'object' || !manifest.site.name) {
    throw new Error('Manifest must have a site.name')
  }
  if (!['static', 'spa'].includes(manifest.type)) {
    throw new Error(`Unknown site type: ${manifest.type}`)
  }
}

export function buildManifest(
  config: PublishConfig,
  meta: { totalSize: number; fileCount: number }
): ZTManifest {
  const manifest: ZTManifest = {
    version: 1,
    site: { ...config.site },
    type: config.type,
  }

  if (config.routing) manifest.routing = { ...config.routing }
  if (config.priority) manifest.priority = [...config.priority]
  if (config.framework) manifest.framework = config.framework
  if (config.buildTool) manifest.buildTool = config.buildTool

  manifest._meta = {
    publishedAt: new Date().toISOString(),
    publisherVersion,
    totalSize: meta.totalSize,
    fileCount: meta.fileCount,
  }

  validateManifest(manifest)
  return manifest
}

export function validateEntryFile(dir: string, manifest: ZTManifest): void {
  const entry = manifest.routing?.entry ?? 'index.html'
  let root: string
  try {
    root = fs.realpathSync(path.resolve(dir))
  } catch {
    throw new Error(`Publish directory unreadable: ${dir}`)
  }
  const entryPath = path.resolve(root, entry)
  const rel = path.relative(root, entryPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Entry path escapes publish directory: ${entry}`)
  }
  if (!fs.existsSync(entryPath)) {
    throw new Error(`Entry file not found: ${entryPath}`)
  }
  const st = fs.statSync(entryPath)
  if (!st.isFile()) {
    throw new Error(`Entry must be a file: ${entry}`)
  }
}

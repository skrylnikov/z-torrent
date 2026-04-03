import type { ZTorrent } from '@z-torrent/node'
import Database from 'bun:sqlite'
import type { ApiKeyConfig, ServerConfig } from '../../config.js'
import { parseBytes, parseTTL } from '../../config.js'
import { validateManifest } from '../../schema.js'
import {
  getDeployment,
  insertDeployment,
  deleteDeployment as deleteDeploymentFromDb,
  getStorageUsage,
  getDeploymentCount,
} from '../../storage/db.js'
import { decode, toMagnetURI } from '@z-torrent/parse'
import { rmSync } from 'fs'
import { join } from 'path'

const MAX_MANIFEST_BYTES = 512 * 1024
const MAX_TORRENT_BYTES = 10 * 1024 * 1024

function isUniqueConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /unique|UNIQUE constraint/i.test(msg)
}

export async function handlePublish(
  req: Request,
  client: ZTorrent,
  db: Database,
  apiKey: ApiKeyConfig,
  config: ServerConfig
): Promise<Response> {
  let formData
  try {
    formData = await req.formData()
  } catch {
    return json({ error: 'Invalid request: expected multipart/form-data' }, 422)
  }
  const torrentFile = formData.get('torrent') as File | null
  const manifestStr = formData.get('manifest') as string | null

  if (!torrentFile || !manifestStr) {
    return json({ error: 'Missing torrent or manifest' }, 422)
  }

  if (typeof torrentFile.size === 'number' && torrentFile.size > MAX_TORRENT_BYTES) {
    return json(
      { error: `Torrent file too large (max ${MAX_TORRENT_BYTES} bytes)` },
      413
    )
  }

  const manifestBytes = new TextEncoder().encode(manifestStr).length
  if (manifestBytes > MAX_MANIFEST_BYTES) {
    return json(
      { error: `Manifest too large (max ${MAX_MANIFEST_BYTES} bytes)` },
      413
    )
  }

  const torrentBuf = new Uint8Array(await torrentFile.arrayBuffer())
  let parsed
  try {
    parsed = await decode(torrentBuf)
  } catch {
    return json({ error: 'Invalid torrent file' }, 422)
  }

  if (!parsed.infoHash) {
    return json({ error: 'Torrent file has no info hash' }, 422)
  }

  let manifest
  try {
    manifest = validateManifest(JSON.parse(manifestStr))
  } catch (e: unknown) {
    const hint = e instanceof Error ? e.message : 'Invalid manifest'
    return json({ error: 'Invalid manifest', detail: hint }, 422)
  }

  const files = parsed.files ?? []
  const torrentFileCount = files.length

  const contentValidation = validateTorrentContent(files, manifest)
  if (contentValidation) {
    return json({ error: contentValidation }, 422)
  }

  const size = parsed.length ?? 0
  const maxDeploySize = parseBytes(apiKey.limits.maxDeploySize)
  if (size > maxDeploySize) {
    return json(
      {
        error: `Deployment size ${size} bytes exceeds limit ${maxDeploySize} bytes`,
      },
      413
    )
  }

  const currentUsage = getStorageUsage(db, apiKey.key)
  const maxTotalStorage = parseBytes(apiKey.limits.maxTotalStorage)
  if (currentUsage + size > maxTotalStorage) {
    return json({ error: 'Total storage limit exceeded' }, 403)
  }

  if (apiKey.limits.maxDeployments > 0) {
    const count = getDeploymentCount(db, apiKey.key)
    if (count >= apiKey.limits.maxDeployments) {
      return json({ error: 'Maximum deployment count reached' }, 403)
    }
  }

  const infoHash = parsed.infoHash

  const existing = getDeployment(db, infoHash)
  if (existing) {
    if (existing.api_key !== apiKey.key) {
      return json({ error: 'not_found', infoHash }, 404)
    }
    return json({
      infoHash,
      url: `${config.portalUrl}/${infoHash}`,
      magnetURI: toMagnetURI(parsed),
      status: existing.status,
      size,
      files: torrentFileCount,
    })
  }

  const ttlSeconds = parseTTL(apiKey.limits.ttl)

  try {
    insertDeployment(db, {
      infoHash,
      apiKey: apiKey.key,
      manifest: manifestStr,
      torrent: torrentBuf,
      size,
      fileCount: torrentFileCount,
      ttlSeconds: ttlSeconds === -1 ? null : ttlSeconds,
    })
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err
    const row = getDeployment(db, infoHash)
    if (!row || row.api_key !== apiKey.key) {
      return json({ error: 'not_found', infoHash }, 404)
    }
    return json({
      infoHash,
      url: `${config.portalUrl}/${infoHash}`,
      magnetURI: toMagnetURI(parsed),
      status: row.status,
      size,
      files: torrentFileCount,
    })
  }

  const downloadPath = join(config.downloadPath, infoHash)
  client.add(torrentBuf, { path: downloadPath, announce: config.trackers }, (torrent) => {
    torrent.on('done', () => {
      db.run("UPDATE deployments SET status = 'seeding' WHERE info_hash = ?", [infoHash])
    })

    let lastAccessUpdate = 0
    torrent.on('upload', () => {
      const now = Date.now()
      if (now - lastAccessUpdate < 60_000) return
      lastAccessUpdate = now
      db.run('UPDATE deployments SET last_accessed_at = ?, uploaded = ? WHERE info_hash = ?', [
        new Date().toISOString(),
        torrent.uploaded,
        infoHash,
      ])
    })
  })

  const expiresAt = ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null

  return json({
    infoHash,
    url: `${config.portalUrl}/${infoHash}`,
    magnetURI: toMagnetURI(parsed),
    status: 'downloading',
    size,
    files: torrentFileCount,
    expiresAt,
  })
}

export async function handleDelete(
  infoHash: string,
  client: ZTorrent,
  db: Database,
  apiKey: ApiKeyConfig,
  downloadPath: string
): Promise<Response> {
  const dep = getDeployment(db, infoHash)
  if (!dep || dep.api_key !== apiKey.key) {
    return json({ error: 'not_found', infoHash }, 404)
  }

  try {
    await client.remove(infoHash)
  } catch {
    // torrent may already be removed
  }

  try {
    rmSync(join(downloadPath, infoHash), { recursive: true, force: true })
  } catch {
    // files may not exist
  }

  deleteDeploymentFromDb(db, infoHash)

  return json({ deleted: true, expired: false, infoHash })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface TorrentFile {
  path: string
  length: number
}

function validateTorrentContent(
  files: TorrentFile[],
  manifest: { routing?: { entry?: string } }
): string | null {
  for (const file of files) {
    if (file.path.includes('..')) {
      return `Path traversal detected in torrent: ${file.path}`
    }
    if (file.length > 100 * 1024 * 1024) {
      return `File too large: ${file.path} (${(file.length / 1024 / 1024).toFixed(1)} MB, max 100 MB)`
    }
  }

  const entryName = manifest.routing?.entry ?? 'index.html'
  const entryExists = files.some((f) => f.path === entryName || f.path.endsWith('/' + entryName))
  if (!entryExists) {
    return `Entry file "${entryName}" not found in torrent`
  }

  return null
}

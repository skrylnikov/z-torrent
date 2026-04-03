import type { ZTorrent } from '@z-torrent/node'
import type { ApiKeyConfig } from '../../config.js'
import type { ZTManifest } from '../../schema.js'
import type { DeploymentRow } from '../../storage/db.js'
import { getDeployment } from '../../storage/db.js'

export function handleStatus(
  infoHash: string,
  client: ZTorrent,
  db: { query: (sql: string) => { get: (...args: any[]) => DeploymentRow | null } },
  apiKey: ApiKeyConfig,
  portalUrl: string
): Response {
  const torrent = client.torrents.find((t) => t.infoHash === infoHash)

  if (!torrent) {
    const dep = getDeployment(db as any, infoHash)
    if (!dep || dep.api_key !== apiKey.key) {
      return json({ error: 'not_found', infoHash }, 404)
    }
    return json({
      infoHash,
      status: dep.status,
      ready: false,
      progress: 0,
      peers: 0,
      uploaded: dep.uploaded,
      downloaded: dep.downloaded,
      ratio: 0,
      createdAt: dep.created_at,
      lastAccessedAt: dep.last_accessed_at,
      expiresAt: dep.ttl_seconds
        ? new Date(new Date(dep.last_accessed_at).getTime() + dep.ttl_seconds * 1000).toISOString()
        : null,
    })
  }

  const dep = getDeployment(db as any, infoHash)
  if (!dep || dep.api_key !== apiKey.key) {
    return json({ error: 'not_found', infoHash }, 404)
  }

  let manifest: ZTManifest | null = null
  try {
    manifest = JSON.parse(dep.manifest)
  } catch {
    // ignore
  }

  const status = torrent.done ? 'seeding' : torrent.destroyed ? 'expired' : 'downloading'

  return json({
    infoHash: torrent.infoHash,
    status,
    ready: torrent.ready,
    progress: torrent.progress,
    peers: torrent.wires.length,
    uploaded: torrent.uploaded,
    downloaded: torrent.downloaded,
    ratio: torrent.ratio,
    createdAt: dep.created_at,
    lastAccessedAt: dep.last_accessed_at,
    expiresAt: dep.ttl_seconds
      ? new Date(new Date(dep.last_accessed_at).getTime() + dep.ttl_seconds * 1000).toISOString()
      : null,
    manifest: manifest ? { site: manifest.site, type: manifest.type } : undefined,
  })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

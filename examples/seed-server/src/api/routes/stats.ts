import type { ZTorrent } from '@z-torrent/node'
import type { ApiKeyConfig } from '../../config.js'
import type { DeploymentRow } from '../../storage/db.js'
import { getDeploymentsByKey, getStorageUsage, getDeploymentCount } from '../../storage/db.js'
import { parseBytes } from '../../config.js'

export function handleStats(client: ZTorrent, db: any, apiKey: ApiKeyConfig): Response {
  const deployments = getDeploymentsByKey(db, apiKey.key)
  const totalSize = getStorageUsage(db, apiKey.key)
  const count = getDeploymentCount(db, apiKey.key)

  let totalUploaded = 0
  let totalDownloaded = 0
  let totalPeers = 0

  const deploymentSummaries = !apiKey.public
    ? deployments.map((dep: DeploymentRow) => {
        const torrent = client.torrents.find((t) => t.infoHash === dep.info_hash)
        const status = torrent ? (torrent.done ? 'seeding' : 'downloading') : dep.status
        const peers = torrent?.wires.length ?? 0
        const uploaded = torrent?.uploaded ?? dep.uploaded
        const downloaded = torrent?.downloaded ?? dep.downloaded
        const ratio = downloaded > 0 ? uploaded / downloaded : 0

        totalUploaded += uploaded
        totalDownloaded += downloaded
        totalPeers += peers

        let siteName: string | undefined
        try {
          const manifest = JSON.parse(dep.manifest)
          siteName = manifest.site?.name
        } catch {
          // ignore
        }

        return {
          infoHash: dep.info_hash,
          name: siteName,
          size: dep.size,
          status,
          peers,
          uploaded,
          ratio,
          createdAt: dep.created_at,
          lastAccessedAt: dep.last_accessed_at,
          expiresAt: dep.ttl_seconds
            ? new Date(
                new Date(dep.last_accessed_at).getTime() + dep.ttl_seconds * 1000
              ).toISOString()
            : null,
        }
      })
    : undefined

  if (apiKey.public) {
    for (const dep of deployments) {
      const torrent = client.torrents.find((t) => t.infoHash === dep.info_hash)
      totalPeers += torrent?.wires.length ?? 0
      totalUploaded += torrent?.uploaded ?? dep.uploaded
      totalDownloaded += torrent?.downloaded ?? dep.downloaded
    }
  }

  return json({
    key: {
      name: apiKey.name,
      public: apiKey.public,
    },
    usage: {
      deployments: count,
      totalSize,
      limits: {
        maxDeployments: apiKey.limits.maxDeployments,
        maxTotalStorage: parseBytes(apiKey.limits.maxTotalStorage),
        maxDeploySize: parseBytes(apiKey.limits.maxDeploySize),
      },
    },
    ...(apiKey.public ? {} : { deployments: deploymentSummaries }),
    totals: {
      uploaded: totalUploaded,
      downloaded: totalDownloaded,
      peers: totalPeers,
    },
  })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

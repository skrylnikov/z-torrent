import type { ZTorrent } from '@z-torrent/node'
import Database from 'bun:sqlite'
import type { DeploymentRow } from './db.js'
import { purgeExpiredDeployments } from './db.js'
import { rmSync } from 'fs'
import { join } from 'path'

export async function cleanupExpired(
  client: ZTorrent,
  db: Database,
  downloadPath: string
): Promise<void> {
  const now = new Date()

  const expired = db
    .query(
      `
      SELECT info_hash, ttl_seconds, last_accessed_at
      FROM deployments
      WHERE status IN ('seeding', 'downloading')
        AND ttl_seconds IS NOT NULL
    `
    )
    .all() as DeploymentRow[]

  for (const row of expired) {
    const lastAccess = new Date(row.last_accessed_at)
    const expiresAt = new Date(lastAccess.getTime() + (row.ttl_seconds ?? 0) * 1000)

    if (now > expiresAt) {
      console.log(`[cleanup] Expiring ${row.info_hash}`)

      try {
        await client.remove(row.info_hash)
      } catch {
        // torrent may already be removed
      }

      db.run("UPDATE deployments SET status = 'expired' WHERE info_hash = ?", [row.info_hash])

      try {
        rmSync(join(downloadPath, row.info_hash), { recursive: true, force: true })
      } catch {
        // files may not exist
      }
    }
  }

  const purged = purgeExpiredDeployments(db, 7)
  if (purged > 0) {
    console.log(`[cleanup] Purged ${purged} expired deployment(s) from database`)
  }
}

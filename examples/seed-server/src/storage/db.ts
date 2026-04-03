import Database from 'bun:sqlite'

export interface DeploymentRow {
  info_hash: string
  api_key: string
  manifest: string
  torrent: Uint8Array
  size: number
  file_count: number
  status: string
  created_at: string
  last_accessed_at: string
  ttl_seconds: number | null
  uploaded: number
  downloaded: number
}

export function initDatabase(dbPath: string): Database {
  const db = new Database(dbPath, { create: true })
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS deployments (
      info_hash TEXT PRIMARY KEY,
      api_key TEXT NOT NULL,
      manifest TEXT NOT NULL,
      torrent BLOB NOT NULL,
      size INTEGER NOT NULL,
      file_count INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'downloading',
      created_at TEXT NOT NULL,
      last_accessed_at TEXT NOT NULL,
      ttl_seconds INTEGER,
      uploaded INTEGER DEFAULT 0,
      downloaded INTEGER DEFAULT 0
    )
  `)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_deployments_api_key ON deployments(api_key)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status)`)
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_deployments_last_accessed ON deployments(last_accessed_at)`
  )

  return db
}

export function getDeployment(db: Database, infoHash: string): DeploymentRow | null {
  return db
    .query('SELECT * FROM deployments WHERE info_hash = ?')
    .get(infoHash) as DeploymentRow | null
}

export function getActiveDeployments(db: Database): DeploymentRow[] {
  return db
    .query("SELECT * FROM deployments WHERE status IN ('seeding', 'downloading')")
    .all() as DeploymentRow[]
}

export function getDeploymentsByKey(db: Database, apiKey: string): DeploymentRow[] {
  return db
    .query("SELECT * FROM deployments WHERE api_key = ? AND status != 'expired'")
    .all() as DeploymentRow[]
}

export function insertDeployment(
  db: Database,
  opts: {
    infoHash: string
    apiKey: string
    manifest: string
    torrent: Uint8Array
    size: number
    fileCount: number
    ttlSeconds: number | null
  }
): void {
  const now = new Date().toISOString()
  db.run(
    `INSERT INTO deployments
     (info_hash, api_key, manifest, torrent, size, file_count, status, created_at, last_accessed_at, ttl_seconds)
     VALUES (?, ?, ?, ?, ?, ?, 'downloading', ?, ?, ?)`,
    [
      opts.infoHash,
      opts.apiKey,
      opts.manifest,
      opts.torrent,
      opts.size,
      opts.fileCount,
      now,
      now,
      opts.ttlSeconds,
    ]
  )
}

export function updateDeploymentStatus(db: Database, infoHash: string, status: string): void {
  db.run('UPDATE deployments SET status = ? WHERE info_hash = ?', [status, infoHash])
}

export function updateDeploymentAccess(db: Database, infoHash: string, uploaded: number): void {
  db.run('UPDATE deployments SET last_accessed_at = ?, uploaded = ? WHERE info_hash = ?', [
    new Date().toISOString(),
    uploaded,
    infoHash,
  ])
}

export function deleteDeployment(db: Database, infoHash: string): void {
  db.run('UPDATE deployments SET status = ? WHERE info_hash = ?', ['expired', infoHash])
}

export function getStorageUsage(db: Database, apiKey: string): number {
  const row = db
    .query(
      `SELECT COALESCE(SUM(size), 0) as total FROM deployments
       WHERE api_key = ? AND status != 'expired'`
    )
    .get(apiKey) as { total: number } | null
  return row?.total ?? 0
}

export function getDeploymentCount(db: Database, apiKey: string): number {
  const row = db
    .query(
      `SELECT COUNT(*) as count FROM deployments
       WHERE api_key = ? AND status != 'expired'`
    )
    .get(apiKey) as { count: number } | null
  return row?.count ?? 0
}

export function getTotalStorage(db: Database): number {
  const row = db
    .query(`SELECT COALESCE(SUM(size), 0) as total FROM deployments WHERE status != 'expired'`)
    .get() as { total: number } | null
  return row?.total ?? 0
}

export function purgeExpiredDeployments(db: Database, olderThanDays: number = 7): number {
  const result = db.run(
    `DELETE FROM deployments
     WHERE status = 'expired'
       AND last_accessed_at < datetime('now', '-' || ? || ' days')`,
    [olderThanDays]
  )
  return result.changes
}

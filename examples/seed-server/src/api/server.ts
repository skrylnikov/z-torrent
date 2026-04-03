import type { ZTorrent } from '@z-torrent/node'
import Database from 'bun:sqlite'
import type { ApiKeyConfig, ServerConfig } from '../config.js'
import { authenticateRequest } from './middleware/auth.js'
import { isRateLimited } from './middleware/rate-limit.js'
import { handleHealthMinimal, handleHealthDetailed } from './routes/health.js'
import { handleStatus } from './routes/status.js'
import { handleStats } from './routes/stats.js'
import { handlePublish, handleDelete } from './routes/publish.js'

const INFO_HASH_SEGMENT = '(?:[a-f0-9]{40}|[a-f0-9]{64})'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export function createApiServer(
  client: ZTorrent,
  db: Database,
  config: ServerConfig
): Bun.Server<any> {
  return Bun.serve({
    port: config.apiPort,
    async fetch(req: Request): Promise<Response> {
      try {
        const url = new URL(req.url)
        const path = url.pathname

        if (req.method === 'OPTIONS') {
          return new Response(null, { status: 204, headers: CORS_HEADERS })
        }

        if (path === '/api/health' && req.method === 'GET') {
          return handleHealthMinimal()
        }

        if (config.apiKeys.length === 0) {
          return json({ error: 'API not configured — set API_KEYS env var' }, 503)
        }

        const key: ApiKeyConfig | null = authenticateRequest(req, config.apiKeys)
        if (!key) {
          return json({ error: 'Unauthorized' }, 401)
        }

        if (isRateLimited(key)) {
          return json({ error: 'Rate limit exceeded' }, 429)
        }

        if (path === '/api/health/detailed' && req.method === 'GET') {
          return handleHealthDetailed(client, db, config.maxTotalStorage)
        }

        if (path === '/api/publish' && req.method === 'POST') {
          return handlePublish(req, client, db, key, config)
        }

        const statusMatch = path.match(
          new RegExp(`^/api/status/(${INFO_HASH_SEGMENT})$`, 'i')
        )
        if (statusMatch && req.method === 'GET') {
          return handleStatus(statusMatch[1], client, db, key, config.portalUrl)
        }

        if (path === '/api/stats' && req.method === 'GET') {
          return handleStats(client, db, key)
        }

        const deleteMatch = path.match(
          new RegExp(`^/api/deployments/(${INFO_HASH_SEGMENT})$`, 'i')
        )
        if (deleteMatch && req.method === 'DELETE') {
          return handleDelete(deleteMatch[1], client, db, key, config.downloadPath)
        }

        return json({ error: 'Not found' }, 404)
      } catch (err) {
        console.error('[api] Unhandled error:', err)
        return json({ error: 'Internal server error' }, 500)
      }
    },
  })
}

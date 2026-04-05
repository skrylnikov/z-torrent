export interface LimitsConfig {
  maxDeploySize: string
  maxTotalStorage: string
  maxDeployments: number
  ttl: string
  rateLimit: string
}

export interface ApiKeyConfig {
  key: string
  name: string
  public: boolean
  limits: LimitsConfig
}

export interface ServerConfig {
  magnets: string[]
  trackers: string[]
  downloadPath: string
  stunUrl: string
  turnUrl: string
  turnUsername: string
  turnCredential: string
  apiPort: number
  apiKeys: ApiKeyConfig[]
  dbPath: string
  maxTotalStorage: number
  defaultTtl: number
  cleanupInterval: number
  portalUrl: string
}

const DEFAULT_WSS_TRACKERS = [
  'wss://tracker.btorrent.xyz',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
]

function parseList(value: string | undefined): string[] {
  if (!value || typeof value !== 'string') return []
  return value
    .split(/[,\n]/)
    .map((s) =>
      s
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\\"/g, '"')
    )
    .filter(Boolean)
}

export function parseBytes(value: string): number {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i)
  if (!match) throw new Error(`Invalid byte size: ${value}`)
  const num = parseFloat(match[1])
  const unit = (match[2] || 'B').toUpperCase()
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  }
  return Math.floor(num * (multipliers[unit] || 1))
}

export function parseTTL(value: string): number {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'infinite') return -1
  const match = trimmed.match(/^(\d+)\s*(min|h|d|w)?$/)
  if (!match) throw new Error(`Invalid TTL: ${value}`)
  const num = parseInt(match[1], 10)
  const unit = match[2] || 'd'
  const multipliers: Record<string, number> = { min: 60, h: 3600, d: 86400, w: 604800 }
  return num * (multipliers[unit] || 86400)
}

export function parseDuration(value: string): number {
  const match = value.trim().match(/^(\d+)\s*(min|h|d|w)?$/)
  if (!match) throw new Error(`Invalid duration: ${value}`)
  const num = parseInt(match[1], 10)
  const unit = match[2] || 'h'
  const multipliers: Record<string, number> = { min: 60000, h: 3600000, d: 86400000, w: 604800000 }
  return num * (multipliers[unit] || 3600000)
}

const RATE_LIMIT_RE = /^(\d+)\s*\/\s*(min|h|d)$/i

function parseApiKeys(value: string | undefined): ApiKeyConfig[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) throw new Error('API_KEYS must be a JSON array')
    for (const key of parsed) {
      if (!key.key || !key.name) {
        throw new Error('Each API key must have "key" and "name" fields')
      }
      if (!key.limits) {
        throw new Error(`API key "${key.name}" missing "limits"`)
      }
      const requiredLimits = [
        'maxDeploySize',
        'maxTotalStorage',
        'maxDeployments',
        'ttl',
        'rateLimit',
      ]
      for (const field of requiredLimits) {
        if (!(field in key.limits)) {
          throw new Error(`API key "${key.name}" limits missing "${field}"`)
        }
      }
      const rl = String(key.limits.rateLimit).trim()
      if (!RATE_LIMIT_RE.test(rl)) {
        throw new Error(
          `API key "${key.name}" has invalid rateLimit "${key.limits.rateLimit}" (use e.g. "60 / min", "100 / h", "500 / d")`
        )
      }
    }
    return parsed as ApiKeyConfig[]
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`API_KEYS is not valid JSON: ${e.message}`)
    }
    throw e
  }
}

export function loadConfig(): ServerConfig {
  const magnets = parseList(process.env.TORRENT_MAGNETS)
  let trackers = parseList(process.env.TORRENT_TRACKERS)
  if (trackers.length === 0) {
    trackers = DEFAULT_WSS_TRACKERS
  }
  const apiKeys = parseApiKeys(process.env.API_KEYS)

  const cleanupInterval = process.env.CLEANUP_INTERVAL
    ? parseDuration(process.env.CLEANUP_INTERVAL)
    : 3600000

  return {
    magnets,
    trackers,
    downloadPath: process.env.TORRENT_DOWNLOAD_PATH || './downloads',
    stunUrl: process.env.STUN_URL || 'stun:turn.z-torrent.xyz:3478',
    turnUrl: process.env.TURN_URL || 'turn:turn.z-torrent.xyz:3478',
    turnUsername: process.env.TURN_USERNAME || 'z-torrent',
    turnCredential: process.env.TURN_CREDENTIAL || '',
    apiPort: process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3000,
    apiKeys,
    dbPath: process.env.DB_PATH || './data/deployments.db',
    maxTotalStorage: process.env.MAX_TOTAL_STORAGE
      ? parseBytes(process.env.MAX_TOTAL_STORAGE)
      : 10 * 1024 ** 3,
    defaultTtl: process.env.DEFAULT_TTL ? parseTTL(process.env.DEFAULT_TTL) : 14 * 86400,
    cleanupInterval,
    portalUrl: process.env.PORTAL_URL || 'https://z-torrent.xyz',
  }
}

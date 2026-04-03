import type { ApiKeyConfig } from '../../config.js'

interface RateLimitEntry {
  timestamps: number[]
  limit: number
  windowMs: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

function parseRateLimit(value: string): { limit: number; windowMs: number } {
  const match = value.trim().match(/^(\d+)\s*\/\s*(min|h|d)$/i)
  if (!match) {
    throw new Error(`Invalid rateLimit: "${value}" (expected e.g. "10 / min")`)
  }
  const limit = parseInt(match[1], 10)
  const unit = match[2].toLowerCase()
  const windowMs = unit === 'min' ? 60000 : unit === 'h' ? 3600000 : 86400000
  return { limit, windowMs }
}

export function isRateLimited(key: ApiKeyConfig): boolean {
  const { limit, windowMs } = parseRateLimit(key.limits.rateLimit)
  const now = Date.now()
  const windowStart = now - windowMs

  let entry = rateLimitMap.get(key.key)
  if (!entry) {
    entry = { timestamps: [], limit, windowMs }
    rateLimitMap.set(key.key, entry)
  }

  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart)
  entry.limit = limit
  entry.windowMs = windowMs

  if (entry.timestamps.length >= entry.limit) {
    return true
  }

  entry.timestamps.push(now)
  return false
}

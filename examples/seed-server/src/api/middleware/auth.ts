import type { ApiKeyConfig } from '../../config.js'

export function authenticateRequest(req: Request, apiKeys: ApiKeyConfig[]): ApiKeyConfig | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  const token = match[1].trim()
  return apiKeys.find((k) => k.key === token) ?? null
}

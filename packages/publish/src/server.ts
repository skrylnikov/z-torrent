import type { ZTManifest } from '@z-torrent/core'

export interface PublishResponse {
  infoHash: string
  url: string
  magnetURI: string
  status: string
  size: number
  files: number
  expiresAt?: string
}

export interface StatusResponse {
  infoHash: string
  status: string
  ready: boolean
  progress: number
  peers: number
  uploaded: number
  downloaded: number
  ratio: number
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000
const POLL_INTERVAL = 2000

export async function pushToServer(
  serverUrl: string,
  apiKey: string,
  torrentBuffer: Uint8Array,
  manifest: ZTManifest
): Promise<PublishResponse> {
  const formData = new FormData()
  formData.append('torrent', new Blob([torrentBuffer]), 'site.torrent')
  formData.append('manifest', JSON.stringify(manifest))

  const res = await fetch(`${serverUrl}/api/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Publish failed (${res.status}): ${body}`)
  }

  return res.json() as Promise<PublishResponse>
}

export async function waitForReady(
  serverUrl: string,
  apiKey: string,
  infoHash: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<StatusResponse> {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${serverUrl}/api/status/${infoHash}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Resource not found: ${infoHash}`)
        }
        const remaining = Math.ceil((deadline - Date.now()) / 1000)
        await new Promise((r) => setTimeout(r, Math.min(POLL_INTERVAL, remaining * 1000)))
        continue
      }

      const status = (await res.json()) as StatusResponse
      if (status.ready) return status
    } catch (err: any) {
      if (Date.now() >= deadline) break
      await new Promise((r) => setTimeout(r, POLL_INTERVAL))
      continue
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL))
  }

  throw new Error(`Timeout waiting for seed server to start seeding ${infoHash}`)
}

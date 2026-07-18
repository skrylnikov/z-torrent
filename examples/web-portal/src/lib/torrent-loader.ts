import type { ZTManifest } from './manifest.js'
import { parseManifest } from './manifest-parser.js'

export interface TorrentState {
  phase: 'connecting' | 'metadata' | 'downloading' | 'ready' | 'seeding' | 'error'
  progress: number
  downloadSpeed: number
  uploadSpeed: number
  peerCount: number
  downloaded: number
  totalSize: number
  timeRemaining: number
  manifest: ZTManifest | null
  error: string | null
  siteName: string
}

export interface LoadOptions {
  signal?: AbortSignal
  onProgress?: (state: TorrentState) => void
  maxRetries?: number
}

export const INITIAL_STATE: TorrentState = {
  phase: 'connecting',
  progress: 0,
  downloadSpeed: 0,
  uploadSpeed: 0,
  peerCount: 0,
  downloaded: 0,
  totalSize: 0,
  timeRemaining: 0,
  manifest: null,
  error: null,
  siteName: '',
}

type ZTorrentClient = {
  add: (input: string, opts?: any, cb?: (t: any) => void) => any
  get: (infoHash: string) => Promise<any | null>
  remove: (infoHash: string) => Promise<void>
  createServer: (opts: { controller: unknown; hostingMode?: boolean }) => unknown
}

type ZTorrentModule = {
  ZTorrent: new (opts: Record<string, unknown>) => ZTorrentClient
}

let clientPromise: Promise<ZTorrentClient> | null = null

export async function getClient(): Promise<ZTorrentClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const [{ ZTorrent }, reg] = await Promise.all([
        import('@z-torrent/browser') as Promise<ZTorrentModule>,
        navigator.serviceWorker
          .register('/sw.min.js', { scope: '/' })
          .then(() => navigator.serviceWorker.ready),
      ])

      const announce = [
        'wss://tracker.z-torrent.xyz',
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.webtorrent.dev',
      ]

      const devTracker = import.meta.env.VITE_DEV_TRACKER
      if (devTracker) announce.unshift(devTracker)

      const iceServers: RTCIceServer[] = [
        { urls: ['stun:turn.z-torrent.xyz:3478'] },
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: ['stun:stun.cloudflare.com:3478'] },
      ]

      const turnUrl = import.meta.env.VITE_TURN_URL
      const turnUsername = import.meta.env.VITE_TURN_USERNAME
      const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL
      if (turnUrl && turnUsername && turnCredential) {
        iceServers.push({ urls: [turnUrl], username: turnUsername, credential: turnCredential })
      }

      const mobileOpts = getMobileOptions()

      const client = new ZTorrent({
        maxConns: mobileOpts.maxConns,
        tracker: {
          announce,
          rtcConfig: {
            iceServers,
            bundlePolicy: 'max-bundle' as RTCBundlePolicy,
          },
        },
      })

      client.createServer({ controller: reg, hostingMode: true })

      return client
    })()
  }
  return clientPromise
}

function makeState(partial: Partial<TorrentState>): TorrentState {
  return { ...INITIAL_STATE, ...partial }
}

export async function loadTorrent(infoHash: string, opts: LoadOptions = {}): Promise<any> {
  const maxRetries = opts.maxRetries ?? 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 8000)
      opts.onProgress?.(
        makeState({
          phase: 'connecting',
          error: `Retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})...`,
        })
      )
      await sleep(delay)
    }

    try {
      const result = await loadTorrentOnce(infoHash, opts, attempt === 0 ? 60000 : 30000)
      return result
    } catch (err: any) {
      lastError = err
      if (err.message === 'Aborted') throw err
      if (attempt === maxRetries) break
    }
  }

  throw lastError ?? new Error('Failed after retries')
}

const CONNECT_TIMEOUT_MS = 60000

async function loadTorrentOnce(
  infoHash: string,
  opts: LoadOptions,
  connectTimeout: number
): Promise<any> {
  const client = await getClient()

  const existing = await client.get(infoHash)
  if (existing) return existing

  if (opts.signal?.aborted) {
    throw new Error('Aborted')
  }

  const magnet = `magnet:?xt=urn:btih:${infoHash}`

  return new Promise((resolve, reject) => {
    let connectTimer: ReturnType<typeof setTimeout> | null = null

    const onAbort = () => {
      if (connectTimer) clearTimeout(connectTimer)
      reject(new Error('Aborted'))
    }

    opts.signal?.addEventListener('abort', onAbort, { once: true })

    opts.onProgress?.(makeState({ phase: 'connecting' }))

    connectTimer = setTimeout(() => {
      opts.signal?.removeEventListener('abort', onAbort)
      void client.remove(infoHash).catch(() => {})
      reject(new Error(`Connection timeout: no peers found in ${connectTimeout / 1000}s`))
    }, connectTimeout)

    const torrent = client.add(magnet, {}, async (t: any) => {
      if (connectTimer) {
        clearTimeout(connectTimer)
        connectTimer = null
      }

      opts.onProgress?.(makeState({ phase: 'metadata' }))

      // CRITICAL: Do NOT await parseManifest here — it calls blob()/arrayBuffer()
      // which uses FileIterator that blocks on the 'verified' event for each piece.
      // But 'verified' only fires AFTER #onWireWithMetadata runs, which hasn't
      // executed yet because this callback is still running. This creates a deadlock.
      // Instead, parse manifest in the background and select files immediately.
      let manifest: ZTManifest | null = null
      let siteName = t.name ?? 'Z-Torrent Site'

      // Parse manifest non-blocking — fire and resolve later
      const manifestPromise = parseManifest(t).then((m) => {
        manifest = m
        siteName = m?.site?.name ?? t.name ?? 'Z-Torrent Site'

        // Re-prioritize files based on manifest (now that data is flowing)
        if (m?.priority?.length) {
          for (const file of t.files) {
            const name = file.name as string
            for (const pattern of m.priority) {
              if (matchGlob(name, pattern)) {
                file.select(5)
                break
              }
            }
          }
        }

        return m
      })

      // Select files immediately without waiting for manifest
      const manifestFile = t.files.find((f: any) => f.name === 'zt-manifest.json')
      if (manifestFile) manifestFile.select(7)

      // Default entry file
      const entryFile = t.files.find(
        (f: any) => f.name === 'index.html' || f.path.endsWith('/index.html')
      )
      if (entryFile) entryFile.select(6)

      // Select CSS/JS as priority (fallback when no manifest yet)
      const priorityFiles: any[] = []
      for (const file of t.files) {
        const name = file.name as string
        if (/\.(css|js|mjs)$/i.test(name) && file !== entryFile && file !== manifestFile) {
          file.select(5)
          priorityFiles.push(file)
        }
      }

      opts.onProgress?.(
        makeState({
          phase: 'downloading',
          manifest: null,
          siteName,
          totalSize: t.length,
        })
      )

      let resolved = false
      let updateInterval: ReturnType<typeof setInterval> | null = null

      // Start periodic progress tracking
      updateInterval = setInterval(() => {
        if (resolved) return
        opts.onProgress?.(
          makeState({
            phase: 'downloading',
            manifest,
            siteName,
            downloadSpeed: t.downloadSpeed,
            uploadSpeed: t.uploadSpeed,
            peerCount: t.numPeers,
            downloaded: t.downloaded,
            totalSize: t.length,
            timeRemaining: t.timeRemaining,
          })
        )
      }, 500)

      const finish = () => {
        if (resolved) return
        resolved = true
        if (updateInterval) clearInterval(updateInterval)
        opts.signal?.removeEventListener('abort', onAbort)
        resolve(t)
      }

      t.on('done', finish)

      const criticalFiles = entryFile ? [entryFile, ...priorityFiles] : [...priorityFiles]
      if (criticalFiles.length > 0) {
        t.on('download', () => {
          if (criticalFiles.every((f: any) => f.done) && !resolved) {
            finish()
          }
        })
      }

      if (t.done && !resolved) finish()

      // Let manifest parsing continue in the background — it will resolve
      // once pieces start flowing (which now happens because we returned
      // control from this callback, allowing #onWireWithMetadata to run).
      manifestPromise.catch(() => {
        // manifest parsing failed — non-fatal, we already have file selection
      })
    })

    torrent?.on?.('error', (err: Error) => {
      reject(err)
    })
  })
}

function matchGlob(name: string, pattern: string): boolean {
  const filename = name.split('/').pop() ?? name
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1)
    return filename.endsWith(ext)
  }
  if (pattern === '*') return true
  if (pattern.startsWith('*/')) {
    const prefix = pattern.slice(2)
    return filename.startsWith(prefix) || name.includes(prefix)
  }
  return filename === pattern
}

interface NetworkInfo {
  effectiveType?: string
  saveData?: boolean
  type?: string
}

function getMobileOptions(): { maxConns: number } {
  const nav = navigator as Navigator & { connection?: NetworkInfo }
  const conn = nav.connection
  if (!conn) return { maxConns: 15 }

  if (conn.saveData) return { maxConns: 4 }
  if (conn.effectiveType === '2g') return { maxConns: 3 }
  if (conn.effectiveType === '3g') return { maxConns: 6 }
  if (conn.effectiveType === 'slow-2g') return { maxConns: 2 }

  if (conn.type === 'cellular') return { maxConns: 8 }

  return { maxConns: 15 }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

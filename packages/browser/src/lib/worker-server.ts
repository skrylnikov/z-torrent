import { normalizeSwResponseContentType } from '@z-torrent/utils/streaming-mime'

const DOCUMENT_TIMEOUT = 15000
const ASSET_TIMEOUT = 30000
// Cache version — BUMP this when changing SW caching logic, response handling,
// or any behavior that cached responses depend on. Old caches are cleaned on activate.
// Bump when changing SW behavior so old caches are discarded on activate.
const CACHE_VERSION = 8
const CACHE_NAME = `z-torrent-v${CACHE_VERSION}`
/** Window clients with an active cancel/keepalive fetch (tab owns z-torrent). */
const activeClients = new Set<string>()

const sw = self as unknown as ServiceWorkerGlobalScope

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
      )
  )
})

export function handleFetch(event: FetchEvent): Response | Promise<Response> | null {
  let { url } = event.request
  const scope = sw.registration.scope

  if (!url.includes(scope + 'z-torrent/')) {
    const rewritten = rewriteRootRelativePath(event.request)
    if (!rewritten) return null
    url = rewritten
  }

  if (url.includes(scope + 'z-torrent/keepalive/')) {
    return new Response()
  }
  if (url.includes(scope + 'z-torrent/cancel/')) {
    const clientId = event.clientId
    activeClients.add(clientId)
    return new Response(
      new ReadableStream({
        cancel() {
          activeClients.delete(clientId)
        },
      })
    )
  }

  return serveFromCache(event, url).catch((err) => {
    console.warn(
      '[z-torrent SW] 503 "Service unavailable" — serveFromCache rejected:',
      err?.message || err,
      'url=',
      url
    )
    return new Response('Service unavailable', { status: 503 })
  })
}

const CLIENT_RETRY_DELAY = 50
const CLIENT_RETRY_ATTEMPTS = 10

const ZT_HASH_RE = /\/z-torrent\/([a-f0-9]{40}(?:[a-f0-9]{24})?)\//i

function zTorrentPathPrefix(scopeUrl: URL): string {
  let base = scopeUrl.pathname
  if (!base.endsWith('/')) base += '/'
  return `${base}z-torrent/`
}

function rewriteRootRelativePath(request: Request): string | null {
  const referrer = request.referrer
  if (!referrer) return null

  const match = referrer.match(ZT_HASH_RE)
  if (!match) return null

  const hash = match[1]
  const scope = sw.registration.scope

  try {
    const reqUrl = new URL(request.url)
    const scopeUrl = new URL(scope)
    if (reqUrl.origin !== scopeUrl.origin) return null
    if (!reqUrl.pathname.startsWith('/')) return null

    const ztPrefix = zTorrentPathPrefix(scopeUrl)
    if (reqUrl.pathname.startsWith(ztPrefix)) return null

    const newPath = `${scope}z-torrent/${hash}${reqUrl.pathname}`
    return new URL(newPath, request.url).href
  } catch {
    return null
  }
}

async function serveFromCache(event: FetchEvent, url?: string): Promise<Response> {
  const requestUrl = url ?? event.request.url
  const cacheKey = new Request(requestUrl, { method: 'GET' })
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  const response = await serve(event, requestUrl)

  if (response.status >= 200 && response.status < 300 && response.status !== 206) {
    const ct = response.headers.get('Content-Type') ?? ''
    const isStream = ct.includes('text/html') && response.body !== null
    if (!isStream) {
      const cloned = response.clone()
      event.waitUntil(cache.put(cacheKey, cloned))
    }
  }

  return response
}

async function serve(event: FetchEvent, url?: string): Promise<Response> {
  const { request } = event
  const { method, destination } = request
  const requestUrl = url ?? event.request.url

  let clientlist = await sw.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })

  if (clientlist.length === 0) {
    for (let i = 0; i < CLIENT_RETRY_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, CLIENT_RETRY_DELAY))
      clientlist = await sw.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      if (clientlist.length > 0) break
    }
  }

  if (clientlist.length === 0) {
    console.warn(
      '[z-torrent SW] 503 "No clients" — clientlist empty after retries, url=',
      requestUrl
    )
    return new Response('No clients', { status: 503 })
  }

  const headerRecord: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headerRecord[key] = value
  })

  const timeout = destination === 'document' ? DOCUMENT_TIMEOUT : ASSET_TIMEOUT

  const [data, port] = await new Promise<
    [data: { status: number; headers: Record<string, string>; body: unknown }, MessagePort]
  >((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(
        '[z-torrent SW] 503 "Client response timeout" — no response within',
        timeout,
        'ms, url=',
        requestUrl,
        'clients=',
        clientlist.length
      )
      reject(new Error('Client response timeout'))
    }, timeout)
    for (const client of clientlist) {
      const messageChannel = new MessageChannel()
      const { port1, port2 } = messageChannel
      port1.onmessage = ({ data: msgData }) => {
        clearTimeout(timer)
        resolve([
          msgData as { status: number; headers: Record<string, string>; body: unknown },
          port1,
        ])
      }
      client.postMessage(
        {
          url: requestUrl,
          method,
          headers: headerRecord,
          scope: sw.registration.scope,
          destination,
          type: 'z-torrent',
        },
        [port2]
      )
    }
  })

  let timeOut: ReturnType<typeof setTimeout> | null = null
  const cleanup = (): void => {
    port.postMessage(false)
    if (timeOut) clearTimeout(timeOut)
    port.onmessage = null
  }

  const headers = normalizeSwResponseContentType(requestUrl, data.headers)
  delete headers['Transfer-Encoding']

  if (data.body !== 'STREAM') {
    cleanup()
    return new Response(data.body as string | ReadableStream<Uint8Array>, {
      status: data.status,
      headers,
    })
  }

  return new Promise<Response>((resolve) => {
    let receivedData = false

    const stream = new ReadableStream({
      pull(controller) {
        return new Promise<void>((pullResolve) => {
          port.onmessage = ({ data: chunk }) => {
            if (chunk) {
              receivedData = true
              controller.enqueue(chunk as Uint8Array)
            } else {
              cleanup()
              if (!receivedData) {
                controller.error(new Error('Empty stream'))
              } else {
                controller.close()
              }
            }
            pullResolve()
          }
          if (activeClients.size === 0) {
            if (timeOut) clearTimeout(timeOut)
            timeOut = setTimeout(
              () => {
                cleanup()
                pullResolve()
              },
              destination === 'document' ? DOCUMENT_TIMEOUT : ASSET_TIMEOUT
            )
          }
          port.postMessage(true)
        })
      },
      cancel() {
        cleanup()
      },
    })

    resolve(new Response(stream, { status: data.status, headers }))
  })
}

import { normalizeSwResponseContentType } from '@z-torrent/utils/streaming-mime'

const portTimeoutDuration = 5000
let cancellable = false

interface ServeData {
  status: number
  headers: Record<string, string>
  body: string | ReadableStream<Uint8Array>
}

const sw = self as unknown as ServiceWorkerGlobalScope

export function handleFetch(event: FetchEvent): Response | Promise<Response> | null {
  const { url } = event.request
  if (!url.includes(sw.registration.scope + 'z-torrent/')) return null
  if (url.includes(sw.registration.scope + 'z-torrent/keepalive/')) {
    return new Response()
  }
  if (url.includes(sw.registration.scope + 'z-torrent/cancel/')) {
    return new Response(
      new ReadableStream({
        cancel() {
          cancellable = true
        },
      })
    )
  }
  return serve(event).catch(() => new Response('Service unavailable', { status: 503 }))
}

async function serve(event: FetchEvent): Promise<Response> {
  const { request } = event
  const { url, method, destination } = request
  const clientlist = await sw.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })

  if (clientlist.length === 0) {
    return new Response('No clients', { status: 503 })
  }

  const headerRecord: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headerRecord[key] = value
  })

  const [data, port] = await new Promise<[ServeData, MessagePort]>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Client response timeout')), 15000)
    for (const client of clientlist) {
      const messageChannel = new MessageChannel()
      const { port1, port2 } = messageChannel
      port1.onmessage = ({ data: msgData }) => {
        clearTimeout(timeout)
        resolve([msgData as ServeData, port1])
      }
      client.postMessage(
        {
          url,
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

  const headers = normalizeSwResponseContentType(url, data.headers)

  if (data.body !== 'STREAM') {
    cleanup()
    return new Response(data.body as string | ReadableStream<Uint8Array>, {
      status: data.status,
      headers,
    })
  }

  return new Response(
    new ReadableStream({
      pull(controller) {
        return new Promise<void>((resolve) => {
          port.onmessage = ({ data: chunk }) => {
            if (chunk) {
              controller.enqueue(chunk as Uint8Array)
            } else {
              cleanup()
              controller.close()
            }
            resolve()
          }
          if (!cancellable) {
            if (timeOut) clearTimeout(timeOut)
            if (destination !== 'document') {
              timeOut = setTimeout(() => {
                cleanup()
                resolve()
              }, portTimeoutDuration)
            }
          }
          port.postMessage(true)
        })
      },
      cancel() {
        cleanup()
      },
    }),
    { status: data.status, headers }
  )
}

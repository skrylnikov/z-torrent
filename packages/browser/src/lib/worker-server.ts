const portTimeoutDuration = 5000
let cancellable = false

interface ServeData {
  status: number
  headers: Record<string, string>
  body: string | ReadableStream<Uint8Array>
}

const _self = self as unknown as ServiceWorkerGlobalScope

const listener = (event: FetchEvent): Response | Promise<Response> | null => {
  const { url } = event.request
  if (!url.includes(_self.registration.scope + 'z-torrent/')) return null
  if (url.includes(_self.registration.scope + 'z-torrent/keepalive/')) {
    return new Response()
  }
  if (url.includes(_self.registration.scope + 'z-torrent/cancel/')) {
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

export default listener

async function serve(event: FetchEvent): Promise<Response> {
  const { request } = event
  const { url, method, headers, destination } = request
  const clientlist = await _self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })

  if (clientlist.length === 0) {
    return new Response('No clients', { status: 503 })
  }

  const [data, port] = await new Promise<[ServeData, MessagePort]>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Client response timeout')), 15000)
    for (const client of clientlist) {
      const messageChannel = new MessageChannel()
      const { port1, port2 } = messageChannel
      port1.onmessage = ({ data }) => {
        clearTimeout(timeout)
        resolve([data, port1])
      }
      client.postMessage(
        {
          url,
          method,
          headers: Object.fromEntries(headers.entries()),
          scope: _self.registration.scope,
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

  if (data.body !== 'STREAM') {
    cleanup()
    return new Response(data.body as BodyInit, data)
  }

  return new Response(
    new ReadableStream({
      pull(controller) {
        return new Promise<void>((resolve) => {
          port.onmessage = ({ data }) => {
            if (data) {
              controller.enqueue(data as Uint8Array)
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
    data
  )
}

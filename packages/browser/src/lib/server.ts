import {
  ServerBase,
  type Request,
  type File,
  type ClientWithTorrents,
  type ServerOptions,
} from '@z-torrent/core'

export interface BrowserServerOptions extends ServerOptions {
  controller: ServiceWorkerRegistration
}

const keepAliveTime = 20000

type StreamBody = { destroy?: () => void; [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array> }

export class BrowserServer extends ServerBase {
  registration: ServiceWorkerRegistration
  workerKeepAliveInterval: ReturnType<typeof setInterval> | null
  workerPortCount: number
  override pathname: string
  #address: { port: string; family: string; address: string }
  #boundHandler: (event: MessageEvent) => void

  constructor(client: ClientWithTorrents, opts: BrowserServerOptions) {
    if (!(opts.controller instanceof ServiceWorkerRegistration)) {
      throw new Error('Invalid worker registration')
    }
    const ctrl = opts.controller
    if (ctrl.active?.state !== 'activated' && ctrl.active?.state !== 'activating') {
      throw new Error("Worker isn't activated")
    }

    super(client, opts)

    this.registration = opts.controller
    this.workerKeepAliveInterval = null
    this.workerPortCount = 0

    const scope = new URL(opts.controller.scope)
    this.pathname = scope.pathname + 'z-torrent'
    this.#address = {
      port: scope.port,
      family: 'IPv4',
      address: scope.hostname,
    }

    this.#boundHandler = this.wrapRequest.bind(this)
    navigator.serviceWorker.addEventListener('message', this.#boundHandler)
    void fetch(`${this.pathname}/cancel/`).then((res) => {
      void res.body?.cancel()
    })
  }

  createFileBody(
    file: File,
    req: Request,
    range: { start: number; end: number } | null
  ): AsyncIterable<Uint8Array> {
    const opts = range ? { start: range.start, end: range.end } : undefined
    return file[Symbol.asyncIterator](opts) as AsyncIterable<Uint8Array>
  }

  wrapRequest(event: MessageEvent): void {
    const req = event.data as { type?: string; url?: string } | undefined

    if (req?.type !== 'z-torrent' || !req.url) return

    const port = event.ports[0]
    if (port === undefined) return

    this.onRequest(req as Request, ({ status, headers, body }) => {
      const streamBody = body as StreamBody | undefined
      const asyncIterator = streamBody?.[Symbol.asyncIterator]?.()

      const cleanup = (): void => {
        port.onmessage = null
        streamBody?.destroy?.()
        this.workerPortCount--
        if (!this.workerPortCount) {
          clearInterval(this.workerKeepAliveInterval!)
          this.workerKeepAliveInterval = null
        }
      }

      port.onmessage = async (msg: MessageEvent) => {
        if (msg.data) {
          let chunk: Uint8Array | undefined
          try {
            chunk = asyncIterator ? (await asyncIterator.next()).value : undefined
          } catch {
            // chunk is yet to be downloaded or it somehow failed
          }
          port.postMessage(chunk)
          if (!chunk) cleanup()
          if (!this.workerKeepAliveInterval) {
            this.workerKeepAliveInterval = setInterval(() => {
              void fetch(`${this.pathname}/keepalive/`)
            }, keepAliveTime)
          }
        } else {
          cleanup()
        }
      }
      this.workerPortCount++
      port.postMessage({
        status,
        headers,
        body: asyncIterator ? 'STREAM' : body,
      })
    })
  }

  listen(_port: unknown, cb: () => void): void {
    cb()
  }

  address(): { port: string; family: string; address: string } {
    return this.#address
  }

  override close(cb?: () => void): void {
    navigator.serviceWorker.removeEventListener('message', this.#boundHandler)
    super.close(cb || (() => {}))
  }

  override destroy(cb?: () => void): void {
    super.destroy(cb || (() => {}))
  }
}

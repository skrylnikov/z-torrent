import {
  ServerBase,
  type Request,
  type File,
  type ClientWithTorrents,
  type ServerOptions,
  type ZTManifest,
} from '@z-torrent/core'
import Debug from 'debug'

export interface BrowserServerOptions extends ServerOptions {
  controller: ServiceWorkerRegistration
  hostingMode?: boolean
  manifest?: ZTManifest
}

const keepAliveTime = 20000
const debug = Debug('@z-torrent/browser:server')

type StreamBody = { destroy?: () => void; [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array> }

export class BrowserServer extends ServerBase {
  registration: ServiceWorkerRegistration
  workerKeepAliveInterval: ReturnType<typeof setInterval> | null
  workerPortCount: number
  override pathname: string
  #address: { port: string; family: string; address: string }
  #boundHandler: (event: MessageEvent) => void
  #cancelResponse: Promise<Response> | null = null

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
    // Keep fetch alive so tab unload aborts body → SW removes client from active set.
    this.#cancelResponse = fetch(`${this.pathname}/cancel/`)
  }

  #abortCancelFetch(): void {
    this.#cancelResponse
      ?.then((res) => {
        void res.body?.cancel()
      })
      .catch(() => {})
    this.#cancelResponse = null
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

    const onRequestResult = this.onRequest(req as Request, ({ status, headers, body }) => {
      debug('responding to %s status=%d', req.url, status)
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
          } catch (err: unknown) {
            debug('file stream error: %O', err)
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

    if (onRequestResult && typeof onRequestResult === 'object' && 'catch' in onRequestResult) {
      onRequestResult.catch((err: unknown) => {
        debug('onRequest error: %O url=%s', err, req.url)
        port.postMessage({
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          body: 'Internal error',
        })
      })
    }
  }

  listen(_port: unknown, cb: () => void): void {
    cb()
  }

  address(): { port: string; family: string; address: string } {
    return this.#address
  }

  override close(cb?: () => void): void {
    navigator.serviceWorker.removeEventListener('message', this.#boundHandler)
    this.#abortCancelFetch()
    super.close(cb || (() => {}))
  }

  override destroy(cb?: () => void): void {
    this.#abortCancelFetch()
    super.destroy(cb || (() => {}))
  }
}

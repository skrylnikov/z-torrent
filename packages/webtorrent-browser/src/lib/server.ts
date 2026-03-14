import { ServerBase, type Request, type Response, type File } from '../../../z-torrent-core/src/index.js'

export interface BrowserServerOptions {
  origin?: string | false
  controller: ServiceWorkerRegistration
}

const keepAliveTime = 20000

export class BrowserServer extends ServerBase {
  registration: ServiceWorkerRegistration
  workerKeepAliveInterval: ReturnType<typeof setInterval> | null
  workerPortCount: number
  pathname: string
  _address: { port: string; family: string; address: string }
  boundHandler: (event: MessageEvent) => void

  constructor(client: any, opts: BrowserServerOptions) {
    super(client, opts)

    this.registration = opts.controller
    this.workerKeepAliveInterval = null
    this.workerPortCount = 0

    const scope = new URL(opts.controller.scope)
    this.pathname = scope.pathname + 'z-torrent'
    this._address = {
      port: scope.port,
      family: 'IPv4',
      address: scope.hostname,
    }

    this.boundHandler = this.wrapRequest.bind(this)
    navigator.serviceWorker.addEventListener('message', this.boundHandler)
    void fetch(`${this.pathname}/cancel/`).then((res) => {
      void res.body?.cancel()
    })
  }

  createFileBody(file: File, req: Request, range: { start: number; end: number } | null): AsyncIterable<Uint8Array> {
    const opts = range ? { start: range.start, end: range.end } : undefined
    return file[Symbol.asyncIterator](opts) as AsyncIterable<Uint8Array>
  }

  wrapRequest(event: MessageEvent): void {
    const req = event.data

    if (req?.type !== 'z-torrent' || !req.url) return

    const [port] = event.ports
    this.onRequest(req, ({ status, headers, body }) => {
      const asyncIterator = (body as any)?.[Symbol.asyncIterator]?.()

      const cleanup = (): void => {
        port.onmessage = null
        if ((body as any)?.destroy) (body as any).destroy()
        this.workerPortCount--
        if (!this.workerPortCount) {
          clearInterval(this.workerKeepAliveInterval!)
          this.workerKeepAliveInterval = null
        }
      }

      port.onmessage = async (msg: MessageEvent) => {
        if (msg.data) {
          let chunk
          try {
            chunk = (await asyncIterator.next()).value
          } catch (e) {
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

  listen(_: any, cb: () => void): void {
    cb()
  }

  address(): { port: string; family: string; address: string } {
    return this._address
  }

  close(cb?: () => void): void {
    navigator.serviceWorker.removeEventListener('message', this.boundHandler)
    super.close(cb || (() => {}))
  }

  destroy(cb?: () => void): void {
    super.destroy(cb || (() => {}))
  }
}

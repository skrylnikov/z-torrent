import http from 'http'
import escapeHtml from 'escape-html'
import pump from 'pump'
import rangeParser from 'range-parser'
import queueMicrotask from 'queue-microtask'
import { Readable } from 'streamx'
import type Torrent from './torrent.js'
import type File from './file.js'
import type { WebTorrent } from '../../index.js'

const keepAliveTime = 20000

interface ServerOptions {
  origin?: string | false
  hostname?: string
  pathname?: string
  controller?: ServiceWorkerRegistration
}

interface Request {
  url: string
  method: string
  headers: {
    origin?: string
    host?: string
    range?: string
    'access-control-request-headers'?: string
    [key: string]: string | undefined
  }
  destination?: string
}

interface Response {
  status: number
  headers: Record<string, string | number>
  body: string | boolean | Readable | NodeJS.ReadableStream | ReadableStream<Uint8Array>
}

class ServerBase {
  client: WebTorrent
  opts: ServerOptions
  pendingReady: Set<() => Promise<void>>
  pathname: string = '/z-torrent'
  closed: boolean = false

  constructor(client: WebTorrent, opts: ServerOptions = {}) {
    this.client = client
    if (!opts.origin) opts.origin = '*'
    this.opts = opts
    this.pendingReady = new Set()
  }

  static serveIndexPage(res: Response, torrents: Torrent[], pathname: string): Response {
    const listHtml = torrents
      .map(
        (torrent) =>
          `<li>
        <a href="${escapeHtml(pathname)}/${torrent.infoHash}">
          ${escapeHtml(torrent.name)}
        </a>
        (${escapeHtml(String(torrent.length))} bytes)
      </li>`
      )
      .join('<br>')

    res.status = 200
    res.headers['Content-Type'] = 'text/html'
    res.body = getPageHTML(
      'Z-Torrent',
      `<h1>Z-Torrent</h1>
       <ol>${listHtml}</ol>`
    )

    return res
  }

  isOriginAllowed(req: Request): boolean {
    if (this.opts.origin === false) return false

    if (this.opts.origin === '*') return true

    return req.headers.origin === this.opts.origin
  }

  static serveMethodNotAllowed(res: Response): Response {
    res.status = 405
    res.headers['Content-Type'] = 'text/html'

    res.body = getPageHTML('405 - Method Not Allowed', '<h1>405 - Method Not Allowed</h1>')

    return res
  }

  static serve404Page(res: Response): Response {
    res.status = 404
    res.headers['Content-Type'] = 'text/html'

    res.body = getPageHTML('404 - Not Found', '<h1>404 - Not Found</h1>')
    return res
  }

  static serveTorrentPage(torrent: Torrent, res: Response, pathname: string): Response {
    const listHtml = (torrent.files as File[])
      .map(
        (file) =>
          `<li>
        <a href="${escapeHtml(pathname)}/${torrent.infoHash}/${escapeHtml(file.path)}">
          ${escapeHtml(file.path)}
        </a>
        (${escapeHtml(String(file.length))} bytes)
      </li>`
      )
      .join('<br>')

    res.status = 200
    res.headers['Content-Type'] = 'text/html'

    res.body = getPageHTML(
      `${escapeHtml(torrent.name)} - Z-Torrent`,
      `<h1>${escapeHtml(torrent.name)}</h1>
      <ol>${listHtml}</ol>`
    )

    return res
  }

  static serveOptionsRequest(req: Request, res: Response): Response {
    res.status = 204
    res.headers['Access-Control-Max-Age'] = '600'
    res.headers['Access-Control-Allow-Methods'] = 'GET,HEAD'

    if (req.headers['access-control-request-headers']) {
      res.headers['Access-Control-Allow-Headers'] = req.headers['access-control-request-headers']
    }
    return res
  }

  static serveFile(file: File, req: Request, res: Response): Response {
    res.status = 200

    res.headers.Expires = '0'
    res.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
    res.headers['Accept-Ranges'] = 'bytes'
    res.headers['Content-Type'] = file.type
    res.headers['transferMode.dlna.org'] = 'Streaming'
    res.headers['contentFeatures.dlna.org'] =
      'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000'

    if (req.destination === 'document') {
      res.headers['Content-Type'] = 'application/octet-stream'
      res.headers['Content-Disposition'] =
        `attachment; filename*=UTF-8''${encodeRFC5987(file.name)}`
      res.body = 'DOWNLOAD'
    } else {
      res.headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeRFC5987(file.name)}`
    }

    let range = rangeParser(file.length, req.headers.range || '')

    if (Array.isArray(range)) {
      res.status = 206

      range = range[0]

      res.headers['Content-Range'] =
        `bytes ${(range as any).start}-${(range as any).end}/${file.length}`

      res.headers['Content-Length'] = (range as any).end - (range as any).start + 1
    } else {
      ;(res as any).statusCode = 200
      range = null
      res.headers['Content-Length'] = file.length
    }

    if (req.method === 'GET') {
      const iterator = file[Symbol.asyncIterator](
        range ? { start: (range as any).start, end: (range as any).end } : undefined
      ) as AsyncIterable<Uint8Array>
      let transform: any = null
      file.emit('iterator', { iterator, req, file }, (target: any) => {
        transform = target
      })

      const stream = Readable.from(transform || iterator)
      let pipe: any = null
      file.emit('stream', { stream, req, file }, (target: any) => {
        pipe = pump(stream, target)
      })

      res.body = pipe || stream
    } else {
      res.body = false
    }
    return res
  }

  async onRequest(req: Request, cb: (res: Response) => void): Promise<void> {
    let pathname = new URL(req.url, 'http://example.com').pathname
    pathname = pathname.slice(pathname.indexOf(this.pathname) + this.pathname.length + 1)

    const res: Response = {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "base-uri 'none'; frame-ancestors 'none'; form-action 'none';",
      },
      status: 200,
      body: '',
    }

    if (this.isOriginAllowed(req)) {
      res.headers['Access-Control-Allow-Origin'] =
        this.opts.origin === '*' ? '*' : req.headers.origin || '*'
    }

    if (pathname === 'favicon.ico') {
      return cb(ServerBase.serve404Page(res))
    }

    if (req.method === 'OPTIONS') {
      if (this.isOriginAllowed(req)) {
        return cb(ServerBase.serveOptionsRequest(req, res))
      } else return cb(ServerBase.serveMethodNotAllowed(res))
    }

    const onReady = async (): Promise<void> => {
      this.pendingReady.delete(onReady)
      const res = await handleRequest()
      cb(res)
    }

    const handleRequest = async (): Promise<Response> => {
      if (pathname === '') {
        return ServerBase.serveIndexPage(res, this.client.torrents as Torrent[], this.pathname)
      }

      let [infoHash, ...filePath] = pathname.split('/')
      filePath = decodeURI(filePath.join('/'))

      const torrent = await (this.client as any).get(infoHash)
      if (!infoHash || !torrent) {
        return ServerBase.serve404Page(res)
      }

      if (!filePath) {
        return ServerBase.serveTorrentPage(torrent, res, this.pathname)
      }

      const file = (torrent.files as File[]).find(
        (file) => file.path.replace(/\\/g, '/') === filePath
      )
      if (!file) {
        return ServerBase.serve404Page(res)
      }
      return ServerBase.serveFile(file, req, res)
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (this.client.ready) {
        const res = await handleRequest()
        return cb(res)
      } else {
        this.pendingReady.add(onReady)
        this.client.once('ready', onReady as any)
        return
      }
    }

    return cb(ServerBase.serveMethodNotAllowed(res))
  }

  close(cb: () => void = () => {}): void {
    this.closed = true
    this.pendingReady.forEach((onReady) => {
      this.client.removeListener('ready', onReady as any)
    })
    this.pendingReady.clear()
    queueMicrotask(cb)
  }

  destroy(cb: () => void = () => {}): void {
    if (this.closed) queueMicrotask(cb)
    else this.close(cb)
    this.client = null as any
  }
}

class NodeServer extends ServerBase {
  server: http.Server
  _listen: typeof http.Server.prototype.listen
  _close: typeof http.Server.prototype.close
  sockets: Set<any>
  pathname: string

  constructor(client: WebTorrent, opts: ServerOptions) {
    super(client, opts)

    this.server = http.createServer()
    this._listen = this.server.listen
    this.server.listen = this.listen.bind(this) as any
    this._close = this.server.close
    this.server.close = this.close.bind(this) as any

    this.sockets = new Set()
    this.closed = false
    this.pathname = opts?.pathname || '/z-torrent'
  }

  wrapRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (
      this.opts.hostname &&
      req.headers.host !== `${this.opts.hostname}:${(this.server.address() as any).port}`
    ) {
      return req.destroy()
    }

    if (!new URL(req.url || '', 'http://example.com').pathname.startsWith(this.pathname)) {
      return req.destroy()
    }

    this.onRequest(req as any, ({ status, headers, body }) => {
      res.writeHead(status, headers as any)

      if ((body as any)?._readableState || (body as any)?._writableState) {
        pump(body as any, res)
      } else {
        res.end(body as any)
      }
    })
  }

  onConnection(socket: any): void {
    socket.setTimeout(36000000)
    this.sockets.add(socket)
    socket.once('close', () => {
      this.sockets.delete(socket)
    })
  }

  address(): { port: number; family: string; address: string } | null {
    return this.server.address() as any
  }

  listen(...args: any[]): http.Server {
    this.closed = false
    this.server.on('connection', this.onConnection.bind(this))
    this.server.on('request', this.wrapRequest.bind(this))
    return this._listen.apply(this.server, args as any)
  }

  close(cb: () => void = () => {}): void {
    this.server.removeAllListeners('connection')
    this.server.removeAllListeners('request')
    this.server.removeAllListeners('listening')
    super.close()
    this._close.call(this.server, cb)
  }

  destroy(cb?: () => void): void {
    this.sockets.forEach((socket) => {
      socket.destroy()
    })
    super.destroy(cb || (() => {}))
  }
}

class BrowserServer extends ServerBase {
  registration: ServiceWorkerRegistration
  workerKeepAliveInterval: ReturnType<typeof setInterval> | null
  workerPortCount: number
  pathname: string
  _address: { port: string; family: string; address: string }
  boundHandler: (event: MessageEvent) => void

  constructor(client: WebTorrent, opts: ServerOptions) {
    super(client, opts)

    this.registration = opts.controller!
    this.workerKeepAliveInterval = null
    this.workerPortCount = 0

    const scope = new URL(opts.controller!.scope)
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

  wrapRequest(event: MessageEvent): void {
    const req = event.data

    if (!req?.type === 'z-torrent' || !req.url) return

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

function getPageHTML(title: string, pageHtml: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
      </head>
      <body>
        ${pageHtml}
      </body>
    </html>
  `
}

function encodeRFC5987(str: string): string {
  return encodeURIComponent(str)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A')
    .replace(/%(?:7C|60|5E)/g, unescape)
}

export { NodeServer, BrowserServer }

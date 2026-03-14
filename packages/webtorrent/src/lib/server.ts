import http from 'http'
import pump from 'pump'
import { Readable } from 'streamx'
import { ServerBase, type Request, type Response } from 'z-torrent-core'
import type File from 'z-torrent-core'

export interface NodeServerOptions {
  origin?: string | false
  hostname?: string
  pathname?: string
}

export class NodeServer extends ServerBase {
  server: http.Server
  _listen: typeof http.Server.prototype.listen
  _close: typeof http.Server.prototype.close
  sockets: Set<any>
  pathname: string

  constructor(client: any, opts: NodeServerOptions = {}) {
    super(client, opts)

    this.server = http.createServer()
    this._listen = this.server.listen.bind(this.server)
    this.server.listen = this.listen.bind(this) as any
    this._close = this.server.close.bind(this.server)
    this.server.close = this.close.bind(this) as any

    this.sockets = new Set()
    this.closed = false
    this.pathname = opts?.pathname || '/z-torrent'
  }

  createFileBody(file: File, req: Request, range: { start: number; end: number } | null): unknown {
    const opts = range ? { start: range.start, end: range.end } : undefined
    const iterator = file[Symbol.asyncIterator](opts) as AsyncIterable<Uint8Array>
    return Readable.from(iterator)
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

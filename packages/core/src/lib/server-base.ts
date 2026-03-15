import escapeHtml from 'escape-html'
import rangeParser from 'range-parser'

import type File from './file.js'

const keepAliveTime = 20000

export interface ServerOptions {
  origin?: string | false
  hostname?: string
  pathname?: string
  controller?: unknown
}

export interface Request {
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

export interface Response {
  status: number
  headers: Record<string, string | number>
  body: unknown
}

export interface ClientWithTorrents {
  torrents: unknown[]
  ready: boolean
  get(infoHash: string): Promise<unknown>
  on(event: string, fn: (...args: unknown[]) => void): void
  removeListener(event: string, fn: (...args: unknown[]) => void): void
  once(event: string, fn: (...args: unknown[]) => void): void
}

export interface TorrentWithFiles {
  infoHash: string
  name: string
  length: number
  files: File[]
}

export abstract class ServerBase {
  client: ClientWithTorrents
  opts: ServerOptions
  pendingReady: Set<() => Promise<void>>
  pathname: string = '/z-torrent'
  closed: boolean = false

  constructor(client: ClientWithTorrents, opts: ServerOptions = {}) {
    this.client = client
    if (!opts.origin) opts.origin = '*'
    this.opts = opts
    this.pendingReady = new Set()
  }

  /** Platform-specific: create response body for file stream */
  abstract createFileBody(
    file: File,
    req: Request,
    range: { start: number; end: number } | null
  ): unknown

  static serveIndexPage(res: Response, torrents: TorrentWithFiles[], pathname: string): Response {
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

  static serveTorrentPage(torrent: TorrentWithFiles, res: Response, pathname: string): Response {
    const listHtml = torrent.files
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

  serveFile(file: File, req: Request, res: Response): Response {
    res.status = 200

    res.headers['Expires'] = '0'
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

      const rangeObj = range[0] as { start: number; end: number }

      res.headers['Content-Range'] = `bytes ${rangeObj.start}-${rangeObj.end}/${file.length}`

      res.headers['Content-Length'] = rangeObj.end - rangeObj.start + 1

      if (req.method === 'GET') {
        res.body = this.createFileBody(file, req, rangeObj)
      } else {
        res.body = false
      }
    } else {
      res.headers['Content-Length'] = file.length

      if (req.method === 'GET') {
        res.body = this.createFileBody(file, req, null)
      } else {
        res.body = false
      }
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
      const result = await handleRequest()
      cb(result)
    }

    const handleRequest = async (): Promise<Response> => {
      if (pathname === '') {
        return ServerBase.serveIndexPage(
          res,
          this.client.torrents as TorrentWithFiles[],
          this.pathname
        )
      }

      let [infoHash, ...filePath] = pathname.split('/')
      filePath = decodeURI(filePath.join('/'))

      const torrent = await this.client.get(infoHash)
      if (!infoHash || !torrent) {
        return ServerBase.serve404Page(res)
      }

      const torrentWithFiles = torrent as TorrentWithFiles
      if (!filePath) {
        return ServerBase.serveTorrentPage(torrentWithFiles, res, this.pathname)
      }

      const file = torrentWithFiles.files.find((f) => f.path.replace(/\\/g, '/') === filePath)
      if (!file) {
        return ServerBase.serve404Page(res)
      }
      return this.serveFile(file, req, res)
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (this.client.ready) {
        const result = await handleRequest()
        return cb(result)
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

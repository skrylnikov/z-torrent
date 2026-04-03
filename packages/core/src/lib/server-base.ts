import escapeHtml from 'escape-html'
import rangeParser from 'range-parser'

import type { File } from './file.js'
import type { ZTManifest } from '../types/manifest.js'

const keepAliveTime = 20000

export interface ServerOptions {
  origin?: string | false
  hostname?: string
  pathname?: string
  hostingMode?: boolean
  manifest?: ZTManifest
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

  serveFile(file: File, req: Request, res: Response, fileOpts?: { custom404?: boolean }): Response {
    res.status = 200

    if (this.opts.hostingMode && !fileOpts?.custom404) {
      res.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    } else if (this.opts.hostingMode && fileOpts?.custom404) {
      res.headers['Cache-Control'] = 'no-store'
    } else {
      res.headers['Expires'] = '0'
      res.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
    }
    res.headers['Accept-Ranges'] = 'bytes'
    res.headers['Content-Type'] = file.type
    res.headers['transferMode.dlna.org'] = 'Streaming'
    res.headers['contentFeatures.dlna.org'] =
      'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000'

    if (req.destination === 'document' && !this.opts.hostingMode) {
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
        if (
          this.opts.hostingMode &&
          req.destination === 'document' &&
          file.type === 'text/html' &&
          typeof res.body !== 'boolean'
        ) {
          const infoHash = this._extractInfoHash(req.url)
          if (infoHash) {
            const baseTag = `<base href="${this.pathname}/${infoHash}/">`
            res.body = injectBaseTag(res.body as AsyncIterable<Uint8Array>, baseTag)
          }
        }
      } else {
        res.body = false
      }
    } else {
      if (req.method === 'GET') {
        res.body = this.createFileBody(file, req, null)
      } else {
        res.body = false
      }

      if (
        this.opts.hostingMode &&
        req.destination === 'document' &&
        file.type === 'text/html' &&
        typeof res.body !== 'string' &&
        typeof res.body !== 'boolean'
      ) {
        const infoHash = this._extractInfoHash(req.url)
        if (infoHash) {
          const baseTag = `<base href="${this.pathname}/${infoHash}/">`
          res.body = injectBaseTag(res.body as AsyncIterable<Uint8Array>, baseTag)
          res.headers['Transfer-Encoding'] = 'chunked'
        } else {
          res.headers['Content-Length'] = file.length
        }
      } else {
        res.headers['Content-Length'] = file.length
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
        // Hosting mode: permissive CSP so arbitrary static sites (iframes, inline
        // scripts, eval in demos) work. Arbitrary torrent content can execute —
        // treat hosted bundles as untrusted; see docs/security.
        'Content-Security-Policy': this.opts.hostingMode
          ? "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
          : "base-uri 'none'; frame-ancestors 'none'; form-action 'none';",
      },
      status: 200,
      body: '',
    }

    if (this.isOriginAllowed(req)) {
      res.headers['Access-Control-Allow-Origin'] =
        this.opts.origin === '*' ? '*' : req.headers.origin || '*'
    }

    if (pathname === 'favicon.ico' && !this.opts.hostingMode) {
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

      const pathParts = pathname.split('/')
      const infoHash = pathParts[0]
      const filePath = decodeURI(pathParts.slice(1).join('/'))

      const torrent = await this.client.get(infoHash)
      if (!infoHash || !torrent) {
        return ServerBase.serve404Page(res)
      }

      const torrentWithFiles = torrent as TorrentWithFiles
      if (!filePath) {
        return ServerBase.serveTorrentPage(torrentWithFiles, res, this.pathname)
      }

      if (this.opts.hostingMode && this.opts.manifest?.routing?.redirects?.length) {
        const redirect = matchRedirect(filePath, this.opts.manifest.routing.redirects)
        if (redirect) {
          res.status = redirect.status
          res.headers['Location'] = redirect.to
          res.headers['Content-Length'] = 0
          res.body = false
          return res
        }
      }

      const resolved = resolveFile(filePath, torrentWithFiles, {
        hostingMode: this.opts.hostingMode,
        manifest: this.opts.manifest,
        destination: req.destination,
      })

      if (!resolved) {
        return ServerBase.serve404Page(res)
      }

      const { file, status404 } = resolved
      if (status404) {
        const fileRes = this.serveFile(file, req, res, { custom404: true })
        fileRes.status = 404
        return fileRes
      }

      if (this.opts.hostingMode && this.opts.manifest?.routing?.headers?.length) {
        const customHeaders = matchHeaders(filePath, this.opts.manifest.routing.headers)
        for (const [key, value] of customHeaders) {
          res.headers[key] = value
        }
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

  _extractInfoHash(url: string): string | null {
    try {
      const pathname = new URL(url, 'http://example.com').pathname
      const prefix = this.pathname + '/'
      const idx = pathname.indexOf(prefix)
      if (idx === -1) return null
      const rest = pathname.slice(idx + prefix.length)
      const hash = rest.split('/')[0]
      if (/^[a-f0-9]{40}$/i.test(hash) || /^[a-f0-9]{64}$/i.test(hash)) {
        return hash.toLowerCase()
      }
      return null
    } catch {
      return null
    }
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

function resolveFile(
  filePath: string,
  torrent: TorrentWithFiles,
  opts: { hostingMode?: boolean; manifest?: ZTManifest; destination?: string }
): { file: File; status404?: boolean } | null {
  const find = (p: string) => torrent.files.find((f) => f.path.replace(/\\/g, '/') === p)

  // a. Exact path match
  let file = find(filePath)

  // b. Torrent name prefix stripping (hosting mode only, when torrent has a name folder)
  const prefix = opts.hostingMode && torrent.name ? torrent.name + '/' : null
  if (!file && prefix) {
    file = find(prefix + filePath)
  }

  // c. Directory → index.html (trailing slash)
  if (!file && filePath.endsWith('/')) {
    if (prefix) {
      file = find(prefix + filePath + 'index.html')
    } else {
      file = find(filePath + 'index.html')
    }
  }

  // d. Extension fallback → .html
  if (!file) {
    if (prefix) {
      file = find(prefix + filePath + '.html')
    } else {
      file = find(filePath + '.html')
    }
  }

  // e. SPA fallback (hosting mode + manifest.type === 'spa' + document destination)
  if (
    !file &&
    opts.hostingMode &&
    opts.manifest?.type === 'spa' &&
    opts.destination === 'document'
  ) {
    const fallback = opts.manifest.routing?.fallback ?? 'index.html'
    if (prefix) {
      file = find(prefix + fallback)
    } else {
      file = find(fallback)
    }
  }

  if (file) return { file }

  // f. Custom 404 page (hosting mode + manifest.routing.errors['404'])
  if (opts.hostingMode && opts.manifest?.routing?.errors?.['404']) {
    const errorPagePath = opts.manifest.routing.errors['404']
    const errorFile = find(errorPagePath)
    if (errorFile) return { file: errorFile, status404: true }
  }

  return null
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

/** `>` that closes `<head ...>` after `headIdx`, skipping quoted attribute regions. */
function findHeadTagCloseAngle(haystack: Uint8Array, headIdx: number): number {
  const start = headIdx + 5
  if (start >= haystack.length) return -1
  let inQuote: number | null = null
  for (let i = start; i < haystack.length; i++) {
    const b = haystack[i]
    if (inQuote !== null) {
      if (b === inQuote) inQuote = null
      continue
    }
    if (b === 0x27 || b === 0x22) {
      inQuote = b
      continue
    }
    if (b === 0x3e) return i
  }
  return -1
}

const INJECT_BASE_TAG_SCAN_MAX = 262144

function injectBaseTag(
  source: AsyncIterable<Uint8Array>,
  baseTag: string
): AsyncIterable<Uint8Array> {
  const baseBytes = new TextEncoder().encode(baseTag)
  const headOpen = new TextEncoder().encode('<head')
  return {
    [Symbol.asyncIterator]() {
      const inner = source[Symbol.asyncIterator]()
      let passThrough = false
      let pending = new Uint8Array(0)
      let sourceDone = false

      return {
        async next(): Promise<IteratorResult<Uint8Array>> {
          if (passThrough) return inner.next() as Promise<IteratorResult<Uint8Array>>

          while (!sourceDone && pending.length < INJECT_BASE_TAG_SCAN_MAX) {
            const { value: chunk, done } = await inner.next()
            if (done) {
              sourceDone = true
              break
            }
            const nextChunk = chunk as Uint8Array
            const merged = new Uint8Array(pending.length + nextChunk.length)
            merged.set(pending)
            merged.set(nextChunk, pending.length)
            pending = merged

            const headIdx = findBytesCaseInsensitive(pending, headOpen)
            if (headIdx === -1) {
              if (pending.length >= INJECT_BASE_TAG_SCAN_MAX) {
                passThrough = true
                const out = pending
                pending = new Uint8Array(0)
                return { value: out, done: false }
              }
              continue
            }

            const closeIdx = findHeadTagCloseAngle(pending, headIdx)
            if (closeIdx === -1) {
              if (pending.length >= INJECT_BASE_TAG_SCAN_MAX) {
                passThrough = true
                const out = pending
                pending = new Uint8Array(0)
                return { value: out, done: false }
              }
              continue
            }

            const insertPos = closeIdx + 1
            const out = new Uint8Array(pending.length + baseBytes.length)
            out.set(pending.subarray(0, insertPos))
            out.set(baseBytes, insertPos)
            out.set(pending.subarray(insertPos), insertPos + baseBytes.length)
            pending = new Uint8Array(0)
            passThrough = true
            return { value: out, done: false }
          }

          if (sourceDone && pending.length > 0) {
            passThrough = true
            const out = pending
            pending = new Uint8Array(0)
            return { value: out, done: false }
          }

          return { value: undefined, done: true }
        },
      }
    },
  }
}

function findBytesCaseInsensitive(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0) return 0
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if ((haystack[i + j] | 0x20) !== (needle[j] | 0x20)) continue outer
    }
    return i
  }
  return -1
}

function matchRedirect(
  filePath: string,
  redirects: Array<{ from: string; to: string; status?: 301 | 302 | 307 | 308 }>
): { to: string; status: 301 | 302 | 307 | 308 } | null {
  for (const r of redirects) {
    if (filePath === r.from || globMatch(filePath, r.from)) {
      return { to: r.to, status: r.status ?? 301 }
    }
  }
  return null
}

function matchHeaders(
  filePath: string,
  headerRules: Array<{ match: string; headers: Record<string, string> }>
): Array<[string, string]> {
  const result: Array<[string, string]> = []
  for (const rule of headerRules) {
    if (globMatch(filePath, rule.match)) {
      for (const [key, value] of Object.entries(rule.headers)) {
        result.push([key, value])
      }
    }
  }
  return result
}

function globMatch(path: string, pattern: string): boolean {
  const normalize = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')
  const normPath = normalize(path)
  const normPattern = normalize(pattern)

  if (normPattern === '*') return true
  if (normPattern === normPath) return true

  const regexStr = normPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')

  try {
    return new RegExp(`^${regexStr}$`, 'i').test(normPath)
  } catch {
    return false
  }
}

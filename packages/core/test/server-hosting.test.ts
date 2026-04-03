import { test, expect } from 'bun:test'
import {
  ServerBase,
  type ServerOptions,
  type ClientWithTorrents,
  type TorrentWithFiles,
} from '../src/lib/server-base.js'
import type { File } from '../src/lib/file.js'
import type { ZTManifest } from '../src/types/manifest.js'

function createMockFile(name: string, path: string, length = 100): File {
  return {
    name,
    path,
    length,
    size: length,
    type: name.endsWith('.html') ? 'text/html' : 'application/octet-stream',
    offset: 0,
    done: true,
    select() {},
    deselect() {},
    [Symbol.asyncIterator]() {
      return {
        async next() {
          return { value: undefined, done: true }
        },
      }
    },
    async arrayBuffer() {
      return new ArrayBuffer(0)
    },
    async blob() {
      return new Blob()
    },
    async stream() {
      return new ReadableStream()
    },
    streamTo() {
      return {} as HTMLMediaElement
    },
    includes() {
      return false
    },
    _destroy() {},
  } as unknown as File
}

function createMockClient(torrents: TorrentWithFiles[]): ClientWithTorrents {
  return {
    torrents,
    ready: true,
    async get(infoHash: string) {
      return torrents.find((t) => t.infoHash === infoHash) ?? null
    },
    on() {},
    removeListener() {},
    once() {},
  }
}

class TestServer extends ServerBase {
  constructor(client: ClientWithTorrents, opts: ServerOptions = {}) {
    super(client, opts)
  }

  createFileBody() {
    return null
  }
}

function makeRequest(path: string, destination?: string): Parameters<ServerBase['onRequest']>[0] {
  return {
    url: `http://example.com/z-torrent/${path}`,
    method: 'GET',
    headers: {},
    destination,
  }
}

const INFO_HASH = 'a'.repeat(40)

test('hosting mode: HTML served inline without forced download', async () => {
  const files = [createMockFile('index.html', 'index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true })

  const res = await new Promise<{
    status: number
    headers: Record<string, string | number>
    body: unknown
  }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/index.html`, 'document'), (res) => {
      resolve(res as any)
    })
  })

  expect(res.status).toBe(200)
  expect(res.headers['Content-Type']).toBe('text/html')
  expect(res.headers['Content-Disposition']).not.toContain('attachment')
  expect(res.body).not.toBe('DOWNLOAD')
  server.destroy()
})

test('non-hosting mode: HTML forced download for document destination', async () => {
  const files = [createMockFile('index.html', 'index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: false })

  const req = makeRequest(`${INFO_HASH}/index.html`, 'document')
  req.method = 'HEAD'
  const res = await new Promise<{
    status: number
    headers: Record<string, string | number>
    body: unknown
  }>((resolve) => {
    server.onRequest(req, (res) => {
      resolve(res as any)
    })
  })

  expect(res.status).toBe(200)
  expect(res.headers['Content-Type']).toBe('application/octet-stream')
  expect(res.headers['Content-Disposition']).toContain('attachment')
  expect(res.body).toBe(false)
  server.destroy()
})

test('hosting mode: immutable cache headers', async () => {
  const files = [createMockFile('style.css', 'style.css')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true })

  const res = await new Promise<{ headers: Record<string, string | number> }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/style.css`), (res) => resolve(res as any))
  })

  expect(res.headers['Cache-Control']).toBe('public, max-age=31536000, immutable')
  expect(res.headers['Expires']).toBeUndefined()
  server.destroy()
})

test('non-hosting mode: no-cache headers', async () => {
  const files = [createMockFile('style.css', 'style.css')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: false })

  const res = await new Promise<{ headers: Record<string, string | number> }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/style.css`), (res) => resolve(res as any))
  })

  expect(res.headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate, max-age=0')
  expect(res.headers['Expires']).toBe('0')
  server.destroy()
})

test('hosting mode: relaxed CSP', async () => {
  const files = [createMockFile('index.html', 'index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true })

  const res = await new Promise<{ headers: Record<string, string | number> }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/index.html`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  expect(res.headers['Content-Security-Policy']).toContain('default-src *')
  expect(res.headers['Content-Security-Policy']).toContain("'unsafe-inline'")
  expect(res.headers['Content-Security-Policy']).not.toContain("frame-ancestors 'none'")
  server.destroy()
})

test('non-hosting mode: restrictive CSP', async () => {
  const files = [createMockFile('index.html', 'index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: false })

  const res = await new Promise<{ headers: Record<string, string | number> }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/index.html`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  expect(res.headers['Content-Security-Policy']).toContain("frame-ancestors 'none'")
  expect(res.headers['Content-Security-Policy']).toContain("form-action 'none'")
  server.destroy()
})

test('hosting mode: favicon.ico resolves through file lookup', async () => {
  const files = [createMockFile('favicon.ico', 'favicon.ico')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/favicon.ico`), (res) => resolve(res as any))
  })

  expect(res.status).toBe(200)
  server.destroy()
})

test('non-hosting mode: favicon.ico returns 404', async () => {
  const files = [createMockFile('index.html', 'index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: false })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/favicon.ico`), (res) => resolve(res as any))
  })

  expect(res.status).toBe(404)
  server.destroy()
})

test('hosting mode: directory index resolution', async () => {
  const files = [createMockFile('index.html', 'test-site/about/index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true })

  const res = await new Promise<{ status: number; body: unknown }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/about/`), (res) => resolve(res as any))
  })

  expect(res.status).toBe(200)
  expect(res.body).not.toBe('DOWNLOAD')
  server.destroy()
})

test('hosting mode: HTML extension fallback', async () => {
  const files = [createMockFile('about.html', 'test-site/about.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true })

  const res = await new Promise<{ status: number; body: unknown }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/about`), (res) => resolve(res as any))
  })

  expect(res.status).toBe(200)
  server.destroy()
})

test('SPA fallback: unknown path serves fallback for document requests', async () => {
  const manifest: ZTManifest = {
    version: 1,
    site: { name: 'SPA' },
    type: 'spa',
    routing: { fallback: 'index.html' },
  }

  const files = [
    createMockFile('index.html', 'test-site/index.html'),
    createMockFile('app.js', 'test-site/app.js'),
  ]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 200, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true, manifest })

  const res = await new Promise<{
    status: number
    headers: Record<string, string | number>
    body: unknown
  }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/unknown-page`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  expect(res.status).toBe(200)
  expect(res.headers['Content-Type']).toBe('text/html')
  expect(res.body).not.toBe('DOWNLOAD')
  server.destroy()
})

test('SPA fallback: asset requests bypass fallback', async () => {
  const manifest: ZTManifest = {
    version: 1,
    site: { name: 'SPA' },
    type: 'spa',
    routing: { fallback: 'index.html' },
  }

  const files = [
    createMockFile('index.html', 'test-site/index.html'),
    createMockFile('app.js', 'test-site/app.js'),
  ]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 200, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true, manifest })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/unknown-asset.js`, ''), (res) => resolve(res as any))
  })

  expect(res.status).toBe(404)
  server.destroy()
})

test('static site: unknown path returns 404 even in hosting mode', async () => {
  const manifest: ZTManifest = {
    version: 1,
    site: { name: 'Static' },
    type: 'static',
  }

  const files = [createMockFile('index.html', 'test-site/index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true, manifest })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/unknown`, 'document'), (res) => resolve(res as any))
  })

  expect(res.status).toBe(404)
  server.destroy()
})

test('SPA fallback uses index.html when no routing.fallback specified', async () => {
  const manifest: ZTManifest = {
    version: 1,
    site: { name: 'SPA' },
    type: 'spa',
  }

  const files = [createMockFile('index.html', 'test-site/index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true, manifest })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/some-route`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  expect(res.status).toBe(200)
  server.destroy()
})

test('resolveFile: exact path match (non-hosting, no prefix stripping)', async () => {
  const files = [createMockFile('style.css', 'style.css')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'my-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: false })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/style.css`), (res) => resolve(res as any))
  })

  expect(res.status).toBe(200)
  server.destroy()
})

test('resolveFile: torrent name prefix stripped in hosting mode', async () => {
  const files = [createMockFile('about.html', 'my-site/about.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'my-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/about.html`), (res) => resolve(res as any))
  })

  expect(res.status).toBe(200)
  server.destroy()
})

test('resolveFile: directory with trailing slash resolves to index.html', async () => {
  const files = [createMockFile('index.html', 'my-site/docs/index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'my-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/docs/`), (res) => resolve(res as any))
  })

  expect(res.status).toBe(200)
  server.destroy()
})

test('resolveFile: .html extension fallback for extensionless path', async () => {
  const files = [createMockFile('contact.html', 'my-site/contact.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'my-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/contact`), (res) => resolve(res as any))
  })

  expect(res.status).toBe(200)
  server.destroy()
})

test('resolveFile: custom 404 page served with status 404', async () => {
  const manifest: ZTManifest = {
    version: 1,
    site: { name: 'My Site' },
    type: 'static',
    routing: { errors: { '404': 'my-site/404.html' } },
  }

  const files = [
    createMockFile('index.html', 'my-site/index.html'),
    createMockFile('404.html', 'my-site/404.html'),
  ]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'my-site', length: 200, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true, manifest })

  const res = await new Promise<{
    status: number
    headers: Record<string, string | number>
  }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/unknown-page`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  expect(res.status).toBe(404)
  expect(res.headers['Content-Type']).toBe('text/html')
  server.destroy()
})

test('resolveFile: SPA custom routing.fallback path is used', async () => {
  const manifest: ZTManifest = {
    version: 1,
    site: { name: 'SPA' },
    type: 'spa',
    routing: { fallback: 'shell.html' },
  }

  const files = [createMockFile('shell.html', 'my-site/shell.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'my-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: true, manifest })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/deep/route`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  expect(res.status).toBe(200)
  server.destroy()
})

test('resolveFile: non-hosting mode unknown path returns 404', async () => {
  const files = [createMockFile('index.html', 'index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test', length: 100, files }
  const client = createMockClient([torrent])
  const server = new TestServer(client, { hostingMode: false })

  const res = await new Promise<{ status: number }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/notfound.txt`), (res) => resolve(res as any))
  })

  expect(res.status).toBe(404)
  server.destroy()
})

function makeHtmlContent(html: string): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      const encoder = new TextEncoder()
      let sent = false
      return {
        async next() {
          if (!sent) {
            sent = true
            return { value: encoder.encode(html), done: false as const }
          }
          return { value: undefined as any, done: true as const }
        },
      }
    },
  }
}

async function collectIterable(iterable: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of iterable) {
    chunks.push(chunk)
  }
  const total = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0))
  let offset = 0
  for (const c of chunks) {
    total.set(c, offset)
    offset += c.length
  }
  return new TextDecoder().decode(total)
}

test('injectBaseTag: base tag injected into HTML with lowercase <head>', async () => {
  const html = '<html><head><title>Test</title></head><body>hello</body></html>'

  class HtmlTestServer extends ServerBase {
    createFileBody() {
      return makeHtmlContent(html)
    }
  }

  const files = [createMockFile('index.html', 'test-site/index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new HtmlTestServer(client, { hostingMode: true })

  const res = await new Promise<{ status: number; body: unknown }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/index.html`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  expect(res.status).toBe(200)
  const body = res.body as AsyncIterable<Uint8Array>
  const text = await collectIterable(body)
  expect(text).toContain('<base href=')
  expect(text).toContain('<title>Test</title>')
  server.destroy()
})

test('injectBaseTag: base tag injected into HTML with uppercase <HEAD>', async () => {
  const html = '<html><HEAD><title>Test</title></HEAD><body>hello</body></html>'

  class HtmlTestServerUppercase extends ServerBase {
    createFileBody() {
      return makeHtmlContent(html)
    }
  }

  const files = [createMockFile('index.html', 'test-site/index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new HtmlTestServerUppercase(client, { hostingMode: true })

  const res = await new Promise<{ status: number; body: unknown }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/index.html`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  expect(res.status).toBe(200)
  const body = res.body as AsyncIterable<Uint8Array>
  const text = await collectIterable(body)
  expect(text).toContain('<base href=')
  expect(text).toContain('<title>Test</title>')
  server.destroy()
})

test('injectBaseTag: HTML without <head> does not inject base tag', async () => {
  const html = '<html><body>no head tag here</body></html>'

  class HtmlTestServerNoHead extends ServerBase {
    createFileBody() {
      return makeHtmlContent(html)
    }
  }

  const files = [createMockFile('index.html', 'test-site/index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new HtmlTestServerNoHead(client, { hostingMode: true })

  const res = await new Promise<{ status: number; body: unknown }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/index.html`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  expect(res.status).toBe(200)
  const body = res.body as AsyncIterable<Uint8Array>
  const text = await collectIterable(body)
  expect(text).not.toContain('<base href=')
  server.destroy()
})

test('injectBaseTag: data integrity — original content fully preserved after injection', async () => {
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>content</body></html>'

  class HtmlTestServerIntegrity extends ServerBase {
    createFileBody() {
      return makeHtmlContent(html)
    }
  }

  const files = [createMockFile('index.html', 'test-site/index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new HtmlTestServerIntegrity(client, { hostingMode: true })

  const res = await new Promise<{ status: number; body: unknown }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/index.html`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  const body = res.body as AsyncIterable<Uint8Array>
  const text = await collectIterable(body)
  expect(text).toContain('<!DOCTYPE html>')
  expect(text).toContain('<meta charset="utf-8">')
  expect(text).toContain('<body>content</body>')
  expect(text).toContain('<base href=')
  const headIdx = text.indexOf('<head')
  const baseIdx = text.indexOf('<base href=')
  const metaIdx = text.indexOf('<meta')
  expect(headIdx).toBeGreaterThan(-1)
  expect(baseIdx).toBeGreaterThan(headIdx)
  expect(baseIdx).toBeLessThan(metaIdx)
  server.destroy()
})

test('injectBaseTag: inserts after <head> with attributes', async () => {
  const html =
    '<html><head lang="en"><meta charset="utf-8"><title>T</title></head><body></body></html>'

  class HtmlHeadAttrs extends ServerBase {
    createFileBody() {
      return makeHtmlContent(html)
    }
  }

  const files = [createMockFile('index.html', 'test-site/index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new HtmlHeadAttrs(client, { hostingMode: true })

  const res = await new Promise<{ status: number; body: unknown }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/index.html`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  const text = await collectIterable(res.body as AsyncIterable<Uint8Array>)
  const gtAfterHead = text.indexOf('<head lang="en">')
  const baseIdx = text.indexOf('<base href=')
  expect(gtAfterHead).toBeGreaterThan(-1)
  expect(baseIdx).toBeGreaterThan(gtAfterHead)
  server.destroy()
})

function makeHtmlContentChunked(html: string, splitAt: number): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      const encoder = new TextEncoder()
      const a = html.slice(0, splitAt)
      const b = html.slice(splitAt)
      const parts = [encoder.encode(a), encoder.encode(b)]
      let i = 0
      return {
        async next() {
          if (i >= parts.length) return { value: undefined, done: true as const }
          return { value: parts[i++], done: false as const }
        },
      }
    },
  }
}

test('injectBaseTag: works when <head> spans chunks', async () => {
  const html = '<html><head><title>X</title></head><body></body></html>'
  const splitAt = html.indexOf('ad')

  class HtmlChunked extends ServerBase {
    createFileBody() {
      return makeHtmlContentChunked(html, splitAt)
    }
  }

  const files = [createMockFile('index.html', 'test-site/index.html')]
  const torrent: TorrentWithFiles = { infoHash: INFO_HASH, name: 'test-site', length: 100, files }
  const client = createMockClient([torrent])
  const server = new HtmlChunked(client, { hostingMode: true })

  const res = await new Promise<{ status: number; body: unknown }>((resolve) => {
    server.onRequest(makeRequest(`${INFO_HASH}/index.html`, 'document'), (res) =>
      resolve(res as any)
    )
  })

  const text = await collectIterable(res.body as AsyncIterable<Uint8Array>)
  expect(text).toContain('<base href=')
  expect(text).toContain('<title>X</title>')
  server.destroy()
})

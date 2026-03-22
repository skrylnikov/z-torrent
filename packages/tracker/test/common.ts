import { Server } from '../src/index.js'

export interface TestCreateServerOpts {
  serverType: 'http' | 'udp' | 'ws'
  serverFamily?: 'inet' | 'inet6'
  filter?: (infoHash: string, params: unknown, cb: (err?: Error | null) => void) => void
  peersCacheLength?: number
  peersCacheTtl?: number
  http?: boolean
  udp?: boolean
  ws?: boolean
}

export const createServer = (
  opts: TestCreateServerOpts | string,
  cb: (server: Server, announceUrl: string) => void
): void => {
  const serverType = typeof opts === 'string' ? opts : opts.serverType

  const base =
    typeof opts === 'string'
      ? {}
      : {
          filter: opts.filter,
          peersCacheLength: opts.peersCacheLength,
          peersCacheTtl: opts.peersCacheTtl,
        }

  const serverOpts = {
    ...base,
    http: serverType === 'http',
    udp: serverType === 'udp',
    ws: serverType === 'ws',
  }

  const server = new Server(serverOpts)

  server.on('error', (err) => {
    throw err
  })
  server.on('warning', (err) => {
    throw err
  })

  const listenHostname =
    typeof opts === 'object' && opts.serverFamily === 'inet6'
      ? { http: '::1', udp: '::1', udp4: '0.0.0.0', udp6: '::1' }
      : undefined

  server.listen(0, listenHostname as never, () => {
    const port = server[serverType]!.address().port
    let announceUrl: string
    if (serverType === 'http') {
      announceUrl = `http://127.0.0.1:${port}/announce`
    } else if (serverType === 'udp') {
      announceUrl = `udp://127.0.0.1:${port}`
    } else {
      announceUrl = `ws://127.0.0.1:${port}`
    }

    cb(server, announceUrl)
  })
}

export default { createServer }

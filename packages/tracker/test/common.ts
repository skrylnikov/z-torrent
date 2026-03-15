import { Server } from '../index.js'

interface ServerOptions {
  serverType: 'http' | 'udp' | 'ws'
  http?: boolean
  udp?: boolean
  ws?: boolean
}

interface MockWebsocketTrackerClient {
  _trackers: Array<{
    _generateOffers: (numwant: number, cb: (offers: Array<{ fake_offer: string }>) => void) => void
  }>
}

export const createServer = (
  opts: ServerOptions | string,
  cb: (server: Server, announceUrl: string) => void
): void => {
  let serverOpts: ServerOptions
  if (typeof opts === 'string') {
    serverOpts = { serverType: opts as 'http' | 'udp' | 'ws' }
  } else {
    serverOpts = opts
  }

  serverOpts.http = serverOpts.serverType === 'http'
  serverOpts.udp = serverOpts.serverType === 'udp'
  serverOpts.ws = serverOpts.serverType === 'ws'

  const server = new Server(serverOpts)

  server.on('error', (err) => {
    throw err
  })
  server.on('warning', (err) => {
    throw err
  })

  server.listen(0, () => {
    const port = server[serverOpts.serverType]!.address().port
    let announceUrl: string
    if (serverOpts.serverType === 'http') {
      announceUrl = `http://127.0.0.1:${port}/announce`
    } else if (serverOpts.serverType === 'udp') {
      announceUrl = `udp://127.0.0.1:${port}`
    } else {
      announceUrl = `ws://127.0.0.1:${port}`
    }

    cb(server, announceUrl)
  })
}

export const mockWebsocketTracker = (client: MockWebsocketTrackerClient): void => {
  client._trackers[0]._generateOffers = (numwant, cb) => {
    const offers: Array<{ fake_offer: string }> = []
    for (let i = 0; i < numwant; i++) {
      offers.push({ fake_offer: `fake_offer_${i}` })
    }
    queueMicrotask(() => {
      cb(offers)
    })
  }
}

export default { mockWebsocketTracker, createServer }

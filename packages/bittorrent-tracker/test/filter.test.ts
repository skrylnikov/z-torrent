import queueMicrotask from 'queue-microtask'
import Client from '../index.js'
import common from './common.js'
import fixtures from 'webtorrent-fixtures'
import type Server from '../server.js'

const peerId = Buffer.from('01234567890123456789')

function testFilterOption(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  const opts: {
    serverType: 'http' | 'udp' | 'ws'
    filter?: (infoHash: string, params: unknown, cb: (err?: Error | null) => void) => void
  } = { serverType }
  opts.filter = (infoHash, _params, cb) => {
    queueMicrotask(() => {
      if (infoHash === fixtures.alice.parsedTorrent.infoHash) {
        cb(new Error('disallowed info_hash (Alice)'))
      } else {
        cb(null)
      }
    })
  }

  return new Promise((resolve, reject) => {
    common.createServer(opts, (server: Server, announceUrl) => {
      const client1 = new Client({
        infoHash: fixtures.alice.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId,
        port: 6881,
        wrtc: {},
      })

      client1.on('error', (err) => {
        throw err
      })
      if (serverType === 'ws') common.mockWebsocketTracker(client1)

      client1.once('warning', (err) => {
        expect(err.message.includes('disallowed info_hash (Alice)')).toBeTruthy()

        client1.destroy(() => {
          const client2 = new Client({
            infoHash: fixtures.leaves.parsedTorrent.infoHash,
            announce: announceUrl,
            peerId,
            port: 6881,
            wrtc: {},
          })
          if (serverType === 'ws') common.mockWebsocketTracker(client2)

          client2.on('error', (err) => {
            throw err
          })
          client2.on('warning', (err) => {
            throw err
          })

          client2.on('update', () => {
            client2.destroy(() => {
              server.close(() => {
                resolve()
              })
            })
          })

          server.on('start', () => {
            expect(Object.keys(server.torrents).length).toBe(1)
          })

          client2.start()
        })
      })

      server.removeAllListeners('warning')
      server.once('warning', (err) => {
        expect(err.message.includes('disallowed info_hash (Alice)')).toBeTruthy()
        expect(Object.keys(server.torrents).length).toBe(0)
      })

      client1.start()
    })
  })
}

test('http: filter option blocks tracker from tracking torrent', () => testFilterOption('http'))
test.skip('udp: filter option blocks tracker from tracking torrent', () => testFilterOption('udp'))
test('ws: filter option blocks tracker from tracking torrent', () => testFilterOption('ws'))

function testFilterCustomError(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  const opts: {
    serverType: 'http' | 'udp' | 'ws'
    filter?: (infoHash: string, params: unknown, cb: (err?: Error | null) => void) => void
  } = { serverType }
  opts.filter = (infoHash, _params, cb) => {
    queueMicrotask(() => {
      if (infoHash === fixtures.alice.parsedTorrent.infoHash) {
        cb(new Error('alice blocked'))
      } else {
        cb(null)
      }
    })
  }

  return new Promise((resolve, reject) => {
    common.createServer(opts, (server: Server, announceUrl) => {
      const client1 = new Client({
        infoHash: fixtures.alice.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId,
        port: 6881,
        wrtc: {},
      })

      client1.on('error', (err) => {
        throw err
      })
      if (serverType === 'ws') common.mockWebsocketTracker(client1)

      client1.once('warning', (err) => {
        expect(/alice blocked/.test(err.message)).toBeTruthy()

        client1.destroy(() => {
          const client2 = new Client({
            infoHash: fixtures.leaves.parsedTorrent.infoHash,
            announce: announceUrl,
            peerId,
            port: 6881,
            wrtc: {},
          })
          if (serverType === 'ws') common.mockWebsocketTracker(client2)

          client2.on('error', (err) => {
            throw err
          })
          client2.on('warning', (err) => {
            throw err
          })

          client2.on('update', () => {
            client2.destroy(() => {
              server.close(() => {
                resolve()
              })
            })
          })

          server.on('start', () => {
            expect(Object.keys(server.torrents).length).toBe(1)
          })

          client2.start()
        })
      })

      server.removeAllListeners('warning')
      server.once('warning', (err) => {
        expect(/alice blocked/.test(err.message)).toBeTruthy()
        expect(Object.keys(server.torrents).length).toBe(0)
      })

      client1.start()
    })
  })
}

test('http: filter option with custom error', () => testFilterCustomError('http'))
test.skip('udp: filter option filter option with custom error', () => testFilterCustomError('udp'))
test('ws: filter option filter option with custom error', () => testFilterCustomError('ws'))

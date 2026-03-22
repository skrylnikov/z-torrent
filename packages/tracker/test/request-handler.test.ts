import { Client, Server } from '../src/index.js'
import common from './common.js'
import { fixtures } from '@z-torrent/fixtures'

import { testWrtc } from './helpers.js'

const peerId = Buffer.from('01234567890123456789')

function testRequestHandler(serverType: 'http' | 'ws'): Promise<void> {
  const opts: { serverType: 'http' | 'ws' } = { serverType }

  const OriginalSwarm = Server.Swarm

  class TestSwarm extends OriginalSwarm {
    announce(
      params: any,
      cb: (err: Error | null, response?: any) => void
    ): void {
      super.announce(params, (err: Error | null, response?: any) => {
        if (err) {
          cb(err, response)
          return
        }
        if (response) {
          response.complete = 246
          response.extraData = 'hi'
        }
        cb(null, response)
      })
    }
  }

  const OldSwarm = Server.Swarm
  Server.Swarm = TestSwarm as typeof Server.Swarm

  return new Promise<void>((resolve) => {
    common.createServer(opts, (server, announceUrl) => {
      const client1 = new Client({
        infoHash: fixtures.alice.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId,
        port: 6881,
        wrtc: testWrtc,
      })

      client1.on('error', (err) => {
        throw err
      })

      server.once('start', () => {})

      client1.once('update', (data: any) => {
        expect(data.complete).toBe(246)
        expect(Buffer.from(data.extraData as string).toString()).toBe('hi')

        client1.destroy(() => {
          server.close(() => {
            resolve()
          })
        })
      })

      client1.start()
    })
  }).finally(() => {
    Server.Swarm = OldSwarm
  })
}

test('http: request handler option intercepts announce requests and responses', () =>
  testRequestHandler('http'))
test('ws: request handler option intercepts announce requests and responses', () =>
  testRequestHandler('ws'))

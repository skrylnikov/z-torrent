import Client from '../index.js'
import common from './common.js'
import fixtures from 'webtorrent-fixtures'
import test from 'tape'
import type { Test } from 'tape'
import Server from '../server.js'

const peerId = Buffer.from('01234567890123456789')

function testRequestHandler(t: Test, serverType: 'http' | 'ws'): void {
  t.plan(5)

  const opts: { serverType: 'http' | 'ws' } = { serverType }

  const OriginalSwarm = Server.Swarm

  const TestSwarm = function (this: any, infoHash: string, server: any): void {
    OriginalSwarm.call(this, infoHash, server)
  } as unknown as typeof Server.Swarm

  TestSwarm.prototype = Object.create(OriginalSwarm.prototype)
  TestSwarm.prototype.constructor = TestSwarm

  TestSwarm.prototype.announce = function (
    params: any,
    cb: (err: Error | null, response?: any) => void
  ): void {
    OriginalSwarm.prototype.announce.call(this, params, (err: Error | null, response?: any) => {
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

  const OldSwarm = Server.Swarm
  Server.Swarm = TestSwarm

  common.createServer(t, opts, (server, announceUrl) => {
    const client1 = new Client({
      infoHash: fixtures.alice.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId,
      port: 6881,
      wrtc: {},
    })

    client1.on('error', (err) => {
      t.error(err)
    })
    if (serverType === 'ws') common.mockWebsocketTracker(client1)

    server.once('start', () => {
      t.pass('got start message from client1')
    })

    client1.once('update', (data: any) => {
      t.equal(data.complete, 246)
      t.equal(Buffer.from(data.extraData as string).toString(), 'hi')

      client1.destroy(() => {
        t.pass('client1 destroyed')
        Server.Swarm = OldSwarm
      })

      server.close(() => {
        t.pass('server destroyed')
      })
    })

    client1.start()
  })
}

test('http: request handler option intercepts announce requests and responses', (t: Test) => {
  testRequestHandler(t, 'http')
})

test('ws: request handler option intercepts announce requests and responses', (t: Test) => {
  testRequestHandler(t, 'ws')
})

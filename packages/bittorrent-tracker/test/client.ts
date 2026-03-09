import Client from '../index.js'
import common from './common.js'
import http from 'http'
import fixtures from 'webtorrent-fixtures'
import net from 'net'
import test from 'tape'
import type { Test } from 'tape'
import undici from 'undici'

const peerId1 = Buffer.from('01234567890123456789')
const peerId2 = Buffer.from('12345678901234567890')
const peerId3 = Buffer.from('23456789012345678901')
const port = 6881

function testClientStart(t: Test, serverType: 'http' | 'udp' | 'ws'): void {
  t.plan(4)

  common.createServer(t, serverType, (server, announceUrl) => {
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      wrtc: {},
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client)
    client.on('error', (err) => {
      t.error(err)
    })
    client.on('warning', (err) => {
      t.error(err)
    })

    client.once('update', (data) => {
      t.equal(data.announce, announceUrl)
      t.equal(typeof data.complete, 'number')
      t.equal(typeof data.incomplete, 'number')

      client.stop()

      client.once('update', () => {
        t.pass('got response to stop')
        server.close()
        client.destroy()
      })
    })

    client.start()
  })
}

test('http: client.start()', (t: Test) => {
  testClientStart(t, 'http')
})

test('udp: client.start()', (t: Test) => {
  testClientStart(t, 'udp')
})

test('ws: client.start()', (t: Test) => {
  testClientStart(t, 'ws')
})

function testClientStop(t: Test, serverType: 'http' | 'udp' | 'ws'): void {
  t.plan(4)

  common.createServer(t, serverType, (server, announceUrl) => {
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      wrtc: {},
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client)
    client.on('error', (err) => {
      t.error(err)
    })
    client.on('warning', (err) => {
      t.error(err)
    })

    client.start()

    client.once('update', () => {
      t.pass('client received response to "start" message')

      client.stop()

      client.once('update', (data) => {
        t.equal(data.announce, announceUrl)
        t.equal(typeof data.complete, 'number')
        t.equal(typeof data.incomplete, 'number')

        server.close()
        client.destroy()
      })
    })
  })
}

test('http: client.stop()', (t: Test) => {
  testClientStop(t, 'http')
})

test('udp: client.stop()', (t: Test) => {
  testClientStop(t, 'udp')
})

test('ws: client.stop()', (t: Test) => {
  testClientStop(t, 'ws')
})

function testClientStopDestroy(t: Test, serverType: 'http' | 'udp' | 'ws'): void {
  t.plan(2)

  common.createServer(t, serverType, (server, announceUrl) => {
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      wrtc: {},
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client)
    client.on('error', (err) => {
      t.error(err)
    })
    client.on('warning', (err) => {
      t.error(err)
    })

    client.start()

    client.once('update', () => {
      t.pass('client received response to "start" message')

      client.stop()

      client.on('update', () => {
        t.fail('client should not receive update after destroy is called')
      })

      client.destroy()

      server.once('stop', () => {
        t.pass('server received "stop" message')
        setTimeout(() => {
          server.close()
        }, 100)
      })
    })
  })
}

test('http: client.stop(); client.destroy()', (t: Test) => {
  testClientStopDestroy(t, 'http')
})

test('udp: client.stop(); client.destroy()', (t: Test) => {
  testClientStopDestroy(t, 'udp')
})

test('ws: client.stop(); client.destroy()', (t: Test) => {
  testClientStopDestroy(t, 'ws')
})

function testClientUpdate(t: Test, serverType: 'http' | 'udp' | 'ws'): void {
  t.plan(4)

  common.createServer(t, serverType, (server, announceUrl) => {
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      wrtc: {},
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client)
    client.on('error', (err) => {
      t.error(err)
    })
    client.on('warning', (err) => {
      t.error(err)
    })

    client.setInterval(500)

    client.start()

    client.once('update', () => {
      client.setInterval(500)

      client.once('update', (data) => {
        t.equal(data.announce, announceUrl)
        t.equal(typeof data.complete, 'number')
        t.equal(typeof data.incomplete, 'number')
        client.stop()

        client.once('update', () => {
          t.pass('got response to stop')
          server.close()
          client.destroy()
        })
      })
    })
  })
}

test('http: client.update()', (t: Test) => {
  testClientUpdate(t, 'http')
})

test('udp: client.update()', (t: Test) => {
  testClientUpdate(t, 'udp')
})

test('ws: client.update()', (t: Test) => {
  testClientUpdate(t, 'ws')
})

function testClientScrape(t: Test, serverType: 'http' | 'udp' | 'ws'): void {
  t.plan(4)

  common.createServer(t, serverType, (server, announceUrl) => {
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      wrtc: {},
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client)
    client.on('error', (err) => {
      t.error(err)
    })
    client.on('warning', (err) => {
      t.error(err)
    })

    client.once('scrape', (data) => {
      t.equal(data.announce, announceUrl)
      t.equal(typeof data.complete, 'number')
      t.equal(typeof data.incomplete, 'number')
      t.equal(typeof data.downloaded, 'number')

      server.close()
      client.destroy()
    })

    client.scrape()
  })
}

test('http: client.scrape()', (t: Test) => {
  testClientScrape(t, 'http')
})

test('udp: client.scrape()', (t: Test) => {
  testClientScrape(t, 'udp')
})

test('ws: client.scrape()', (t: Test) => {
  testClientScrape(t, 'ws')
})

function testClientAnnounceWithParams(t: Test, serverType: 'http' | 'udp' | 'ws'): void {
  t.plan(5)

  common.createServer(t, serverType, (server, announceUrl) => {
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      wrtc: {},
    })

    server.on('start', (_peer, params) => {
      t.equal(params.testParam, 'this is a test')
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client)
    client.on('error', (err) => {
      t.error(err)
    })
    client.on('warning', (err) => {
      t.error(err)
    })

    client.once('update', (data) => {
      t.equal(data.announce, announceUrl)
      t.equal(typeof data.complete, 'number')
      t.equal(typeof data.incomplete, 'number')

      client.stop()

      client.once('update', () => {
        t.pass('got response to stop')
        server.close()
        client.destroy()
      })
    })

    client.start({
      testParam: 'this is a test',
    })
  })
}

test('http: client.announce() with params', (t: Test) => {
  testClientAnnounceWithParams(t, 'http')
})

test('ws: client.announce() with params', (t: Test) => {
  testClientAnnounceWithParams(t, 'ws')
})

function testClientGetAnnounceOpts(t: Test, serverType: 'http' | 'udp' | 'ws'): void {
  t.plan(5)

  common.createServer(t, serverType, (server, announceUrl) => {
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      getAnnounceOpts() {
        return {
          testParam: 'this is a test',
        }
      },
      wrtc: {},
    })

    server.on('start', (_peer, params) => {
      t.equal(params.testParam, 'this is a test')
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client)
    client.on('error', (err) => {
      t.error(err)
    })
    client.on('warning', (err) => {
      t.error(err)
    })

    client.once('update', (data) => {
      t.equal(data.announce, announceUrl)
      t.equal(typeof data.complete, 'number')
      t.equal(typeof data.incomplete, 'number')

      client.stop()

      client.once('update', () => {
        t.pass('got response to stop')
        server.close()
        client.destroy()
      })
    })

    client.start()
  })
}

test('http: client `opts.getAnnounceOpts`', (t: Test) => {
  testClientGetAnnounceOpts(t, 'http')
})

test('ws: client `opts.getAnnounceOpts`', (t: Test) => {
  testClientGetAnnounceOpts(t, 'ws')
})

function testClientAnnounceWithNumWant(t: Test, serverType: 'http' | 'udp' | 'ws'): void {
  t.plan(4)

  common.createServer(t, serverType, (server, announceUrl) => {
    const client1 = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: [announceUrl],
      peerId: peerId1,
      port,
      wrtc: {},
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client1)
    client1.on('error', (err) => {
      t.error(err)
    })
    client1.on('warning', (err) => {
      t.error(err)
    })

    client1.start()
    client1.once('update', () => {
      const client2 = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: peerId2,
        port: port + 1,
        wrtc: {},
      })

      if (serverType === 'ws') common.mockWebsocketTracker(client2)
      client2.on('error', (err) => {
        t.error(err)
      })
      client2.on('warning', (err) => {
        t.error(err)
      })

      client2.start()
      client2.once('update', () => {
        const client3 = new Client({
          infoHash: fixtures.leaves.parsedTorrent.infoHash,
          announce: announceUrl,
          peerId: peerId3,
          port: port + 2,
          wrtc: {},
        })

        if (serverType === 'ws') common.mockWebsocketTracker(client3)
        client3.on('error', (err) => {
          t.error(err)
        })
        client3.on('warning', (err) => {
          t.error(err)
        })

        client3.start({ numwant: 1 })
        client3.on('peer', () => {
          t.pass('got one peer (this should only fire once)')

          let num = 3
          function tryCloseServer(): void {
            num -= 1
            if (num === 0) server.close()
          }

          client1.stop()
          client1.once('update', () => {
            t.pass('got response to stop (client1)')
            client1.destroy()
            tryCloseServer()
          })
          client2.stop()
          client2.once('update', () => {
            t.pass('got response to stop (client2)')
            client2.destroy()
            tryCloseServer()
          })
          client3.stop()
          client3.once('update', () => {
            t.pass('got response to stop (client3)')
            client3.destroy()
            tryCloseServer()
          })
        })
      })
    })
  })
}

test('http: client announce with numwant', (t: Test) => {
  testClientAnnounceWithNumWant(t, 'http')
})

test('udp: client announce with numwant', (t: Test) => {
  testClientAnnounceWithNumWant(t, 'udp')
})

test('http: userAgent', (t: Test) => {
  t.plan(2)

  common.createServer(t, 'http', (server, announceUrl) => {
    server.http!.on('request', (req) => {
      t.ok(req.headers['user-agent']?.includes('WebTorrent'))
    })

    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      userAgent: 'WebTorrent/0.98.0 (https://webtorrent.io)',
      wrtc: {},
    })

    client.on('error', (err) => {
      t.error(err)
    })
    client.on('warning', (err) => {
      t.error(err)
    })

    client.once('update', (data) => {
      t.equal(data.announce, announceUrl)

      server.close()
      client.destroy()
    })

    client.start()
  })
})

function testSupportedTracker(t: Test, serverType: 'http' | 'udp' | 'ws'): void {
  t.plan(1)

  common.createServer(t, serverType, (server, announceUrl) => {
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      wrtc: {},
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client)
    client.on('error', (err) => {
      t.error(err)
    })
    client.on('warning', (err) => {
      t.error(err)
    })

    client.start()

    client.once('update', () => {
      t.pass('tracker is valid')

      server.close()
      client.destroy()
    })
  })
}

test('http: valid tracker port', (t: Test) => {
  testSupportedTracker(t, 'http')
})

test('udp: valid tracker port', (t: Test) => {
  testSupportedTracker(t, 'udp')
})

test('ws: valid tracker port', (t: Test) => {
  testSupportedTracker(t, 'ws')
})

function testUnsupportedTracker(t: Test, announceUrl: string): void {
  t.plan(1)

  const client = new Client({
    infoHash: fixtures.leaves.parsedTorrent.infoHash,
    announce: announceUrl,
    peerId: peerId1,
    port,
    wrtc: {},
  })

  client.on('error', (err) => {
    t.error(err)
  })
  client.on('warning', (err) => {
    t.ok(err.message.includes('tracker'), 'got warning')

    client.destroy()
  })
}

test('unsupported tracker protocol', (t: Test) => {
  testUnsupportedTracker(t, 'badprotocol://127.0.0.1:8080/announce')
})

test('http: invalid tracker port', (t: Test) => {
  testUnsupportedTracker(t, 'http://127.0.0.1:69691337/announce')
})

test('http: invalid tracker url', (t: Test) => {
  testUnsupportedTracker(t, 'http:')
})

test('http: invalid tracker url with slash', (t: Test) => {
  testUnsupportedTracker(t, 'http://')
})

test('udp: invalid tracker port', (t: Test) => {
  testUnsupportedTracker(t, 'udp://127.0.0.1:69691337')
})

test('udp: invalid tracker url', (t: Test) => {
  testUnsupportedTracker(t, 'udp:')
})

test('udp: invalid tracker url with slash', (t: Test) => {
  testUnsupportedTracker(t, 'udp://')
})

test('ws: invalid tracker port', (t: Test) => {
  testUnsupportedTracker(t, 'ws://127.0.0.1:69691337')
})

test('ws: invalid tracker url', (t: Test) => {
  testUnsupportedTracker(t, 'ws:')
})

test('ws: invalid tracker url with slash', (t: Test) => {
  testUnsupportedTracker(t, 'ws://')
})

function testClientStartHttpAgent(t: Test, serverType: 'http' | 'ws'): void {
  t.plan(5)

  common.createServer(t, serverType, function (server, announceUrl) {
    let agent: http.Agent | undici.Agent
    let agentUsed = false
    if (typeof global.fetch === 'function' && serverType !== 'ws') {
      const connector = undici.buildConnector({ rejectUnauthorized: false })
      agent = new undici.Agent({
        connect(opts, cb) {
          agentUsed = true
          connector(opts, (err, socket) => {
            if (err) {
              cb(err, null)
            } else {
              cb(null, socket)
            }
          })
        },
      })
    } else {
      agent = new http.Agent()
      agent.createConnection = function (opts, fn) {
        agentUsed = true
        return net.createConnection(opts as net.TcpSocketConnectOpts, fn as () => void)
      }
    }
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      wrtc: {},
      proxyOpts: {
        httpAgent: agent,
      },
    })

    if (serverType === 'ws') common.mockWebsocketTracker(client)
    client.on('error', function (err) {
      t.error(err)
    })
    client.on('warning', function (err) {
      t.error(err)
    })

    client.once('update', function (data) {
      t.equal(data.announce, announceUrl)
      t.equal(typeof data.complete, 'number')
      t.equal(typeof data.incomplete, 'number')

      t.ok(agentUsed)

      client.stop()

      client.once('update', function () {
        t.pass('got response to stop')
        server.close()
        client.destroy()
      })
    })

    client.start()
  })
}

test('http: client.start(httpAgent)', function (t: Test) {
  testClientStartHttpAgent(t, 'http')
})

test('ws: client.start(httpAgent)', function (t: Test) {
  testClientStartHttpAgent(t, 'ws')
})

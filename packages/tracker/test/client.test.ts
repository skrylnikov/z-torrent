import { Client } from '../src/index.js'
import common from './common.js'
import { fixtures } from '@z-torrent/fixtures'
import http from 'http'
import net from 'net'

import { testWrtc } from './helpers.js'

const peerId1 = Buffer.from('01234567890123456789')
const peerId2 = Buffer.from('12345678901234567890')
const peerId3 = Buffer.from('23456789012345678901')
const port = 6881

function testClientStart(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: peerId1,
        port,
        wrtc: testWrtc,
      })
      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.once('update', (data) => {
        expect(data.announce).toBe(announceUrl)
        expect(typeof data.complete).toBe('number')
        expect(typeof data.incomplete).toBe('number')

        client.stop()

        client.once('update', () => {
          server.close()
          client.destroy()
          resolve()
        })
      })

      client.start()
    })
  })
}

test('http: client.start()', () => testClientStart('http'))
test('udp: client.start()', () => testClientStart('udp'))
test('ws: client.start()', () => testClientStart('ws'))

function testClientStop(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: peerId1,
        port,
        wrtc: testWrtc,
      })
      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.start()

      client.once('update', () => {
        client.stop()

        client.once('update', (data) => {
          expect(data.announce).toBe(announceUrl)
          expect(typeof data.complete).toBe('number')
          expect(typeof data.incomplete).toBe('number')

          server.close()
          client.destroy()
          resolve()
        })
      })
    })
  })
}

test('http: client.stop()', () => testClientStop('http'))
test('udp: client.stop()', () => testClientStop('udp'))
test('ws: client.stop()', () => testClientStop('ws'))

function testClientStopDestroy(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: peerId1,
        port,
        wrtc: testWrtc,
      })
      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.start()

      client.once('update', () => {
        client.stop()

        client.on('update', () => {
          expect().fail('client should not receive update after destroy is called')
        })

        client.destroy()

        server.once('stop', () => {
          setTimeout(() => {
            server.close()
            resolve()
          }, 100)
        })
      })
    })
  })
}

test('http: client.stop(); client.destroy()', () => testClientStopDestroy('http'))
test('udp: client.stop(); client.destroy()', () => testClientStopDestroy('udp'))
test('ws: client.stop(); client.destroy()', () => testClientStopDestroy('ws'))

function testClientUpdate(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: peerId1,
        port,
        wrtc: testWrtc,
      })
      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.setInterval(500)

      client.start()

      client.once('update', () => {
        client.setInterval(500)

        client.once('update', (data) => {
          expect(data.announce).toBe(announceUrl)
          expect(typeof data.complete).toBe('number')
          expect(typeof data.incomplete).toBe('number')
          client.stop()

          client.once('update', () => {
            server.close()
            client.destroy()
            resolve()
          })
        })
      })
    })
  })
}

test('http: client.update()', () => testClientUpdate('http'))
test('udp: client.update()', () => testClientUpdate('udp'))
test('ws: client.update()', () => testClientUpdate('ws'))

function testClientScrape(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: peerId1,
        port,
        wrtc: testWrtc,
      })
      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.once('scrape', (data) => {
        expect(data.announce).toBe(announceUrl)
        expect(typeof data.complete).toBe('number')
        expect(typeof data.incomplete).toBe('number')
        expect(typeof data.downloaded).toBe('number')

        server.close()
        client.destroy()
        resolve()
      })

      client.scrape()
    })
  })
}

test('http: client.scrape()', () => testClientScrape('http'))
test('udp: client.scrape()', () => testClientScrape('udp'))
test('ws: client.scrape()', () => testClientScrape('ws'))

function testClientAnnounceWithParams(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: peerId1,
        port,
        wrtc: testWrtc,
      })

      server.on('start', (_peer, params) => {
        expect(params.testParam).toBe('this is a test')
      })

      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.once('update', (data) => {
        expect(data.announce).toBe(announceUrl)
        expect(typeof data.complete).toBe('number')
        expect(typeof data.incomplete).toBe('number')

        client.stop()

        client.once('update', () => {
          server.close()
          client.destroy()
          resolve()
        })
      })

      client.start({
        testParam: 'this is a test',
      })
    })
  })
}

test('http: client.announce() with params', () => testClientAnnounceWithParams('http'))
test('ws: client.announce() with params', () => testClientAnnounceWithParams('ws'))

function testClientGetAnnounceOpts(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
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
        wrtc: testWrtc,
      })

      server.on('start', (_peer, params) => {
        expect(params.testParam).toBe('this is a test')
      })

      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.once('update', (data) => {
        expect(data.announce).toBe(announceUrl)
        expect(typeof data.complete).toBe('number')
        expect(typeof data.incomplete).toBe('number')

        client.stop()

        client.once('update', () => {
          server.close()
          client.destroy()
          resolve()
        })
      })

      client.start()
    })
  })
}

test('http: client `opts.getAnnounceOpts`', () => testClientGetAnnounceOpts('http'))
test('ws: client `opts.getAnnounceOpts`', () => testClientGetAnnounceOpts('ws'))

function testClientAnnounceWithNumWant(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client1 = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: [announceUrl],
        peerId: peerId1,
        port,
        wrtc: testWrtc,
      })

      client1.on('error', (err) => {
        throw err
      })
      client1.on('warning', (err) => {
        throw err
      })

      client1.start()
      client1.once('update', () => {
        const client2 = new Client({
          infoHash: fixtures.leaves.parsedTorrent.infoHash,
          announce: announceUrl,
          peerId: peerId2,
          port: port + 1,
          wrtc: testWrtc,
        })

        client2.on('error', (err) => {
          throw err
        })
        client2.on('warning', (err) => {
          throw err
        })

        client2.start()
        client2.once('update', () => {
          const client3 = new Client({
            infoHash: fixtures.leaves.parsedTorrent.infoHash,
            announce: announceUrl,
            peerId: peerId3,
            port: port + 2,
            wrtc: testWrtc,
          })

          client3.on('error', (err) => {
            throw err
          })
          client3.on('warning', (err) => {
            throw err
          })

          client3.start({ numwant: 1 })
          client3.on('peer', () => {
            let num = 3
            function tryCloseServer(): void {
              num -= 1
              if (num === 0) server.close()
            }

            client1.stop()
            client1.once('update', () => {
              client1.destroy()
              tryCloseServer()
            })
            client2.stop()
            client2.once('update', () => {
              client2.destroy()
              tryCloseServer()
            })
            client3.stop()
            client3.once('update', () => {
              client3.destroy()
              tryCloseServer()
            })
            resolve()
          })
        })
      })
    })
  })
}

test('http: client announce with numwant', () => testClientAnnounceWithNumWant('http'))
test('udp: client announce with numwant', () => testClientAnnounceWithNumWant('udp'))

test('http: userAgent', () => {
  return new Promise((resolve, reject) => {
    common.createServer('http', (server, announceUrl) => {
      server.http!.on('request', (req) => {
        expect(req.headers['user-agent']?.includes('Z-Torrent')).toBeTruthy()
      })

      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: peerId1,
        port,
        userAgent: 'Z-Torrent/0.98.0 (https://github.com/skrylnikov/z-torrent)',
        wrtc: testWrtc,
      })

      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.once('update', (data) => {
        expect(data.announce).toBe(announceUrl)

        server.close()
        client.destroy()
        resolve()
      })

      client.start()
    })
  })
})

function testSupportedTracker(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: peerId1,
        port,
        wrtc: testWrtc,
      })
      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.start()

      client.once('update', () => {
        server.close()
        client.destroy()
        resolve()
      })
    })
  })
}

test('http: valid tracker port', () => testSupportedTracker('http'))
test('udp: valid tracker port', () => testSupportedTracker('udp'))
test('ws: valid tracker port', () => testSupportedTracker('ws'))

function testUnsupportedTracker(announceUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new Client({
      infoHash: fixtures.leaves.parsedTorrent.infoHash,
      announce: announceUrl,
      peerId: peerId1,
      port,
      wrtc: testWrtc,
    })

    client.on('error', (err) => {
      throw err
    })
    client.on('warning', (err) => {
      expect(err.message.includes('tracker')).toBeTruthy()

      client.destroy()
      resolve()
    })
  })
}

test('unsupported tracker protocol', () =>
  testUnsupportedTracker('badprotocol://127.0.0.1:8080/announce'))
test('http: invalid tracker port', () =>
  testUnsupportedTracker('http://127.0.0.1:69691337/announce'))
test('http: invalid tracker url', () => testUnsupportedTracker('http:'))
test('http: invalid tracker url with slash', () => testUnsupportedTracker('http://'))
test('udp: invalid tracker port', () => testUnsupportedTracker('udp://127.0.0.1:69691337'))
test('udp: invalid tracker url', () => testUnsupportedTracker('udp:'))
test('udp: invalid tracker url with slash', () => testUnsupportedTracker('udp://'))
test('ws: invalid tracker port', () => testUnsupportedTracker('ws://127.0.0.1:69691337'))
test('ws: invalid tracker url', () => testUnsupportedTracker('ws:'))
test('ws: invalid tracker url with slash', () => testUnsupportedTracker('ws://'))

function testClientStartHttpAgent(serverType: 'http' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, function (server, announceUrl) {
      const agent = new http.Agent()
      let agentUsed = false
      agent.createConnection = function (opts, fn) {
        agentUsed = true
        return net.createConnection(opts as net.TcpSocketConnectOpts, fn as () => void)
      }
      const client = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: peerId1,
        port,
        wrtc: testWrtc,
        proxyOpts: {
          httpAgent: agent,
        },
      })

      client.on('error', function (err) {
        throw err
      })
      client.on('warning', function (err) {
        throw err
      })

      client.once('update', function (data) {
        expect(data.announce).toBe(announceUrl)
        expect(typeof data.complete).toBe('number')
        expect(typeof data.incomplete).toBe('number')

        expect(agentUsed).toBeTruthy()

        client.stop()

        client.once('update', function () {
          server.close()
          client.destroy()
          resolve()
        })
      })

      client.start()
    })
  })
}

test.skip('http: client.start(httpAgent)', () => testClientStartHttpAgent('http'))
test.skip('ws: client.start(httpAgent)', () => testClientStartHttpAgent('ws'))

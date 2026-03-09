import Client from '../index.js'
import common from './common.js'
import test from 'tape'
import type { Test } from 'tape'
import type { default as ClientType } from '../client.js'
import type Server from '../server.js'
import wrtc from 'webrtc-polyfill'

const infoHash = '4cb67059ed6bd08362da625b3ae77f6f4a075705'
const peerId = Buffer.from('01234567890123456789')
const peerId2 = Buffer.from('12345678901234567890')
const peerId3 = Buffer.from('23456789012345678901')

function serverTest(
  t: Test,
  serverType: 'http' | 'udp' | 'ws',
  serverFamily: 'inet' | 'inet6'
): void {
  t.plan(40)

  const hostname = serverFamily === 'inet6' ? '[::1]' : '127.0.0.1'
  const clientIp = serverFamily === 'inet6' ? '::1' : '127.0.0.1'

  const opts = {
    serverType,
  }

  common.createServer(t, opts, (server: Server) => {
    const port = server[serverType]!.address().port
    const announceUrl = `${serverType}://${hostname}:${port}/announce`

    const client1: ClientType = new Client({
      infoHash,
      announce: [announceUrl],
      peerId,
      port: 6881,
      wrtc,
    })
    if (serverType === 'ws') common.mockWebsocketTracker(client1)

    client1.start()

    server.once('start', () => {
      t.pass('got start message from client1')
    })

    client1.once('update', (data) => {
      t.equal(data.announce, announceUrl)
      t.equal(data.complete, 0)
      t.equal(data.incomplete, 1)

      server.getSwarm(
        infoHash,
        (
          err: Error | null,
          swarm: Server extends {
            getSwarm: (a: any, cb: (e: Error | null, s: infer S) => void) => void
          }
            ? S
            : never
        ) => {
          t.error(err)

          t.equal(Object.keys(server.torrents).length, 1)
          t.equal(swarm!.complete, 0)
          t.equal(swarm!.incomplete, 1)
          t.equal(swarm!.peers.length, 1)

          const id = serverType === 'ws' ? peerId.toString('hex') : `${hostname}:6881`

          const peer = swarm!.peers.peek(id)
          t.equal(peer!.type, serverType)
          t.equal(peer!.ip, clientIp)
          t.equal(peer!.peerId, peerId.toString('hex'))
          t.equal(peer!.complete, false)
          if (serverType === 'ws') {
            t.equal(typeof peer!.port, 'number')
            t.ok(peer!.socket)
          } else {
            t.equal(peer!.port, 6881)
            t.notOk(peer!.socket)
          }

          client1.complete()

          client1.once('update', (data) => {
            t.equal(data.announce, announceUrl)
            t.equal(data.complete, 1)
            t.equal(data.incomplete, 0)

            client1.scrape()

            client1.once('scrape', (data) => {
              t.equal(data.announce, announceUrl)
              t.equal(data.complete, 1)
              t.equal(data.incomplete, 0)
              t.equal(typeof data.downloaded, 'number')

              const client2: ClientType = new Client({
                infoHash,
                announce: [announceUrl],
                peerId: peerId2,
                port: 6882,
                wrtc,
              })
              if (serverType === 'ws') common.mockWebsocketTracker(client2)

              client2.start()

              server.once('start', () => {
                t.pass('got start message from client2')
              })

              client2.once('update', (data) => {
                t.equal(data.announce, announceUrl)
                t.equal(data.complete, 1)
                t.equal(data.incomplete, 1)

                const client3: ClientType = new Client({
                  infoHash,
                  announce: [announceUrl],
                  peerId: peerId3,
                  port: 6880,
                  wrtc,
                })
                if (serverType === 'ws') common.mockWebsocketTracker(client3)

                client3.start()

                server.once('start', () => {
                  t.pass('got start message from client3')
                })

                client3.once('update', (data) => {
                  t.equal(data.announce, announceUrl)
                  t.equal(data.complete, 1)
                  t.equal(data.incomplete, 2)

                  client2.stop()
                  client2.once('update', (data) => {
                    t.equal(data.announce, announceUrl)
                    t.equal(data.complete, 1)
                    t.equal(data.incomplete, 1)

                    client2.destroy(() => {
                      t.pass('client2 destroyed')
                      client3.stop()
                      client3.once('update', (data) => {
                        t.equal(data.announce, announceUrl)
                        t.equal(data.complete, 1)
                        t.equal(data.incomplete, 0)

                        client1.destroy(() => {
                          t.pass('client1 destroyed')
                        })

                        client3.destroy(() => {
                          t.pass('client3 destroyed')
                        })

                        server.close(() => {
                          t.pass('server destroyed')
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        }
      )
    })
  })
}

test('http ipv4 server', (t: Test) => {
  serverTest(t, 'http', 'inet')
})

test('http ipv6 server', (t: Test) => {
  serverTest(t, 'http', 'inet6')
})

test('udp server', (t: Test) => {
  serverTest(t, 'udp', 'inet')
})

test('ws server', (t: Test) => {
  serverTest(t, 'ws', 'inet')
})

import { Client } from '../src/index.js'
import type { Server } from '../src/server.js'
import common from './common.js'
import { testWrtc } from './helpers.js'

const infoHash = '4cb67059ed6bd08362da625b3ae77f6f4a075705'
const peerId = Buffer.from('01234567890123456789')
const peerId2 = Buffer.from('12345678901234567890')
const peerId3 = Buffer.from('23456789012345678901')

function serverTest(
  serverType: 'http' | 'udp' | 'ws',
  serverFamily: 'inet' | 'inet6'
): Promise<void> {
  const hostname = serverFamily === 'inet6' ? '[::1]' : '127.0.0.1'
  const clientIp = serverFamily === 'inet6' ? '::1' : '127.0.0.1'

  const opts = {
    serverType,
    serverFamily,
  }

  return new Promise((resolve, reject) => {
    common.createServer(opts, (server: Server, _announceUrl) => {
      const port = server[serverType]!.address().port
      const announceUrl =
        serverType === 'udp'
          ? `${serverType}://${hostname}:${port}`
          : `${serverType}://${hostname}:${port}/announce`

      const client1: InstanceType<typeof Client> = new Client({
        infoHash,
        announce: [announceUrl],
        peerId,
        port: 6881,
        wrtc: testWrtc,
      })
      client1.start()

      server.once('start', () => {})

      client1.once('update', (data) => {
        expect(data.announce).toBe(announceUrl)
        expect(data.complete).toBe(0)
        expect(data.incomplete).toBe(1)

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
            if (err) throw err

            expect(Object.keys(server.torrents).length).toBe(1)
            expect(swarm!.complete).toBe(0)
            expect(swarm!.incomplete).toBe(1)
            expect(swarm!.peers.length).toBe(1)

            const id = serverType === 'ws' ? peerId.toString('hex') : `${hostname}:6881`

            const peer = swarm!.peers.peek(id)
            expect(peer!.type).toBe(serverType)
            expect(peer!.ip).toBe(clientIp)
            expect(peer!.peerId).toBe(peerId.toString('hex'))
            expect(peer!.complete).toBe(false)
            if (serverType === 'ws') {
              expect(typeof peer!.port).toBe('number')
              expect(peer!.socket).toBeTruthy()
            } else {
              expect(peer!.port).toBe(6881)
              expect(peer!.socket).toBeFalsy()
            }

            client1.complete()

            client1.once('update', (data) => {
              expect(data.announce).toBe(announceUrl)
              expect(data.complete).toBe(1)
              expect(data.incomplete).toBe(0)

              client1.scrape()

              client1.once('scrape', (data) => {
                expect(data.announce).toBe(announceUrl)
                expect(data.complete).toBe(1)
                expect(data.incomplete).toBe(0)
                expect(typeof data.downloaded).toBe('number')

                const client2: InstanceType<typeof Client> = new Client({
                  infoHash,
                  announce: [announceUrl],
                  peerId: peerId2,
                  port: 6882,
                  wrtc: testWrtc,
                })
                client2.start()

                server.once('start', () => {})

                client2.once('update', (data) => {
                  expect(data.announce).toBe(announceUrl)
                  expect(data.complete).toBe(1)
                  expect(data.incomplete).toBe(1)

                  const client3: InstanceType<typeof Client> = new Client({
                    infoHash,
                    announce: [announceUrl],
                    peerId: peerId3,
                    port: 6880,
                    wrtc: testWrtc,
                  })
                  client3.start()

                  server.once('start', () => {})

                  client3.once('update', (data) => {
                    expect(data.announce).toBe(announceUrl)
                    expect(data.complete).toBe(1)
                    expect(data.incomplete).toBe(2)

                    client2.stop()
                    client2.once('update', (data) => {
                      expect(data.announce).toBe(announceUrl)
                      expect(data.complete).toBe(1)
                      expect(data.incomplete).toBe(1)

                      client2.destroy(() => {
                        client3.stop()
                        client3.once('update', (data) => {
                          expect(data.announce).toBe(announceUrl)
                          expect(data.complete).toBe(1)
                          expect(data.incomplete).toBe(0)

                          client1.destroy(() => {})

                          client3.destroy(() => {})

                          server.close(() => {
                            resolve()
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
  })
}

test('http ipv4 server', () => serverTest('http', 'inet'))
test.skip('http ipv6 server', () => serverTest('http', 'inet6'))
test('udp server', () => serverTest('udp', 'inet'))
test('ws server', () => serverTest('ws', 'inet'))

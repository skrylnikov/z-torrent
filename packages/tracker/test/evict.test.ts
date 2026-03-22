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

  const opts: { serverType: 'http' | 'udp' | 'ws'; peersCacheLength?: number; serverFamily?: string } =
    {
      serverType,
      peersCacheLength: 2,
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

      client1.once('update', () => {
        const client2: InstanceType<typeof Client> = new Client({
          infoHash,
          announce: [announceUrl],
          peerId: peerId2,
          port: 6882,
          wrtc: testWrtc,
        })
        client2.start()

        client2.once('update', () => {
          server.getSwarm(infoHash, (err: Error | null, swarm) => {
            if (err) throw err

            expect(swarm!.complete + swarm!.incomplete).toBe(2)

            let evicted = false
            swarm!.peers.once('evict', (evictedPeer: { value: { peerId: string } }) => {
              expect(evictedPeer.value.peerId).toBe(peerId.toString('hex'))
              expect(swarm!.complete + swarm!.incomplete).toBe(2)
              evicted = true
            })

            const client3: InstanceType<typeof Client> = new Client({
              infoHash,
              announce: [announceUrl],
              peerId: peerId3,
              port: 6880,
              wrtc: testWrtc,
            })
            client3.start()

            client3.once('update', () => {
              expect(evicted).toBeTruthy()
              expect(swarm!.complete + swarm!.incomplete).toBe(2)

              client1.destroy(() => {})

              client2.destroy(() => {})

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
}

test('evict: ipv4 server', () => serverTest('http', 'inet'))
test.skip('evict: http ipv6 server', () => serverTest('http', 'inet6'))
test('evict: udp server', () => serverTest('udp', 'inet'))
test('evict: ws server', () => serverTest('ws', 'inet'))

import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { WebTorrent } from '../../dist/index.js'

test('extension support', async () => {
  let extendedHandshakes = 0
  let client1: any
  let client2: any
  let done: () => void

  class Extension {
    constructor(wire: any) {
      wire.extendedHandshake.test = 'Hello, World!'
    }

    onExtendedHandshake(extendedHandshake: any) {
      extendedHandshakes += 1

      expect(Buffer.from(extendedHandshake.test).toString()).toBe('Hello, World!')

      if (extendedHandshakes === 2) {
        let destroyed = 0
        const maybeDone = () => {
          if (++destroyed === 2) done()
        }
        client1.destroy((err: Error) => {
          if (err) throw err
          maybeDone()
        })
        client2.destroy((err: Error) => {
          if (err) throw err
          maybeDone()
        })
      }
    }
  }

  ;(Extension as any).prototype.name = 'wt_test'

  await new Promise<void>((resolve) => {
    done = resolve
    client1 = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client1.on('error', (err) => {
    throw err
  })
  client1.on('warning', (err) => {
    throw err
  })

  client2 = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client2.on('error', (err) => {
    throw err
  })
  client2.on('warning', (err) => {
    throw err
  })

    client1.add(fixtures.leaves.parsedTorrent, (torrent1: any) => {
      torrent1.on('wire', (wire: any) => {
        wire.use(Extension)
      })
      const torrent2 = client2.add(fixtures.leaves.parsedTorrent.infoHash)
      torrent2.on('wire', (wire: any) => {
        wire.use(Extension)
      })
      torrent2.on('infoHash', () => {
        torrent2.addPeer(`127.0.0.1:${client1.address().port}`)
      })
    })
  })
})

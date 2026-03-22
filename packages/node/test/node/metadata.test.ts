import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../../dist/index.js'

test('ut_metadata transfer', async () => {
  const client1 = new ZTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })
  const client2 = new ZTorrent({
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

  client2.on('error', (err) => {
    throw err
  })
  client2.on('warning', (err) => {
    throw err
  })

  client1.on('torrent', (torrent: any) => {
    expect(torrent.metadata).toBeTruthy()
  })

  client1.add(fixtures.leaves.torrent)

  await new Promise<void>((resolve, reject) => {
    client1.on('torrent', (torrent1: any) => {
      fixtures.leaves.parsedTorrent.info.name = new Uint8Array(
        fixtures.leaves.parsedTorrent.info.name
      )
      fixtures.leaves.parsedTorrent.info.pieces = new Uint8Array(
        fixtures.leaves.parsedTorrent.info.pieces
      )
      expect(torrent1.info).toEqual(fixtures.leaves.parsedTorrent.info)

      const torrent2 = client2.add(fixtures.leaves.parsedTorrent.infoHash)

      torrent2.on('infoHash', () => {
        torrent2.addPeer(`127.0.0.1:${client1.address().port}`)

        client2.on('torrent', () => {
          expect(torrent1.info).toEqual(torrent2.info)

          client1.destroy((err) => {
            if (err) reject(err)
          })
          client2.destroy((err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      })
    })
  })
})

// @ts-expect-error - no types available
import fixtures from 'webtorrent-fixtures'
import { test, expect } from 'bun:test'
import WebTorrent from '../dist/index.js'

test('client.seed followed by duplicate client.add (sync)', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })
  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    client.seed(
      fixtures.leaves.content,
      {
        name: 'Leaves of Grass by Walt Whitman.epub',
        announce: [],
      },
      (torrent1) => {
        expect(client.torrents.length).toBe(1)

        const torrent2 = client.add(torrent1.infoHash)

        torrent2.once('ready', () => {
          throw new Error('torrent ready is not called')
        })

        torrent2.once('error', (err) => {
          expect(err).toBeTruthy()
          expect(client.torrents.length).toBe(1)
          expect(torrent2.destroyed).toBeTruthy()
          client.destroy((err) => {
            if (err) reject(err)
            expect(client.torrents.length).toBe(0)
            resolve()
          })
        })
      }
    )
  })
})

test('client.seed followed by duplicate client.add (async)', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })
  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    client.seed(
      fixtures.leaves.content,
      {
        name: 'Leaves of Grass by Walt Whitman.epub',
        announce: [],
      },
      (torrent1) => {
        expect(client.torrents.length).toBe(1)

        const torrent2 = client.add(fixtures.leaves.torrentPath)

        torrent2.once('ready', () => {
          throw new Error('torrent ready is not called')
        })

        torrent2.once('error', (err) => {
          expect(err).toBeTruthy()
          expect(client.torrents.length).toBe(1)
          expect(torrent2.destroyed).toBeTruthy()
          client.destroy((err) => {
            if (err) reject(err)
            expect(client.torrents.length).toBe(0)
            resolve()
          })
        })
      }
    )
  })
})

test('client.seed followed by two duplicate client.add calls (sync)', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })
  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    client.seed(
      fixtures.leaves.content,
      {
        name: 'Leaves of Grass by Walt Whitman.epub',
        announce: [],
      },
      (torrent1) => {
        expect(client.torrents.length).toBe(1)

        const torrent2 = client.add(torrent1.infoHash)

        torrent2.once('ready', () => {
          throw new Error('torrent ready is not called')
        })

        torrent2.once('error', (err) => {
          expect(err).toBeTruthy()
          expect(client.torrents.length).toBe(1)
          expect(torrent2.destroyed).toBeTruthy()

          const torrent3 = client.add(torrent1.infoHash)

          torrent3.once('ready', () => {
            throw new Error('torrent ready is not called')
          })

          torrent3.once('error', (err) => {
            expect(err).toBeTruthy()
            expect(client.torrents.length).toBe(1)
            expect(torrent3.destroyed).toBeTruthy()
            client.destroy((err) => {
              if (err) reject(err)
              expect(client.torrents.length).toBe(0)
              resolve()
            })
          })
        })
      }
    )
  })
})

test('client.seed followed by two duplicate client.add calls (async)', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })
  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    client.seed(
      fixtures.leaves.content,
      {
        name: 'Leaves of Grass by Walt Whitman.epub',
        announce: [],
      },
      (torrent1) => {
        expect(client.torrents.length).toBe(1)

        const torrent2 = client.add(fixtures.leaves.torrentPath)

        torrent2.once('ready', () => {
          throw new Error('torrent ready is not called')
        })

        torrent2.once('error', (err) => {
          expect(err).toBeTruthy()
          expect(client.torrents.length).toBe(1)
          expect(torrent2.destroyed).toBeTruthy()

          const torrent3 = client.add(fixtures.leaves.torrentPath)

          torrent3.once('ready', () => {
            throw new Error('torrent ready is not called')
          })

          torrent3.once('error', (err) => {
            expect(err).toBeTruthy()
            expect(client.torrents.length).toBe(1)
            expect(torrent3.destroyed).toBeTruthy()
            client.destroy((err) => {
              if (err) reject(err)
              expect(client.torrents.length).toBe(0)
              resolve()
            })
          })
        })
      }
    )
  })
})

test('successive sync client.add, client.remove, client.add, client.remove (sync)', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })
  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    client.seed(
      fixtures.leaves.content,
      {
        name: 'Leaves of Grass by Walt Whitman.epub',
        announce: [],
      },
      (torrent1) => {
        expect(client.torrents.length).toBe(1)

        client.remove(torrent1.infoHash, () => {
          client.add(torrent1.infoHash)
          client.remove(torrent1.infoHash, () => {
            client.destroy((err) => {
              if (err) reject(err)
              expect(client.torrents.length).toBe(0)
              resolve()
            })
          })
        })
      }
    )
  })
})

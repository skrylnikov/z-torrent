// @ts-expect-error - no types available
import fixtures from 'webtorrent-fixtures'
import { test, expect } from 'bun:test'
import WebTorrent from '../dist/index.js'

test('client.add: magnet uri, utf-8 string', async () => {
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

  const torrent = client.add(fixtures.leaves.magnetURI)
  expect(client.torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', async () => {
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)
      expect(torrent.magnetURI).toBe(fixtures.leaves.magnetURI)

      await new Promise<void>((res, rej) =>
        client.remove(fixtures.leaves.magnetURI, (err) => {
          if (err) rej(err)
          else res()
        })
      )
      expect(client.torrents.length).toBe(0)

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test('client.add: torrent file, buffer', async () => {
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

  const torrent = client.add(fixtures.leaves.torrent)
  expect(client.torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', async () => {
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)
      expect(torrent.magnetURI).toBe(fixtures.leaves.magnetURI)

      await new Promise<void>((res, rej) =>
        client.remove(fixtures.leaves.torrent, (err) => {
          if (err) rej(err)
          else res()
        })
      )
      expect(client.torrents.length).toBe(0)

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test('client.add: info hash, hex string', async () => {
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

  const torrent = client.add(fixtures.leaves.parsedTorrent.infoHash)
  expect(client.torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', async () => {
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)
      expect(torrent.magnetURI).toBe(
        `magnet:?xt=urn:btih:${fixtures.leaves.parsedTorrent.infoHash}`
      )

      await new Promise<void>((res, rej) =>
        client.remove(fixtures.leaves.parsedTorrent.infoHash, (err) => {
          if (err) rej(err)
          else res()
        })
      )
      expect(client.torrents.length).toBe(0)

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test('client.add: info hash, buffer', async () => {
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

  const torrent = client.add(fixtures.leaves.parsedTorrent.infoHashBuffer)
  expect(client.torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', async () => {
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)
      expect(
        torrent.magnetURI.indexOf(
          `magnet:?xt=urn:btih:${fixtures.leaves.parsedTorrent.infoHash}`
        ) === 0
      ).toBeTruthy()

      await new Promise<void>((res, rej) =>
        client.remove(Buffer.from(fixtures.leaves.parsedTorrent.infoHash, 'hex'), (err) => {
          if (err) rej(err)
          else res()
        })
      )
      expect(client.torrents.length).toBe(0)

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test('client.add: parsed torrent, from `parse-torrent`', async () => {
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

  const torrent = client.add(fixtures.leaves.parsedTorrent)
  expect(client.torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', async () => {
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)
      expect(torrent.magnetURI).toBe(fixtures.leaves.magnetURI)

      await new Promise<void>((res, rej) =>
        client.remove(fixtures.leaves.parsedTorrent, (err) => {
          if (err) rej(err)
          else res()
        })
      )
      expect(client.torrents.length).toBe(0)

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test('client.add: parsed torrent, with string type announce property', async () => {
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

  const parsedTorrent = Object.assign({}, fixtures.leaves.parsedTorrent)
  parsedTorrent.announce = 'http://tracker.local:80'

  const torrent = client.add(parsedTorrent)
  expect(client.torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', async () => {
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)

      const expectedMagnetURI = `${fixtures.leaves.magnetURI}&tr=${encodeURIComponent('http://tracker.local:80')}`
      expect(torrent.magnetURI).toBe(expectedMagnetURI)
      expect(torrent.announce).toEqual(['http://tracker.local:80'])

      await new Promise<void>((res, rej) =>
        client.remove(fixtures.leaves.parsedTorrent, (err) => {
          if (err) rej(err)
          else res()
        })
      )
      expect(client.torrents.length).toBe(0)

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test('client.add: parsed torrent, with array type announce property', async () => {
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

  const parsedTorrent = Object.assign({}, fixtures.leaves.parsedTorrent)
  parsedTorrent.announce = ['http://tracker.local:80', 'http://tracker.local:81']

  const torrent = client.add(parsedTorrent)
  expect(client.torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', async () => {
      expect(torrent.infoHash).toBe(fixtures.leaves.parsedTorrent.infoHash)

      const expectedMagnetURI = `${fixtures.leaves.magnetURI}&tr=${encodeURIComponent('http://tracker.local:80')}&tr=${encodeURIComponent('http://tracker.local:81')}`
      expect(torrent.magnetURI).toBe(expectedMagnetURI)
      expect(torrent.announce).toEqual(['http://tracker.local:80', 'http://tracker.local:81'])

      await new Promise<void>((res, rej) =>
        client.remove(fixtures.leaves.parsedTorrent, (err) => {
          if (err) rej(err)
          else res()
        })
      )
      expect(client.torrents.length).toBe(0)

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

test('client.add: invalid torrent id: empty string', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    client.on('error', (err) => {
      expect(err instanceof Error).toBeTruthy()
      expect(err.message.includes('Invalid torrent identifier')).toBeTruthy()

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    client.add('')
  })
})

test('client.add: invalid torrent id: short buffer', async () => {
  const client = new WebTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    natUpnp: false,
    natPmp: false,
  })

  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    client.on('error', (err) => {
      expect(err instanceof Error).toBeTruthy()
      expect(err.message.includes('Invalid torrent identifier')).toBeTruthy()

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    client.add(Buffer.from('abc'))
  })
})

test('client.add: paused torrent', async () => {
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

  const torrent = client.add(fixtures.leaves.magnetURI, { paused: true })
  expect(client.torrents.length).toBe(1)

  await new Promise<void>((resolve, reject) => {
    torrent.on('infoHash', async () => {
      expect(torrent.paused).toBe(true)

      await new Promise<void>((res, rej) =>
        client.remove(fixtures.leaves.magnetURI, (err) => {
          if (err) rej(err)
          else res()
        })
      )
      expect(client.torrents.length).toBe(0)

      client.destroy((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
})

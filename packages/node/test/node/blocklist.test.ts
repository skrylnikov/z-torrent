import fs from 'fs'
import http from 'http'
import zlib from 'zlib'
import { fixtures } from '@z-torrent/fixtures'
import { test, expect } from 'bun:test'
import { ZTorrent } from '../../dist/index.js'

function assertBlocked(torrent: any, addr: string) {
  return new Promise<void>((resolve) => {
    torrent.once('blockedPeer', (_addr: string) => {
      expect(addr).toBe(_addr)
      resolve()
    })
    expect(torrent.addPeer(addr)).toBeFalsy()
  })
}

function assertReachable(torrent: any, addr: string) {
  return new Promise<void>((resolve) => {
    torrent.once('peer', (_addr: string) => {
      expect(addr).toBe(_addr)
      resolve()
    })
    expect(torrent.addPeer(addr)).toBeTruthy()
  })
}

test('blocklist (single IP)', async () => {
  const client = new ZTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    blocklist: ['1.2.3.4'],
  })
  client.on('error', (err) => {
    throw err
  })
  client.on('warning', (err) => {
    throw err
  })

  await new Promise<void>((resolve, reject) => {
    client.on('ready', () => {
      client.add(fixtures.leaves.parsedTorrent, async (torrent) => {
        await assertBlocked(torrent, '1.2.3.4:1234')
        await assertBlocked(torrent, '1.2.3.4:6969')
        await assertReachable(torrent, '1.1.1.1:1234')
        await assertReachable(torrent, '1.1.1.1:6969')

        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

test('blocklist (array of IPs)', async () => {
  const client = new ZTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    blocklist: ['1.2.3.4', '5.6.7.8'],
  })
    .on('error', (err) => {
      throw err
    })
    .on('warning', (err) => {
      throw err
    })

  await new Promise<void>((resolve, reject) => {
    client.on('ready', () => {
      client.add(fixtures.leaves.parsedTorrent, async (torrent) => {
        await assertBlocked(torrent, '1.2.3.4:1234')
        await assertBlocked(torrent, '1.2.3.4:6969')
        await assertBlocked(torrent, '5.6.7.8:1234')
        await assertBlocked(torrent, '5.6.7.8:6969')
        await assertReachable(torrent, '1.1.1.1:1234')
        await assertReachable(torrent, '1.1.1.1:6969')

        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

function assertList(torrent: any) {
  return (async () => {
    await assertBlocked(torrent, '1.2.3.0:1234')
    await assertBlocked(torrent, '1.2.3.0:6969')
    await assertBlocked(torrent, '1.2.3.1:1234')
    await assertBlocked(torrent, '1.2.3.1:6969')
    await assertBlocked(torrent, '1.2.3.254:1234')
    await assertBlocked(torrent, '1.2.3.254:6969')
    await assertBlocked(torrent, '1.2.3.255:1234')
    await assertBlocked(torrent, '1.2.3.255:6969')
    await assertBlocked(torrent, '5.6.7.0:1234')
    await assertBlocked(torrent, '5.6.7.0:6969')
    await assertBlocked(torrent, '5.6.7.128:1234')
    await assertBlocked(torrent, '5.6.7.128:6969')
    await assertBlocked(torrent, '5.6.7.255:1234')
    await assertBlocked(torrent, '5.6.7.255:6969')
    await assertReachable(torrent, '1.1.1.1:1234')
    await assertReachable(torrent, '1.1.1.1:6969')
    await assertReachable(torrent, '2.2.2.2:1234')
    await assertReachable(torrent, '2.2.2.2:6969')
    await assertReachable(torrent, '1.2.4.0:1234')
    await assertReachable(torrent, '1.2.4.0:6969')
    await assertReachable(torrent, '1.2.2.0:1234')
    await assertReachable(torrent, '1.2.2.0:6969')
  })()
}

test('blocklist (array of IP ranges)', async () => {
  const client = new ZTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    blocklist: [
      { start: '1.2.3.0', end: '1.2.3.255' },
      { start: '5.6.7.0', end: '5.6.7.255' },
    ],
  })
    .on('error', (err) => {
      throw err
    })
    .on('warning', (err) => {
      throw err
    })

  await new Promise<void>((resolve, reject) => {
    client.on('ready', () => {
      client.add(fixtures.leaves.parsedTorrent, async (torrent) => {
        await assertList(torrent)
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

test('blocklist (http url)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.headers['user-agent']?.includes('Z-Torrent')).toBeTruthy()
    fs.createReadStream(fixtures.blocklist.path).pipe(res)
  })

  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port
      const url = `http://127.0.0.1:${port}`
      const client = new ZTorrent({
        dht: false,
        tracker: false,
        lsd: false,
        blocklist: url,
      })
        .on('error', (err) => {
          throw err
        })
        .on('warning', (err) => {
          throw err
        })
        .on('ready', () => {
          client.add(fixtures.leaves.parsedTorrent, async (torrent) => {
            await assertList(torrent)
            client.destroy((err) => {
              if (err) reject(err)
            })
            server.close(() => {
              resolve()
            })
          })
        })
    })
  })
})

test('blocklist (http url with gzip encoding)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.headers['user-agent']?.includes('Z-Torrent')).toBeTruthy()
    res.setHeader('content-encoding', 'gzip')
    fs.createReadStream(fixtures.blocklist.path).pipe(zlib.createGzip()).pipe(res)
  })

  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port
      const url = `http://127.0.0.1:${port}`
      const client = new ZTorrent({
        dht: false,
        tracker: false,
        lsd: false,
        blocklist: url,
      })
        .on('error', (err) => {
          throw err
        })
        .on('warning', (err) => {
          throw err
        })
        .on('ready', () => {
          client.add(fixtures.leaves.parsedTorrent, async (torrent) => {
            await assertList(torrent)
            client.destroy((err) => {
              if (err) reject(err)
            })
            server.close(() => {
              resolve()
            })
          })
        })
    })
  })
})

test('blocklist (http url with deflate encoding)', async () => {
  const server = http.createServer((req, res) => {
    expect(req.headers['user-agent']?.includes('Z-Torrent')).toBeTruthy()
    res.setHeader('content-encoding', 'deflate')
    fs.createReadStream(fixtures.blocklist.path).pipe(zlib.createDeflate()).pipe(res)
  })

  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port
      const url = `http://127.0.0.1:${port}`
      const client = new ZTorrent({
        dht: false,
        tracker: false,
        lsd: false,
        blocklist: url,
      })
        .on('error', (err) => {
          throw err
        })
        .on('warning', (err) => {
          throw err
        })
        .on('ready', () => {
          client.add(fixtures.leaves.parsedTorrent, async (torrent) => {
            await assertList(torrent)
            client.destroy((err) => {
              if (err) reject(err)
            })
            server.close(() => {
              resolve()
            })
          })
        })
    })
  })
})

test('blocklist (fs path)', async () => {
  const client = new ZTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    blocklist: fixtures.blocklist.path,
  })
    .on('error', (err) => {
      throw err
    })
    .on('warning', (err) => {
      throw err
    })

  await new Promise<void>((resolve, reject) => {
    client.on('ready', () => {
      client.add(fixtures.leaves.parsedTorrent, async (torrent) => {
        await assertList(torrent)
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

test('blocklist (fs path with gzip)', async () => {
  const client = new ZTorrent({
    dht: false,
    tracker: false,
    lsd: false,
    blocklist: fixtures.blocklist.gzipPath,
  })
    .on('error', (err) => {
      throw err
    })
    .on('warning', (err) => {
      throw err
    })

  await new Promise<void>((resolve, reject) => {
    client.on('ready', () => {
      client.add(fixtures.leaves.parsedTorrent, async (torrent) => {
        await assertList(torrent)
        client.destroy((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    })
  })
})

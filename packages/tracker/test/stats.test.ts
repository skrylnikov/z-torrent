import { Client } from '../src/index.js'
import commonTest from './common.js'
import { fixtures } from '@z-torrent/fixtures'

const peerId = Buffer.from('-WW0091-4ea5886ce160')
const unknownPeerId = Buffer.from('01234567890123456789')

interface StatsResult {
  torrents: number | null
  activeTorrents: number | null
  peersAll: number | null
  peersSeederOnly: number | null
  peersLeecherOnly: number | null
  peersSeederAndLeecher: number | null
  peersIPv4: number | null
  peersIPv6: number | null
}

function parseHtml(html: string): StatsResult {
  const extractValue = /[^v^h](\d+)/
  const array = html
    .replace('torrents', '\n')
    .split('\n')
    .filter((line) => line && line.trim().length > 0)
    .map((line) => {
      const a = extractValue.exec(line)
      if (a) {
        return parseInt(a[1])
      }
      return null
    })
  let i = 0
  return {
    torrents: array[i++],
    activeTorrents: array[i++],
    peersAll: array[i++],
    peersSeederOnly: array[i++],
    peersLeecherOnly: array[i++],
    peersSeederAndLeecher: array[i++],
    peersIPv4: array[i++],
    peersIPv6: array[i],
  }
}

test('server: get empty stats', async () => {
  return new Promise((resolve, reject) => {
    commonTest.createServer('http', async (server, announceUrl) => {
      const url = announceUrl.replace('/announce', '/stats')

      const res = await fetch(url)
      const data = Buffer.from(await res.arrayBuffer())

      const stats = parseHtml(data.toString())
      expect(res.status).toBe(200)
      expect(stats.torrents).toBe(0)
      expect(stats.activeTorrents).toBe(0)
      expect(stats.peersAll).toBe(0)
      expect(stats.peersSeederOnly).toBe(0)
      expect(stats.peersLeecherOnly).toBe(0)
      expect(stats.peersSeederAndLeecher).toBe(0)
      expect(stats.peersIPv4).toBe(0)
      expect(stats.peersIPv6).toBe(0)

      server.close(() => {
        resolve()
      })
    })
  })
})

test('server: get empty stats with json header', async () => {
  return new Promise((resolve, reject) => {
    commonTest.createServer('http', async (server, announceUrl) => {
      const opts = {
        headers: {
          accept: 'application/json',
        },
      }
      const res = await fetch(announceUrl.replace('/announce', '/stats'), opts)
      const stats = (await res.json()) as StatsResult

      expect(res.status).toBe(200)
      expect(stats.torrents).toBe(0)
      expect(stats.activeTorrents).toBe(0)
      expect(stats.peersAll).toBe(0)
      expect(stats.peersSeederOnly).toBe(0)
      expect(stats.peersLeecherOnly).toBe(0)
      expect(stats.peersSeederAndLeecher).toBe(0)
      expect(stats.peersIPv4).toBe(0)
      expect(stats.peersIPv6).toBe(0)

      server.close(() => {
        resolve()
      })
    })
  })
})

test('server: get empty stats on stats.json', async () => {
  return new Promise((resolve, reject) => {
    commonTest.createServer('http', async (server, announceUrl) => {
      const res = await fetch(announceUrl.replace('/announce', '/stats.json'))
      const stats = (await res.json()) as StatsResult

      expect(res.status).toBe(200)
      expect(stats.torrents).toBe(0)
      expect(stats.activeTorrents).toBe(0)
      expect(stats.peersAll).toBe(0)
      expect(stats.peersSeederOnly).toBe(0)
      expect(stats.peersLeecherOnly).toBe(0)
      expect(stats.peersSeederAndLeecher).toBe(0)
      expect(stats.peersIPv4).toBe(0)
      expect(stats.peersIPv6).toBe(0)

      server.close(() => {
        resolve()
      })
    })
  })
})

test('server: get leecher stats.json', () => {
  return new Promise((resolve, reject) => {
    commonTest.createServer('http', (server, announceUrl) => {
      const client: InstanceType<typeof Client> = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId,
        port: 6881,
      })
      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.start()

      server.once('start', async () => {
        const res = await fetch(announceUrl.replace('/announce', '/stats.json'))
        const stats = (await res.json()) as any

        expect(res.status).toBe(200)
        expect(stats.torrents).toBe(1)
        expect(stats.activeTorrents).toBe(1)
        expect(stats.peersAll).toBe(1)
        expect(stats.peersSeederOnly).toBe(0)
        expect(stats.peersLeecherOnly).toBe(1)
        expect(stats.peersSeederAndLeecher).toBe(0)
        expect(stats.clients.WebTorrent['0.91']).toBe(1)

        client.destroy(() => {
          server.close(() => {
            resolve()
          })
        })
      })
    })
  })
})

test('server: get leecher stats.json (unknown peerId)', () => {
  return new Promise((resolve, reject) => {
    commonTest.createServer('http', (server, announceUrl) => {
      const client: InstanceType<typeof Client> = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId: unknownPeerId,
        port: 6881,
      })
      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.start()

      server.once('start', async () => {
        const res = await fetch(announceUrl.replace('/announce', '/stats.json'))
        const stats = (await res.json()) as any

        expect(res.status).toBe(200)
        expect(stats.torrents).toBe(1)
        expect(stats.activeTorrents).toBe(1)
        expect(stats.peersAll).toBe(1)
        expect(stats.peersSeederOnly).toBe(0)
        expect(stats.peersLeecherOnly).toBe(1)
        expect(stats.peersSeederAndLeecher).toBe(0)
        expect(stats.clients.unknown['01234567']).toBe(1)

        client.destroy(() => {
          server.close(() => {
            resolve()
          })
        })
      })
    })
  })
})

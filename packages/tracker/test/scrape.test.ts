import bencode from 'bencode'
import { Client } from '../src/index.js'
import common from './common.js'
import * as commonLib from '../src/common.js'
import { fixtures } from '@z-torrent/fixtures'
import { hex2bin } from 'uint8-util'

import { testWrtc } from './helpers.js'

const peerId = Buffer.from('01234567890123456789')

function testSingle(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client: InstanceType<typeof Client> = new Client({
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        announce: announceUrl,
        peerId,
        port: 6881,
        wrtc: testWrtc,
      })
      client.on('error', (err) => {
        throw err
      })
      client.on('warning', (err) => {
        throw err
      })

      client.scrape()

      client.on('scrape', (data) => {
        expect(data.announce).toBe(announceUrl)
        expect(data.infoHash).toEqual(fixtures.leaves.parsedTorrent.infoHash)
        expect(typeof data.complete).toBe('number')
        expect(typeof data.incomplete).toBe('number')
        expect(typeof data.downloaded).toBe('number')
        client.destroy()
        server.close(() => {
          resolve()
        })
      })
    })
  })
}

test('http: single info_hash scrape', () => testSingle('http'))
test('udp: single info_hash scrape', () => testSingle('udp'))
test('ws: single info_hash scrape', () => testSingle('ws'))

function clientScrapeStatic(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      const client = Client.scrape(
        {
          announce: announceUrl,
          infoHash: fixtures.leaves.parsedTorrent.infoHash,
          wrtc: testWrtc,
        },
        (err, data) => {
          if (err) throw err
          expect(data!.announce).toBe(announceUrl)
          expect(data!.infoHash).toEqual(fixtures.leaves.parsedTorrent.infoHash)
          expect(typeof data!.complete).toBe('number')
          expect(typeof data!.incomplete).toBe('number')
          expect(typeof data!.downloaded).toBe('number')
          server.close(() => {
            resolve()
          })
        }
      )
    })
  })
}

test('http: scrape using Client.scrape static method', () => clientScrapeStatic('http'))
test('udp: scrape using Client.scrape static method', () => clientScrapeStatic('udp'))
test('ws: scrape using Client.scrape static method', () => clientScrapeStatic('ws'))

function clientScrapeStaticInvalid(serverType: 'http' | 'udp' | 'ws'): Promise<void> {
  return new Promise((resolve, reject) => {
    let announceUrl = `${serverType}://invalid.lol`
    if (serverType === 'http') announceUrl += '/announce'

    const client = Client.scrape(
      {
        announce: announceUrl,
        infoHash: fixtures.leaves.parsedTorrent.infoHash,
        wrtc: testWrtc,
      },
      (err) => {
        expect(err instanceof Error).toBeTruthy()
        resolve()
      }
    )
  })
}

test('http: scrape using Client.scrape static method (invalid url)', () =>
  clientScrapeStaticInvalid('http'))
test('udp: scrape using Client.scrape static method (invalid url)', () =>
  clientScrapeStaticInvalid('udp'))
test('ws: scrape using Client.scrape static method (invalid url)', () =>
  clientScrapeStaticInvalid('ws'))

function clientScrapeMulti(serverType: 'http' | 'udp'): Promise<void> {
  const infoHash1 = fixtures.leaves.parsedTorrent.infoHash
  const infoHash2 = fixtures.alice.parsedTorrent.infoHash

  return new Promise((resolve, reject) => {
    common.createServer(serverType, (server, announceUrl) => {
      Client.scrape(
        {
          infoHash: [infoHash1, infoHash2],
          announce: announceUrl,
          wrtc: testWrtc,
        },
        (err, results) => {
          if (err) throw err

          expect(results![infoHash1].announce).toBe(announceUrl)
          expect(results![infoHash1].infoHash).toEqual(infoHash1)
          expect(typeof results![infoHash1].complete).toBe('number')
          expect(typeof results![infoHash1].incomplete).toBe('number')
          expect(typeof results![infoHash1].downloaded).toBe('number')

          expect(results![infoHash2].announce).toBe(announceUrl)
          expect(results![infoHash2].infoHash).toEqual(infoHash2)
          expect(typeof results![infoHash2].complete).toBe('number')
          expect(typeof results![infoHash2].incomplete).toBe('number')
          expect(typeof results![infoHash2].downloaded).toBe('number')

          server.close(() => {
            resolve()
          })
        }
      )
    })
  })
}

test('http: MULTI scrape using Client.scrape static method', () => clientScrapeMulti('http'))
test('udp: MULTI scrape using Client.scrape static method', () => clientScrapeMulti('udp'))

test('server: multiple info_hash scrape (manual http request)', async () => {
  const binaryInfoHash1 = hex2bin(fixtures.leaves.parsedTorrent.infoHash)
  const binaryInfoHash2 = hex2bin(fixtures.alice.parsedTorrent.infoHash)

  return new Promise((resolve, reject) => {
    common.createServer('http', async (server, announceUrl) => {
      const scrapeUrl = announceUrl.replace('/announce', '/scrape')

      const url = `${scrapeUrl}?${commonLib.querystringStringify({
        info_hash: [binaryInfoHash1, binaryInfoHash2],
      })}`
      const res = await fetch(url)
      let data = Buffer.from(await res.arrayBuffer())

      expect(res.status).toBe(200)

      data = bencode.decode(data) as Buffer
      expect((data as any).files).toBeTruthy()
      expect(Object.keys((data as any).files).length).toBe(2)

      expect((data as any).files[binaryInfoHash1]).toBeTruthy()
      expect(typeof (data as any).files[binaryInfoHash1].complete).toBe('number')
      expect(typeof (data as any).files[binaryInfoHash1].incomplete).toBe('number')
      expect(typeof (data as any).files[binaryInfoHash1].downloaded).toBe('number')

      expect((data as any).files[binaryInfoHash2]).toBeTruthy()
      expect(typeof (data as any).files[binaryInfoHash2].complete).toBe('number')
      expect(typeof (data as any).files[binaryInfoHash2].incomplete).toBe('number')
      expect(typeof (data as any).files[binaryInfoHash2].downloaded).toBe('number')

      server.close(() => {
        resolve()
      })
    })
  })
})

test('server: all info_hash scrape (manual http request)', () => {
  const binaryInfoHash = hex2bin(fixtures.leaves.parsedTorrent.infoHash)

  return new Promise((resolve, reject) => {
    common.createServer('http', (server, announceUrl) => {
      const scrapeUrl = announceUrl.replace('/announce', '/scrape')

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
        const res = await fetch(scrapeUrl)
        let data = Buffer.from(await res.arrayBuffer())

        expect(res.status).toBe(200)
        data = bencode.decode(data) as Buffer
        expect((data as any).files).toBeTruthy()
        expect(Object.keys((data as any).files).length).toBe(1)

        expect((data as any).files[binaryInfoHash]).toBeTruthy()
        expect(typeof (data as any).files[binaryInfoHash].complete).toBe('number')
        expect(typeof (data as any).files[binaryInfoHash].incomplete).toBe('number')
        expect(typeof (data as any).files[binaryInfoHash].downloaded).toBe('number')

        client.destroy(() => {
          server.close(() => {
            resolve()
          })
        })
      })
    })
  })
})

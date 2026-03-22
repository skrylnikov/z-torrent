import dgram from 'dgram'
import { expect, test } from 'bun:test'

import * as common from './common.js'
import { LSD } from '../src/index.js'

function sendToLsd(payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4')
    client.once('error', reject)
    client.connect(6771, '239.192.152.143', () => {
      client.send(payload, (sendErr) => {
        client.close()
        if (sendErr) reject(sendErr)
        else resolve()
      })
    })
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

test('should emit a warning when invalid announce header', async () => {
  const opts = {
    peerId: common.randomId(),
    infoHash: common.randomHash(),
    port: common.randomPort(),
  }
  const lsd = new LSD(opts)

  const warning = new Promise<string>((resolve) => {
    lsd.on('warning', (err: unknown) => {
      resolve(typeof err === 'string' ? err : String(err))
    })
  })

  lsd.start()
  await delay(100)
  await sendToLsd('INVALID ANNOUNCE')
  expect(await Promise.race([warning, delay(2000).then(() => '')])).toBe(
    'Invalid LSD announce (header)'
  )
  await new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

test('should emit a warning when invalid announce host', async () => {
  const opts = {
    peerId: common.randomId(),
    infoHash: common.randomHash(),
    port: common.randomPort(),
  }
  const lsd = new LSD(opts)

  const warning = new Promise<string>((resolve) => {
    lsd.on('warning', (err: unknown) => {
      resolve(typeof err === 'string' ? err : String(err))
    })
  })

  const host = '127.0.0.1:6771'
  const port = '51413'
  const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

  lsd.start()
  await delay(100)
  await sendToLsd(announce)
  expect(await Promise.race([warning, delay(2000).then(() => '')])).toBe(
    'Invalid LSD announce (host)'
  )
  await new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

test('should emit a warning when invalid announce port', async () => {
  const opts = {
    peerId: common.randomId(),
    infoHash: common.randomHash(),
    port: common.randomPort(),
  }
  const lsd = new LSD(opts)

  const warning = new Promise<string>((resolve) => {
    lsd.on('warning', (err: unknown) => {
      resolve(typeof err === 'string' ? err : String(err))
    })
  })

  const host = '239.192.152.143:6771'
  const port = ''
  const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

  lsd.start()
  await delay(100)
  await sendToLsd(announce)
  expect(await Promise.race([warning, delay(2000).then(() => '')])).toBe(
    'Invalid LSD announce (port)'
  )
  await new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

test('should emit a warning when invalid announce infoHash', async () => {
  const opts = {
    peerId: common.randomId(),
    infoHash: common.randomHash(),
    port: common.randomPort(),
  }
  const lsd = new LSD(opts)

  const warning = new Promise<string>((resolve) => {
    lsd.on('warning', (err: unknown) => {
      resolve(typeof err === 'string' ? err : String(err))
    })
  })

  const host = '239.192.152.143:6771'
  const port = '51413'
  const ihash = 'ABCD'
  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

  lsd.start()
  await delay(100)
  await sendToLsd(announce)
  expect(await Promise.race([warning, delay(2000).then(() => '')])).toBe(
    'Invalid LSD announce (infoHash)'
  )
  await new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

test('should emit peer when receiving a valid announce without cookie', async () => {
  const opts = {
    peerId: common.randomId(),
    infoHash: common.randomHash(),
    port: common.randomPort(),
  }
  const lsd = new LSD(opts)

  const host = '239.192.152.143:6771'
  const port = '51413'
  const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

  const peerEvent = new Promise<[string, string]>((resolve) => {
    lsd.on('peer', (peerAddress: string, peerInfoHash: string) => {
      resolve([peerAddress, peerInfoHash])
    })
  })

  lsd.start()
  await delay(100)
  await sendToLsd(announce)

  const [peerAddress, peerInfoHash] = await Promise.race([
    peerEvent,
    delay(3000).then(() => ['', ''] as [string, string]),
  ])

  expect(peerAddress).toMatch(/^\d+\.\d+\.\d+\.\d+:\d+$/)
  expect(peerInfoHash).toBe(ihash)

  await new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

test('should emit peer when receiving a valid announce with cookie', async () => {
  const opts = {
    peerId: common.randomId(),
    infoHash: common.randomHash(),
    port: common.randomPort(),
  }
  const lsd = new LSD(opts)

  const host = '239.192.152.143:6771'
  const port = '51413'
  const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const cookie = 'cookie'
  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\ncookie: ${cookie}\r\n\r\n\r\n`

  const peerEvent = new Promise<[string, string]>((resolve) => {
    lsd.on('peer', (peerAddress: string, peerInfoHash: string) => {
      resolve([peerAddress, peerInfoHash])
    })
  })

  lsd.start()
  await delay(100)
  await sendToLsd(announce)

  const [peerAddress, peerInfoHash] = await Promise.race([
    peerEvent,
    delay(3000).then(() => ['', ''] as [string, string]),
  ])

  expect(peerAddress).toMatch(/^\d+\.\d+\.\d+\.\d+:\d+$/)
  expect(peerInfoHash).toBe(ihash)

  await new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

test('should emit peer for each infohash when announce lists multiple', async () => {
  const opts = {
    peerId: common.randomId(),
    infoHash: common.randomHash(),
    port: common.randomPort(),
  }
  const lsd = new LSD(opts)

  const host = '239.192.152.143:6771'
  const port = '51413'
  const ihashA = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const ihashB = '562A86EFE4DC660E9D216A901D74338AF34205AA'
  const cookie = 'cookie'
  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihashA}\r\nInfohash: ${ihashB}\r\ncookie: ${cookie}\r\n\r\n\r\n`

  const hashes: string[] = []
  lsd.on('peer', (_addr: string, infoHash: string) => {
    hashes.push(infoHash)
  })

  lsd.start()
  await delay(100)
  await sendToLsd(announce)
  await delay(200)

  expect(hashes.sort()).toEqual([ihashA, ihashB].sort())

  await new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

test('should emit peer when announce uses ipv6 host header', async () => {
  const opts = {
    peerId: common.randomId(),
    infoHash: common.randomHash(),
    port: common.randomPort(),
  }
  const lsd = new LSD(opts)

  const host = '[ff15::efc0:988f]:6771'
  const port = '51413'
  const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'
  const cookie = 'cookie'
  const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\ncookie: ${cookie}\r\n\r\n\r\n`

  const peerEvent = new Promise<string>((resolve) => {
    lsd.on('peer', (_peerAddress: string, peerInfoHash: string) => {
      resolve(peerInfoHash)
    })
  })

  lsd.start()
  await delay(100)
  await sendToLsd(announce)

  const peerInfoHash = await Promise.race([peerEvent, delay(3000).then(() => '')])
  expect(peerInfoHash).toBe(ihash)

  await new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

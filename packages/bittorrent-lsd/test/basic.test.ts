import { expect, test } from 'bun:test'
import * as common from './common.js'
import LSD from 'bittorrent-lsd'

test('should emit a warning when invalid announce header', () => {
  return new Promise<void>((resolve) => {
    const opts = {
      peerId: common.randomId(),
      infoHash: common.randomHash(),
      port: common.randomPort(),
    }
    const lsd = new LSD(opts)

    lsd.on('warning', (err: string) => {
      expect(err).toBe('Invalid LSD announce (header)')
    })

    const announce = 'INVALID ANNOUNCE'

    expect((lsd as any)._parseAnnounce(announce)).toBeFalsy()

    lsd.destroy(() => resolve())
  })
})

test('should emit a warning when invalid announce host', () => {
  return new Promise<void>((resolve) => {
    const opts = {
      peerId: common.randomId(),
      infoHash: common.randomHash(),
      port: common.randomPort(),
    }
    const lsd = new LSD(opts)

    lsd.on('warning', (err: string) => {
      expect(err).toBe('Invalid LSD announce (host)')
    })

    const host = '127.0.0.1:6771'
    const port = '51413'
    const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'

    const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

    expect((lsd as any)._parseAnnounce(announce)).toBeFalsy()

    lsd.destroy(() => resolve())
  })
})

test('should emit a warning when invalid announce port', () => {
  return new Promise<void>((resolve) => {
    const opts = {
      peerId: common.randomId(),
      infoHash: common.randomHash(),
      port: common.randomPort(),
    }
    const lsd = new LSD(opts)

    lsd.on('warning', (err: string) => {
      expect(err).toBe('Invalid LSD announce (port)')
    })

    const host = '239.192.152.143:6771'
    const port = ''
    const ihash = 'F60AE72E07713D4F14878A5B24ADB34992401AC9'

    const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

    expect((lsd as any)._parseAnnounce(announce)).toBeFalsy()

    lsd.destroy(() => resolve())
  })
})

test('should emit a warning when invalid announce infoHash', () => {
  return new Promise<void>((resolve) => {
    const opts = {
      peerId: common.randomId(),
      infoHash: common.randomHash(),
      port: common.randomPort(),
    }
    const lsd = new LSD(opts)

    lsd.on('warning', (err: string) => {
      expect(err).toBe('Invalid LSD announce (infoHash)')
    })

    const host = '239.192.152.143:6771'
    const port = '51413'
    const ihash = 'ABCD'

    const announce = `BT-SEARCH * HTTP/1.1\r\nHost: ${host}\r\nPort: ${port}\r\nInfohash: ${ihash}\r\n\r\n\r\n`

    expect((lsd as any)._parseAnnounce(announce)).toBeFalsy()

    lsd.destroy(() => resolve())
  })
})

test('should parse an announce without cookie', () => {
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

  const parsedAnnounce = (lsd as any)._parseAnnounce(announce)
  const expectedAnnounce = {
    host,
    port,
    infoHash: [ihash],
    cookie: null,
  }

  expect(parsedAnnounce).toEqual(expectedAnnounce)

  return new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

test('should parse an announce with a single infohash', () => {
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

  const parsedAnnounce = (lsd as any)._parseAnnounce(announce)
  const expectedAnnounce = {
    host,
    port,
    infoHash: [ihash],
    cookie,
  }

  expect(parsedAnnounce).toEqual(expectedAnnounce)

  return new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

test('should parse an announce with multiple infohashes', () => {
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

  const parsedAnnounce = (lsd as any)._parseAnnounce(announce)
  const expectedAnnounce = {
    host,
    port,
    infoHash: [ihashA, ihashB],
    cookie,
  }

  expect(parsedAnnounce).toEqual(expectedAnnounce)

  return new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

test('should parse an announce with ipv6 host', () => {
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

  const parsedAnnounce = (lsd as any)._parseAnnounce(announce)
  const expectedAnnounce = {
    host,
    port,
    infoHash: [ihash],
    cookie,
  }

  expect(parsedAnnounce).toEqual(expectedAnnounce)

  return new Promise<void>((resolve) => lsd.destroy(() => resolve()))
})

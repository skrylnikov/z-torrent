import { parse } from '@z-torrent/parse'
import { expect, test, describe } from 'bun:test'

import { torrentFixtures } from './fixtures/index.ts'

describe('BitTorrent v2 hash support', () => {
  test('v2 info hash as hex string (64 chars)', async () => {
    const v2Hash = 'a'.repeat(64)
    const parsed = await parse.decode(v2Hash)
    expect(parsed.infoHashV2).toBe(v2Hash.toLowerCase())
    expect(parsed.infoHash).toBeUndefined()
    expect(parsed.name).toBeUndefined()
    expect(parsed.announce).toEqual([])
  })

  test('v2 info hash as Buffer (32 bytes)', async () => {
    const v2Hash = 'a'.repeat(64)
    const v2HashBuffer = Buffer.from(v2Hash, 'hex')
    const parsed = await parse.decode(v2HashBuffer)
    expect(parsed.infoHashV2).toBe(v2Hash.toLowerCase())
  })

  test('magnet uri with v2 hash (btmh)', async () => {
    const v2Hash = 'a'.repeat(64)
    const magnetV2 = `magnet:?xt=urn:btmh:1220${v2Hash}`
    const parsed = await parse.decode(magnetV2)
    expect(parsed.infoHashV2).toBe(v2Hash.toLowerCase())
  })

  test('hybrid magnet uri (both btih and btmh)', async () => {
    const hybridMagnet =
      'magnet:?xt=urn:btih:631a31dd0a46257d5078c0dee4e66e26f73e42ac&xt=urn:btmh:1220d8dd32ac93357c368556af3ac1d95c9d76bd0dff6fa9833ecdac3d53134efabb'
    const parsed = await parse.decode(hybridMagnet)
    expect(parsed.infoHash).toBe('631a31dd0a46257d5078c0dee4e66e26f73e42ac')
    expect(parsed.infoHashV2).toBe(
      'd8dd32ac93357c368556af3ac1d95c9d76bd0dff6fa9833ecdac3d53134efabb'
    )
  })

  test('parsed torrent with both v1 and v2 hashes (hybrid)', async () => {
    const v2Hash = 'a'.repeat(64)
    const torrentObjHybrid = {
      infoHash: 'd2474e86c95b19b8bcfdb92bc12c9d44667cfa36',
      infoHashV2: v2Hash,
    }
    const parsed = await parse.decode(torrentObjHybrid)
    expect(parsed.infoHash).toBe('d2474e86c95b19b8bcfdb92bc12c9d44667cfa36')
    expect(parsed.infoHashV2).toBe(v2Hash.toLowerCase())
  })
})

describe('Parse BitTorrent v2 torrent files', () => {
  test('v2-only torrent', async () => {
    const v2Parsed = await parse.decode(torrentFixtures['bittorrent-v2-test'].torrent)
    expect(v2Parsed.infoHashV2).toBe(
      'caf1e1c30e81cb361b9ee167c4aa64228a7fa4fa9f6105232b28ad099f3a302e'
    )
    expect(v2Parsed.infoHash).toBeUndefined()
    expect(v2Parsed.pieces).toBeUndefined()
    expect(v2Parsed.version).toBe('v2')
    expect(v2Parsed.name).toBeTruthy()
    expect(Array.isArray(v2Parsed.files)).toBe(true)
    expect(typeof v2Parsed.length).toBe('number')
  })

  test('hybrid torrent', async () => {
    const hybrid = await parse.decode(torrentFixtures['bittorrent-v2-hybrid-test'].torrent)
    expect(hybrid.infoHash).toBe('631a31dd0a46257d5078c0dee4e66e26f73e42ac')
    expect(hybrid.infoHashV2).toBe(
      'd8dd32ac93357c368556af3ac1d95c9d76bd0dff6fa9833ecdac3d53134efabb'
    )
    expect(hybrid.version).toBe('hybrid')
    expect(hybrid.name).toBeTruthy()
    expect(Array.isArray(hybrid.files)).toBe(true)
    expect(typeof hybrid.length).toBe('number')
  })
})

describe('Validation', () => {
  test('magnet with no valid hash fails', async () => {
    await expect(parse.decode('magnet:?xt=urn:invalid:123')).rejects.toThrow(
      'Invalid torrent identifier'
    )
  })

  test('object with neither hash fails', async () => {
    await expect(parse.decode({ name: 'test' })).rejects.toThrow('Invalid torrent identifier')
  })
})

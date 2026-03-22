import { fixtures } from '@z-torrent/fixtures'
import bencode from 'bencode'
import Protocol from '@z-torrent/protocol'
import { expect, test } from 'bun:test'
import { hash } from 'uint8-util'
import { createUtMetadata, UtMetadata } from '../src/index.js'

const { leavesMetadata } = fixtures

test('wire.use(createUtMetadata())', () => {
  const wire = new Protocol()
  // @ts-expect-error pipe returns unknown in Duplex type
  wire.pipe(wire)

  wire.use(createUtMetadata())

  const utMetadata = wire.ut_metadata as UtMetadata
  expect(utMetadata).toBeTruthy()
  expect(utMetadata.fetch).toBeTruthy()
  expect(utMetadata.cancel).toBeTruthy()
  expect(utMetadata.metadata).toBeFalsy()
})

test('wire.use(createUtMetadata(metadata))', async () => {
  const wire = new Protocol()
  // @ts-expect-error pipe returns unknown in Duplex type
  wire.pipe(wire)

  wire.use(createUtMetadata(leavesMetadata.torrent))

  const utMetadata = wire.ut_metadata as UtMetadata
  expect(utMetadata).toBeTruthy()
  expect(utMetadata.fetch).toBeTruthy()
  expect(utMetadata.cancel).toBeTruthy()

  await new Promise<void>((r) => queueMicrotask(r))

  const info = bencode.decode(leavesMetadata.torrent!) as { info: unknown }
  const encodedInfo = Uint8Array.from(bencode.encode(info.info))
  expect(utMetadata.metadata).toEqual(encodedInfo)
})

test('setMetadata v2-only: handshake info_hash is truncated SHA-256, not SHA-1', async () => {
  const wire = { extended: () => {}, extendedHandshake: {} }
  const info = bencode.decode(leavesMetadata.torrent!) as { info: unknown }
  const encodedInfo = Uint8Array.from(bencode.encode(info.info))
  const sha256Hex = (await hash(encodedInfo, 'hex', 'sha256')).toLowerCase()
  const truncatedHandshake = sha256Hex.slice(0, 40)

  const ut = new UtMetadata(wire as any, undefined, sha256Hex)
  ut.onHandshake(truncatedHandshake, '', {})
  expect(await ut.setMetadata(encodedInfo)).toBe(true)
})

test('setMetadata hybrid: verify both SHA-256(info) and SHA-1(info)', async () => {
  const wire = { extended: () => {}, extendedHandshake: {} }
  const info = bencode.decode(leavesMetadata.torrent!) as { info: unknown }
  const encodedInfo = Uint8Array.from(bencode.encode(info.info))
  const sha256Hex = (await hash(encodedInfo, 'hex', 'sha256')).toLowerCase()
  const sha1Hex = (await hash(encodedInfo, 'hex')).toLowerCase()

  const ut = new UtMetadata(wire as any, undefined, sha256Hex)
  ut.onHandshake(sha1Hex, '', {})
  expect(await ut.setMetadata(encodedInfo)).toBe(true)
})

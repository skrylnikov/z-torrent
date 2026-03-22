import { fixtures } from '@z-torrent/fixtures'
import bencode from 'bencode'
import Protocol from '@z-torrent/protocol'
import { expect, test } from 'bun:test'
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

test('wire.use(createUtMetadata(metadata))', () => {
  const wire = new Protocol()
  // @ts-expect-error pipe returns unknown in Duplex type
  wire.pipe(wire)

  wire.use(createUtMetadata(leavesMetadata.torrent))

  const utMetadata = wire.ut_metadata as UtMetadata
  expect(utMetadata).toBeTruthy()
  expect(utMetadata.fetch).toBeTruthy()
  expect(utMetadata.cancel).toBeTruthy()

  const info = bencode.decode(leavesMetadata.torrent!) as { info: unknown }
  const encodedInfo = Uint8Array.from(bencode.encode(info.info))
  expect(utMetadata.metadata).toEqual(encodedInfo)
})

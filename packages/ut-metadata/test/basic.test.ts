import fixtures from '@z-torrent/fixtures'
import bencode from 'bencode'
import Protocol from '@z-torrent/protocol'
import { expect, test } from 'bun:test'
import utMetadata from '../dist/index.js'

const { leavesMetadata } = fixtures

test('wire.use(utMetadata())', () => {
  const wire = new Protocol()
  wire.pipe(wire)

  wire.use(utMetadata())

  expect(wire.ut_metadata).toBeTruthy()
  expect(wire.ut_metadata!.fetch).toBeTruthy()
  expect(wire.ut_metadata!.cancel).toBeTruthy()
  expect(wire.ut_metadata!.metadata).toBeFalsy()
})

test('wire.use(utMetadata(metadata))', () => {
  const wire = new Protocol()
  wire.pipe(wire)

  wire.use(utMetadata(leavesMetadata.torrent))

  expect(wire.ut_metadata).toBeTruthy()
  expect(wire.ut_metadata!.fetch).toBeTruthy()
  expect(wire.ut_metadata!.cancel).toBeTruthy()
  expect(wire.ut_metadata!.metadata!.toString('hex')).toBe(
    bencode.encode(bencode.decode(leavesMetadata.torrent).info).toString('hex')
  )
})

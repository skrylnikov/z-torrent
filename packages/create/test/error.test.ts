import { expect, test } from 'bun:test'
import { createTorrent } from '@z-torrent/create'

test('error handling', () => {
  expect(() => createTorrent(null as never, () => {})).toThrow()
  expect(() => createTorrent(undefined as never, () => {})).toThrow()
  expect(() => createTorrent([null] as never, () => {})).toThrow()
  expect(() => createTorrent([undefined] as never, () => {})).toThrow()
  expect(() => createTorrent([null, undefined] as never, () => {})).toThrow()
})

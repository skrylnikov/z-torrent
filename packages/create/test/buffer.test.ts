import { expect, test } from 'bun:test'
import { parseTorrent } from '@z-torrent/parse'
import path from 'path'
import { hash } from 'uint8-util'
import { createTorrentPromise, torrentFilesOf } from './helpers.js'

type BufferWithPath = Buffer & { name?: string }

test('create nested torrent with array of buffers', async () => {
  const buf1 = Buffer.from('bl') as BufferWithPath
  buf1.name = 'dir1/buf1.txt'
  const buf2 = Buffer.from('ah') as BufferWithPath
  buf2.name = 'dir2/buf2.txt'

  const startTime = Date.now()
  const torrent = await createTorrentPromise([buf1, buf2], { name: 'multi' })
  const parsedTorrent = await parseTorrent(torrent)
  const files = torrentFilesOf(parsedTorrent)

  expect(parsedTorrent.name).toBe('multi')
  expect(parsedTorrent.private).toBeFalsy()
  expect(parsedTorrent.created!.getTime()).toBeGreaterThanOrEqual(startTime)
  expect(Array.isArray(parsedTorrent.announce)).toBe(true)
  expect(path.normalize(files[0]!.path)).toBe(path.normalize('multi/dir1/buf1.txt'))
  expect(files[0]!.length).toBe(2)
  expect(path.normalize(files[1]!.path)).toBe(path.normalize('multi/dir2/buf2.txt'))
  expect(files[1]!.length).toBe(2)
  expect(parsedTorrent.length).toBe(4)
  expect(parsedTorrent.info!.pieces!.length).toBe(20)
  expect(parsedTorrent.pieceLength).toBe(16384)
  expect(parsedTorrent.pieces).toEqual(['5bf1fd927dfb8679496a2e6cf00cbe50c1c87145'])
  expect(await hash(parsedTorrent.infoBuffer!, 'hex')).toBe(
    '8fa3c08e640db9576156b21f31353402456a0208'
  )
})

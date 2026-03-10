import fs from 'fs'
import { expect, test } from 'bun:test'
import fixtures from 'webtorrent-fixtures'
import parseTorrent from 'parse-torrent'
import path from 'path'
import { createTorrentPromise } from './helpers.js'

type ReadStreamWithName = fs.ReadStream & { name?: string }

test('create multi file torrent with array of mixed types', async () => {
  const number11Path = path.join(fixtures.lotsOfNumbers.contentPath, 'big numbers', '11.txt')
  const number10Path = path.join(fixtures.lotsOfNumbers.contentPath, 'big numbers', '10.txt')
  const numbersPath = fixtures.numbers.contentPath

  const stream = fs.createReadStream(number10Path) as ReadStreamWithName
  stream.name = '10.txt'

  const input = [number11Path, stream, numbersPath]

  const startTime = Date.now()
  const torrent = await createTorrentPromise(input, {
    name: 'multi',
    pieceLength: 32768,
    private: false,
  })
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('multi')
  expect(parsedTorrent.private).toBeFalsy()
  expect(parsedTorrent.created.getTime()).toBeGreaterThanOrEqual(startTime)
  expect(Array.isArray(parsedTorrent.announce)).toBe(true)
  const files = parsedTorrent.files.sort((a, b) => a.path.localeCompare(b.path))
  expect(path.normalize(files[0].path)).toBe(path.normalize('multi/10.txt'))
  expect(files[0].length).toBe(2)
  expect(path.normalize(files[1].path)).toBe(path.normalize('multi/11.txt'))
  expect(files[1].length).toBe(2)
  expect(path.normalize(files[2].path)).toBe(
    path.normalize('multi/numbers/1.txt')
  )
  expect(files[2].length).toBe(1)
  expect(path.normalize(files[3].path)).toBe(
    path.normalize('multi/numbers/2.txt')
  )
  expect(files[3].length).toBe(2)
  expect(path.normalize(files[4].path)).toBe(
    path.normalize('multi/numbers/3.txt')
  )
  expect(files[4].length).toBe(3)
  expect(parsedTorrent.length).toBe(10)
  expect(parsedTorrent.info.pieces.length).toBe(20)
  expect(parsedTorrent.pieceLength).toBe(32768)
  expect(parsedTorrent.pieces).toHaveLength(1)
  expect(parsedTorrent.pieces[0]).toMatch(/^[a-f0-9]{40}$/)
  expect(parsedTorrent.infoHash).toMatch(/^[a-f0-9]{40}$/)
})

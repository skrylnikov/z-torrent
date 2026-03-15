/* global Blob */

import { expect, test } from 'bun:test'
import fixtures from '@z-torrent/fixtures'
import fs from 'fs'
import parseTorrent from '@z-torrent/parse'
import path from 'path'
import { hash } from 'uint8-util'
import { createTorrentPromise } from '../helpers.js'

interface BlobWithPath extends Blob {
  fullPath?: string
  name?: string
}

function makeFileShim(buf: Buffer | string, name: string, fullPath: string): BlobWithPath {
  const file = new Blob([buf]) as BlobWithPath
  file.fullPath = fullPath
  file.name = name
  return file
}

const numbers1 = makeFileShim(
  fs.readFileSync(path.join(fixtures.numbers.contentPath!, '1.txt'), 'utf8'),
  '1.txt',
  'numbers/1.txt'
)
const numbers2 = makeFileShim(
  fs.readFileSync(path.join(fixtures.numbers.contentPath!, '2.txt'), 'utf8'),
  '2.txt',
  'numbers/2.txt'
)
const numbers3 = makeFileShim(
  fs.readFileSync(path.join(fixtures.numbers.contentPath!, '3.txt'), 'utf8'),
  '3.txt',
  'numbers/3.txt'
)
const DSStore = makeFileShim('blah', '.DS_Store', '/numbers/.DS_Store')

test('create multi file torrent with directory at root', async () => {
  const startTime = Date.now()
  const torrent = await createTorrentPromise([numbers1, numbers2, numbers3, DSStore])
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('numbers')
  expect(parsedTorrent.private).toBeFalsy()
  expect(parsedTorrent.created.getTime()).toBeGreaterThanOrEqual(startTime)
  expect(Array.isArray(parsedTorrent.announce)).toBe(true)
  expect(parsedTorrent.files[0].path).toBe('numbers/1.txt')
  expect(parsedTorrent.files[0].length).toBe(1)
  expect(parsedTorrent.files[1].path).toBe('numbers/2.txt')
  expect(parsedTorrent.files[1].length).toBe(2)
  expect(parsedTorrent.files[2].path).toBe('numbers/3.txt')
  expect(parsedTorrent.files[2].length).toBe(3)
  expect(parsedTorrent.length).toBe(6)
  expect(parsedTorrent.info.pieces.length).toBe(20)
  expect(parsedTorrent.pieces).toEqual(['1f74648e50a6a6708ec54ab327a163d5536b7ced'])
  expect(await hash(parsedTorrent.infoBuffer, 'hex')).toBe(
    '89d97c2261a21b040cf11caa661a3ba7233bb7e6'
  )
})

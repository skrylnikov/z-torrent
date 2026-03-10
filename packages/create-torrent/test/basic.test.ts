import parseTorrent from 'parse-torrent'
import path from 'path'
import { expect, test } from 'bun:test'
import createTorrent from 'create-torrent'
import { createTorrentPromise } from './helpers.js'

type BufferWithPath = Buffer & { name?: string; fullPath?: string }

test('implicit torrent name and file name', async () => {
  const buf1 = Buffer.from('buf1')
  const torrent = await createTorrentPromise(buf1)
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toContain('Unnamed Torrent')
  expect(parsedTorrent.files.length).toBe(1)
  expect(parsedTorrent.files[0].name).toContain('Unnamed Torrent')
  expect(parsedTorrent.files[0].path).toContain('Unnamed Torrent')
})

test('implicit file name from torrent name', async () => {
  const buf1 = Buffer.from('buf1')
  const torrent = await createTorrentPromise(buf1, { name: 'My Cool File' })
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool File')
  expect(parsedTorrent.files.length).toBe(1)
  expect(parsedTorrent.files[0].name).toBe('My Cool File')
  expect(parsedTorrent.files[0].path).toBe('My Cool File')
})

test('implicit torrent name from file name', async () => {
  const buf1 = Buffer.from('buf1') as BufferWithPath
  buf1.name = 'My Cool File'

  const torrent = await createTorrentPromise(buf1)
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool File')
  expect(parsedTorrent.files.length).toBe(1)
  expect(parsedTorrent.files[0].name).toBe('My Cool File')
  expect(parsedTorrent.files[0].path).toBe('My Cool File')
})

test('implicit file names from torrent name', async () => {
  const buf1 = Buffer.from('buf1')
  const buf2 = Buffer.from('buf2')

  const torrent = await createTorrentPromise([buf1, buf2], { name: 'My Cool File' })
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool File')
  expect(parsedTorrent.files.length).toBe(2)
  expect(parsedTorrent.files[0].name).toContain('Unknown File')
  expect(parsedTorrent.files[0].path).toContain('Unknown File')
  expect(parsedTorrent.files[1].name).toContain('Unknown File')
  expect(parsedTorrent.files[1].path).toContain('Unknown File')
})

test('set file name with `name` property', async () => {
  const buf1 = Buffer.from('buf1') as BufferWithPath
  buf1.name = 'My Cool File'

  const torrent = await createTorrentPromise(buf1)
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool File')
  expect(parsedTorrent.files.length).toBe(1)
  expect(parsedTorrent.files[0].name).toBe('My Cool File')
  expect(parsedTorrent.files[0].path).toBe('My Cool File')
})

test('set file names with `name` property', async () => {
  const buf1 = Buffer.from('buf1') as BufferWithPath
  buf1.name = 'My Cool File 1'
  const buf2 = Buffer.from('buf2') as BufferWithPath
  buf2.name = 'My Cool File 2'

  const torrent = await createTorrentPromise([buf1, buf2], { name: 'My Cool Torrent' })
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool Torrent')
  expect(parsedTorrent.files.length).toBe(2)
  expect(parsedTorrent.files[0].name).toBe('My Cool File 1')
  expect(parsedTorrent.files[0].path).toBe(path.join('My Cool Torrent', 'My Cool File 1'))
  expect(parsedTorrent.files[1].name).toBe('My Cool File 2')
  expect(parsedTorrent.files[1].path).toBe(path.join('My Cool Torrent', 'My Cool File 2'))
})

test('set file name with `fullPath` property', async () => {
  const buf1 = Buffer.from('buf1') as BufferWithPath
  buf1.fullPath = 'My Cool File'

  const torrent = await createTorrentPromise(buf1)
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool File')
  expect(parsedTorrent.files.length).toBe(1)
  expect(parsedTorrent.files[0].name).toBe('My Cool File')
  expect(parsedTorrent.files[0].path).toBe('My Cool File')
})

test('set file names with `fullPath` property', async () => {
  const buf1 = Buffer.from('buf1') as BufferWithPath
  buf1.fullPath = 'My Cool File 1'
  const buf2 = Buffer.from('buf2') as BufferWithPath
  buf2.fullPath = 'My Cool File 2'

  const torrent = await createTorrentPromise([buf1, buf2], { name: 'My Cool Torrent' })
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool Torrent')
  expect(parsedTorrent.files.length).toBe(2)
  expect(parsedTorrent.files[0].name).toBe('My Cool File 1')
  expect(parsedTorrent.files[0].path).toBe(path.join('My Cool Torrent', 'My Cool File 1'))
  expect(parsedTorrent.files[1].name).toBe('My Cool File 2')
  expect(parsedTorrent.files[1].path).toBe(path.join('My Cool Torrent', 'My Cool File 2'))
})

test('implicit torrent name from file name with slashes in it', async () => {
  const buf1 = Buffer.from('buf1') as BufferWithPath
  buf1.name = 'My Cool Folder/My Cool File'

  const torrent = await createTorrentPromise(buf1)
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool File')
  expect(parsedTorrent.files.length).toBe(1)
  expect(parsedTorrent.files[0].name).toBe('My Cool File')
  expect(parsedTorrent.files[0].path).toBe('My Cool File')
})

test('implicit torrent name from file names with slashes in them', async () => {
  const buf1 = Buffer.from('buf1') as BufferWithPath
  buf1.name = 'My Cool Folder/My Cool File 1'
  const buf2 = Buffer.from('buf2') as BufferWithPath
  buf2.name = 'My Cool Folder/My Cool File 2'

  const torrent = await createTorrentPromise([buf1, buf2])
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool Folder')
  expect(parsedTorrent.files.length).toBe(2)
  expect(parsedTorrent.files[0].name).toBe('My Cool File 1')
  expect(parsedTorrent.files[0].path).toBe(path.join('My Cool Folder', 'My Cool File 1'))
  expect(parsedTorrent.files[1].name).toBe('My Cool File 2')
  expect(parsedTorrent.files[1].path).toBe(path.join('My Cool Folder', 'My Cool File 2'))
})

test('verify torrent length with maxPieceLength set', async () => {
  const buf1 = Buffer.from('buf1') as BufferWithPath
  buf1.name = 'My Cool Folder/My Cool File 1'
  const buf2 = Buffer.from('buf2') as BufferWithPath
  buf2.name = 'My Cool Folder/My Cool File 2'

  const torrent = await createTorrentPromise([buf1, buf2], { maxPieceLength: 10 })
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool Folder')
  expect(parsedTorrent.files.length).toBe(2)
  expect(parsedTorrent.files[0].name).toBe('My Cool File 1')
  expect(parsedTorrent.files[0].path).toBe(path.join('My Cool Folder', 'My Cool File 1'))
  expect(parsedTorrent.files[1].name).toBe('My Cool File 2')
  expect(parsedTorrent.files[1].path).toBe(path.join('My Cool Folder', 'My Cool File 2'))
  expect(parsedTorrent.pieceLength).toBe(10)
})

test('verify maxPieceLength is ignored when pieceLength is manually set', async () => {
  const buf1 = Buffer.from('buf1') as BufferWithPath
  buf1.name = 'My Cool Folder/My Cool File 1'
  const buf2 = Buffer.from('buf2') as BufferWithPath
  buf2.name = 'My Cool Folder/My Cool File 2'

  const torrent = await createTorrentPromise([buf1, buf2], {
    pieceLength: 1024,
    maxPieceLength: 10,
  })
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('My Cool Folder')
  expect(parsedTorrent.files.length).toBe(2)
  expect(parsedTorrent.files[0].name).toBe('My Cool File 1')
  expect(parsedTorrent.files[0].path).toBe(path.join('My Cool Folder', 'My Cool File 1'))
  expect(parsedTorrent.files[1].name).toBe('My Cool File 2')
  expect(parsedTorrent.files[1].path).toBe(path.join('My Cool Folder', 'My Cool File 2'))
  expect(parsedTorrent.pieceLength).toBe(1024)
})

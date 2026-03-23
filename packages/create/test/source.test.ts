import { join } from 'path'
import { expect, test } from 'bun:test'
import { fixtures } from '@z-torrent/fixtures'
import { parseTorrent } from '@z-torrent/parse'
import { hash } from 'uint8-util'
import { createTorrentPromise, torrentFilesOf } from './helpers.js'

const { contentPath: folderPath } = fixtures.folder

test('verify info-hash without no source set (default)', async () => {
  const torrent = await createTorrentPromise(folderPath!, {
    pieceLength: 262144,
    announce: 'http://private.tracker.org/',
    private: true,
  })
  const parsedTorrent = await parseTorrent(torrent)
  const files = torrentFilesOf(parsedTorrent)

  expect(parsedTorrent.name).toBe('folder')
  expect((parsedTorrent.info as Record<string, unknown> | undefined)?.source).toBeUndefined()
  expect(parsedTorrent.private).toBe(true)
  expect(parsedTorrent.announce).toEqual(['http://private.tracker.org/'])
  expect(files[0]!.path).toBe(join('folder', 'file.txt'))
  expect(files[0]!.length).toBe(15)
  expect(parsedTorrent.length).toBe(15)
  expect(parsedTorrent.info!.pieces!.length).toBe(20)
  expect(parsedTorrent.pieceLength).toBe(262144)
  expect(parsedTorrent.pieces).toEqual(['799c11e348d39f1704022b8354502e2f81f3c037'])
  expect(await hash(parsedTorrent.infoBuffer!, 'hex')).toBe(
    'b4dfce1f956f720c928535ded617d07696a819ef'
  )
})

test('verify info-hash an additional source attribute set on the info dict', async () => {
  const torrent = await createTorrentPromise(folderPath!, {
    pieceLength: 262144,
    announce: 'http://private.tracker.org/',
    private: true,
    info: { source: 'SOURCE' },
  })
  const parsedTorrent = await parseTorrent(torrent)
  const files = torrentFilesOf(parsedTorrent)

  expect(parsedTorrent.name).toBe('folder')
  expect(parsedTorrent.private).toBe(true)
  expect(
    Buffer.from((parsedTorrent.info as Record<string, unknown>).source as Uint8Array).toString()
  ).toBe('SOURCE')
  expect(parsedTorrent.announce).toEqual(['http://private.tracker.org/'])
  expect(files[0]!.path).toBe(join('folder', 'file.txt'))
  expect(files[0]!.length).toBe(15)
  expect(parsedTorrent.length).toBe(15)
  expect(parsedTorrent.info!.pieces!.length).toBe(20)
  expect(parsedTorrent.pieceLength).toBe(262144)
  expect(parsedTorrent.pieces).toEqual(['799c11e348d39f1704022b8354502e2f81f3c037'])
  expect(await hash(parsedTorrent.infoBuffer!, 'hex')).toBe(
    'a9499b56289356a3d5b8636387deb83709b8fa42'
  )
})

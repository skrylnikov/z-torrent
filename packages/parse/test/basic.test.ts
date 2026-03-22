/* global Blob */

import { parse, parseTorrentSync } from '@z-torrent/parse'
import { expect, test } from 'bun:test'

import { torrentFixtures } from './fixtures/index.ts'

const leavesParsed = await parse.decode(torrentFixtures.leaves.torrent)
const numbersParsed = await parse.decode(torrentFixtures.numbers.torrent)

test('Test supported torrentInfo types', async () => {
  let parsed

  // info hash (as a hex string)
  parsed = await parse.decode(leavesParsed.infoHash!)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBeUndefined()
  expect(parsed.announce).toEqual([])

  // info hash (as a Buffer)
  parsed = await parse.decode(Buffer.from(leavesParsed.infoHash!, 'hex'))
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBeUndefined()
  expect(parsed.announce).toEqual([])

  // magnet uri (as a utf8 string)
  const magnet = `magnet:?xt=urn:btih:${leavesParsed.infoHash}`
  parsed = await parse.decode(magnet)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBeUndefined()
  expect(parsed.announce).toEqual([])

  // stream-magnet uri (as a utf8 string)
  const streamMagnet = `stream-magnet:?xt=urn:btih:${leavesParsed.infoHash}`
  parsed = await parse.decode(streamMagnet)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBeUndefined()
  expect(parsed.announce).toEqual([])

  // magnet uri with name
  parsed = await parse.decode(`${magnet}&dn=${encodeURIComponent(leavesParsed.name!)}`)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual([])

  // magnet uri with trackers
  parsed = await parse.decode(`${magnet}&tr=${encodeURIComponent('udp://tracker.example.com:80')}`)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBeUndefined()
  expect(parsed.announce).toEqual(['udp://tracker.example.com:80'])

  // .torrent file (as a Buffer)
  parsed = await parse.decode(torrentFixtures.leaves.torrent)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual(leavesParsed.announce)

  // parsed torrent (as an Object)
  parsed = await parse.decode(leavesParsed)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual(leavesParsed.announce)

  // parsed torrent (as an Object), with string 'announce' property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- invalid shape on purpose
  const leavesParsedModified: any = { ...leavesParsed, announce: 'udp://tracker.example.com:80' }
  parsed = await parse.decode(leavesParsedModified)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual(['udp://tracker.example.com:80'])

  // parsed torrent (as an Object), with array 'announce' property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- invalid shape on purpose
  const leavesParsedModified2: any = {
    ...leavesParsed,
    announce: ['udp://tracker.example.com:80', 'udp://tracker.example.com:81'],
  }
  parsed = await parse.decode(leavesParsedModified2)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual(['udp://tracker.example.com:80', 'udp://tracker.example.com:81'])

  // parsed torrent (as an Object), with empty 'announce' property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- invalid shape on purpose
  const leavesParsedModified3: any = { ...leavesParsed, announce: undefined }
  parsed = await parse.decode(leavesParsedModified3)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual([])
})

test('parseTorrentSync matches parse.decode for buffer', async () => {
  const asyncParsed = await parse.decode(torrentFixtures.leaves.torrent)
  const syncParsed = parseTorrentSync(torrentFixtures.leaves.torrent)
  expect(syncParsed).toEqual(asyncParsed)
})

test('parse single file torrent', async () => {
  const parsed = await parse.decode(torrentFixtures.leaves.torrent)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual(leavesParsed.announce)
})

test('parse multiple file torrent', async () => {
  const parsed = await parse.decode(torrentFixtures.numbers.torrent)
  expect(parsed.infoHash).toBe(numbersParsed.infoHash)
  expect(parsed.name).toBe(numbersParsed.name)
  expect(parsed.files).toEqual(numbersParsed.files)
  expect(parsed.announce).toEqual(numbersParsed.announce)
})

test('torrent file missing `name` field throws', async () => {
  await expect(parse.decode(torrentFixtures.corrupt.torrent)).rejects.toBeInstanceOf(Error)
})

test('parse url-list for webseed support', async () => {
  const torrent = await parse.decode(torrentFixtures.bunny.torrent)
  expect(torrent.urlList).toEqual([
    'http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_stereo_abl.mp4',
  ])
})

test('parse single file torrent from Blob', async () => {
  if (typeof Blob === 'undefined') {
    return
  }

  const leavesBlob = makeBlobShim(torrentFixtures.leaves.torrent)
  await new Promise<void>((resolve, reject) => {
    parse.remote(leavesBlob, (err, parsed) => {
      if (err) reject(err)
      else {
        expect(parsed!.infoHash).toBe(leavesParsed.infoHash)
        expect(parsed!.name).toBe(leavesParsed.name)
        expect(parsed!.announce).toEqual(leavesParsed.announce)
        resolve()
      }
    })
  })
})

function makeBlobShim(buf: Buffer, name?: string) {
  const file = new Blob([buf]) as Blob & { name?: string }
  file.name = name
  return file
}

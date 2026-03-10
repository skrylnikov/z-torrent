/* global Blob */

import fixtures from './fixtures/index.ts'
import parseTorrent, { remote } from '../dist/index.js'
import { expect, test } from 'bun:test'

const leavesParsed = await parseTorrent(fixtures.leaves.torrent)
const numbersParsed = await parseTorrent(fixtures.numbers.torrent)

test('Test supported torrentInfo types', async () => {
  let parsed

  // info hash (as a hex string)
  parsed = await parseTorrent(leavesParsed.infoHash)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBeUndefined()
  expect(parsed.announce).toEqual([])

  // info hash (as a Buffer)
  parsed = await parseTorrent(Buffer.from(leavesParsed.infoHash, 'hex'))
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBeUndefined()
  expect(parsed.announce).toEqual([])

  // magnet uri (as a utf8 string)
  const magnet = `magnet:?xt=urn:btih:${leavesParsed.infoHash}`
  parsed = await parseTorrent(magnet)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBeUndefined()
  expect(parsed.announce).toEqual([])

  // stream-magnet uri (as a utf8 string)
  const streamMagnet = `stream-magnet:?xt=urn:btih:${leavesParsed.infoHash}`
  parsed = await parseTorrent(streamMagnet)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBeUndefined()
  expect(parsed.announce).toEqual([])

  // magnet uri with name
  parsed = await parseTorrent(`${magnet}&dn=${encodeURIComponent(leavesParsed.name)}`)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual([])

  // magnet uri with trackers
  parsed = await parseTorrent(`${magnet}&tr=${encodeURIComponent('udp://tracker.example.com:80')}`)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBeUndefined()
  expect(parsed.announce).toEqual(['udp://tracker.example.com:80'])

  // .torrent file (as a Buffer)
  parsed = await parseTorrent(fixtures.leaves.torrent)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual(leavesParsed.announce)

  // parsed torrent (as an Object)
  parsed = await parseTorrent(leavesParsed)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual(leavesParsed.announce)

  // parsed torrent (as an Object), with string 'announce' property
  let leavesParsedModified = Object.assign({}, leavesParsed, {
    announce: 'udp://tracker.example.com:80',
  })
  parsed = await parseTorrent(leavesParsedModified)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual(['udp://tracker.example.com:80'])

  // parsed torrent (as an Object), with array 'announce' property
  leavesParsedModified = Object.assign({}, leavesParsed, {
    announce: ['udp://tracker.example.com:80', 'udp://tracker.example.com:81'],
  })
  parsed = await parseTorrent(leavesParsedModified)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual(['udp://tracker.example.com:80', 'udp://tracker.example.com:81'])

  // parsed torrent (as an Object), with empty 'announce' property
  leavesParsedModified = Object.assign({}, leavesParsed, { announce: undefined })
  parsed = await parseTorrent(leavesParsedModified)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual([])
})

test('parse single file torrent', async () => {
  const parsed = await parseTorrent(fixtures.leaves.torrent)
  expect(parsed.infoHash).toBe(leavesParsed.infoHash)
  expect(parsed.name).toBe(leavesParsed.name)
  expect(parsed.announce).toEqual(leavesParsed.announce)
})

test('parse multiple file torrent', async () => {
  const parsed = await parseTorrent(fixtures.numbers.torrent)
  expect(parsed.infoHash).toBe(numbersParsed.infoHash)
  expect(parsed.name).toBe(numbersParsed.name)
  expect(parsed.files).toEqual(numbersParsed.files)
  expect(parsed.announce).toEqual(numbersParsed.announce)
})

test('torrent file missing `name` field throws', async () => {
  await expect(parseTorrent(fixtures.corrupt.torrent)).rejects.toBeInstanceOf(Error)
})

test('parse url-list for webseed support', async () => {
  const torrent = await parseTorrent(fixtures.bunny.torrent)
  expect(torrent.urlList).toEqual([
    'http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_stereo_abl.mp4',
  ])
})

test('parse single file torrent from Blob', async () => {
  if (typeof Blob === 'undefined') {
    return
  }

  const leavesBlob = makeBlobShim(fixtures.leaves.torrent)
  await new Promise<void>((resolve, reject) => {
    remote(leavesBlob, (err, parsed) => {
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

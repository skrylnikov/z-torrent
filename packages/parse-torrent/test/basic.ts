/* global Blob */

import fixtures from './fixtures/index.ts'
import parseTorrent, { remote } from '../dist/index.js'
import test from 'tape'

const leavesParsed = await parseTorrent(fixtures.leaves.torrent)
const numbersParsed = await parseTorrent(fixtures.numbers.torrent)

test('Test supported torrentInfo types', async (t) => {
  let parsed

  // info hash (as a hex string)
  parsed = await parseTorrent(leavesParsed.infoHash)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, undefined)
  t.deepEqual(parsed.announce, [])

  // info hash (as a Buffer)
  parsed = await parseTorrent(Buffer.from(leavesParsed.infoHash, 'hex'))
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, undefined)
  t.deepEqual(parsed.announce, [])

  // magnet uri (as a utf8 string)
  const magnet = `magnet:?xt=urn:btih:${leavesParsed.infoHash}`
  parsed = await parseTorrent(magnet)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, undefined)
  t.deepEqual(parsed.announce, [])

  // stream-magnet uri (as a utf8 string)
  const streamMagnet = `stream-magnet:?xt=urn:btih:${leavesParsed.infoHash}`
  parsed = await parseTorrent(streamMagnet)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, undefined)
  t.deepEqual(parsed.announce, [])

  // magnet uri with name
  parsed = await parseTorrent(`${magnet}&dn=${encodeURIComponent(leavesParsed.name)}`)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, leavesParsed.name)
  t.deepEqual(parsed.announce, [])

  // magnet uri with trackers
  parsed = await parseTorrent(`${magnet}&tr=${encodeURIComponent('udp://tracker.example.com:80')}`)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, undefined)
  t.deepEqual(parsed.announce, ['udp://tracker.example.com:80'])

  // .torrent file (as a Buffer)
  parsed = await parseTorrent(fixtures.leaves.torrent)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, leavesParsed.name)
  t.deepEqual(parsed.announce, leavesParsed.announce)

  // parsed torrent (as an Object)
  parsed = await parseTorrent(leavesParsed)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, leavesParsed.name)
  t.deepEqual(parsed.announce, leavesParsed.announce)

  // parsed torrent (as an Object), with string 'announce' property
  let leavesParsedModified = Object.assign({}, leavesParsed, {
    announce: 'udp://tracker.example.com:80',
  })
  parsed = await parseTorrent(leavesParsedModified)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, leavesParsed.name)
  t.deepEqual(parsed.announce, ['udp://tracker.example.com:80'])

  // parsed torrent (as an Object), with array 'announce' property
  leavesParsedModified = Object.assign({}, leavesParsed, {
    announce: ['udp://tracker.example.com:80', 'udp://tracker.example.com:81'],
  })
  parsed = await parseTorrent(leavesParsedModified)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, leavesParsed.name)
  t.deepEqual(parsed.announce, ['udp://tracker.example.com:80', 'udp://tracker.example.com:81'])

  // parsed torrent (as an Object), with empty 'announce' property
  leavesParsedModified = Object.assign({}, leavesParsed, { announce: undefined })
  parsed = await parseTorrent(leavesParsedModified)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, leavesParsed.name)
  t.deepEqual(parsed.announce, [])

  t.end()
})

test('parse single file torrent', async (t) => {
  const parsed = await parseTorrent(fixtures.leaves.torrent)
  t.equal(parsed.infoHash, leavesParsed.infoHash)
  t.equal(parsed.name, leavesParsed.name)
  t.deepEquals(parsed.announce, leavesParsed.announce)
  t.end()
})

test('parse multiple file torrent', async (t) => {
  const parsed = await parseTorrent(fixtures.numbers.torrent)
  t.equal(parsed.infoHash, numbersParsed.infoHash)
  t.equal(parsed.name, numbersParsed.name)
  t.deepEquals(parsed.files, numbersParsed.files)
  t.deepEquals(parsed.announce, numbersParsed.announce)
  t.end()
})

test('torrent file missing `name` field throws', async (t) => {
  try {
    await parseTorrent(fixtures.corrupt.torrent)
  } catch (e) {
    t.ok(e instanceof Error)
  }
  t.end()
})

test('parse url-list for webseed support', async (t) => {
  const torrent = await parseTorrent(fixtures.bunny.torrent)
  t.deepEqual(torrent.urlList, [
    'http://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_stereo_abl.mp4',
  ])
  t.end()
})

test('parse single file torrent from Blob', (t) => {
  if (typeof Blob === 'undefined') {
    t.pass('Skipping Blob test')
    t.end()
    return
  }

  t.plan(4)
  const leavesBlob = makeBlobShim(fixtures.leaves.torrent)
  remote(leavesBlob, (err, parsed) => {
    t.error(err)
    t.equal(parsed.infoHash, leavesParsed.infoHash)
    t.equal(parsed.name, leavesParsed.name)
    t.deepEquals(parsed.announce, leavesParsed.announce)
  })
})

function makeBlobShim(buf: Buffer, name?: string) {
  const file = new Blob([buf]) as Blob & { name?: string }
  file.name = name
  return file
}

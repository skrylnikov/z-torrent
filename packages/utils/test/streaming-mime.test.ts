import { expect, test } from 'bun:test'

import {
  normalizeSwResponseContentType,
  resolveTorrentFileMime,
  streamingMimeFromFileName,
} from '../src/streaming-mime'

test('streamingMimeFromFileName', () => {
  expect(streamingMimeFromFileName('movie.mkv')).toBe('video/x-matroska')
  expect(streamingMimeFromFileName('/path/to/foo.MKV')).toBe('video/x-matroska')
  expect(streamingMimeFromFileName('track.mka')).toBe('audio/x-matroska')
  expect(streamingMimeFromFileName('noext')).toBeUndefined()
  expect(streamingMimeFromFileName('x.mp4')).toBeUndefined()
})

test('resolveTorrentFileMime keeps specific lite types', () => {
  expect(resolveTorrentFileMime('x.mkv', null)).toBe('video/x-matroska')
  expect(resolveTorrentFileMime('x.mkv', 'application/octet-stream')).toBe('video/x-matroska')
  expect(resolveTorrentFileMime('x.mp4', 'video/mp4')).toBe('video/mp4')
  expect(resolveTorrentFileMime('x.bin', 'application/octet-stream')).toBe('application/octet-stream')
})

test('normalizeSwResponseContentType', () => {
  const base = { 'X-Foo': '1' }
  expect(
    normalizeSwResponseContentType('https://h/z-torrent/ih/film.mkv', {
      ...base,
      'Content-Type': 'application/octet-stream',
    })['Content-Type']
  ).toBe('video/x-matroska')

  expect(
    normalizeSwResponseContentType('https://h/z-torrent/ih/film%20x.mkv', {
      'content-type': 'application/octet-stream',
    })['Content-Type']
  ).toBe('video/x-matroska')

  expect(
    normalizeSwResponseContentType('https://h/z-torrent/ih/film.mkv', {
      'Content-Type': 'video/mp4',
    })['Content-Type']
  ).toBe('video/mp4')

  const emptyCt = normalizeSwResponseContentType('https://h/z-torrent/ih/unknown.bin', {
    'Content-Type': '',
  })
  expect(emptyCt['Content-Type']).toBe('')
})

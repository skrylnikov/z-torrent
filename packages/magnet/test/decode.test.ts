import { expect, test } from 'bun:test'
import { magnet } from '../src/index.js'

const leavesOfGrass =
  'magnet:?xt=urn:btih:d2474e86c95b19b8bcfdb92bc12c9d44667cfa36&xt=urn:btmh:1220d2474e86c95b19b8bcfdb92bc12c9d44667cfa36d2474e86c95b19b8bcfdb92b&dn=Leaves+of+Grass+by+Walt+Whitman.epub&tr=udp%3A%2F%2Ftracker.example4.com%3A80&tr=udp%3A%2F%2Ftracker.example5.com%3A80&tr=udp%3A%2F%2Ftracker.example3.com%3A6969&tr=udp%3A%2F%2Ftracker.example2.com%3A80&tr=udp%3A%2F%2Ftracker.example1.com%3A1337'

const empty = { announce: [], urlList: [], peerAddresses: [] }

test('decode: valid magnet uris', () => {
  const result = magnet.decode(leavesOfGrass)
  expect(result.dn).toBe('Leaves of Grass by Walt Whitman.epub')
  expect(result.infoHash).toBe('d2474e86c95b19b8bcfdb92bc12c9d44667cfa36')
  expect(result.infoHashV2).toBe('d2474e86c95b19b8bcfdb92bc12c9d44667cfa36d2474e86c95b19b8bcfdb92b')

  const xt = [
    'urn:btih:d2474e86c95b19b8bcfdb92bc12c9d44667cfa36',
    'urn:btmh:1220d2474e86c95b19b8bcfdb92bc12c9d44667cfa36d2474e86c95b19b8bcfdb92b',
  ]

  const announce = [
    'udp://tracker.example1.com:1337',
    'udp://tracker.example2.com:80',
    'udp://tracker.example3.com:6969',
    'udp://tracker.example4.com:80',
    'udp://tracker.example5.com:80',
  ]

  expect((result.xt as string[]).sort()).toEqual(xt.sort())
  expect((result.tr as string[]).sort()).toEqual(announce.sort())
  expect(result.announce!.sort()).toEqual(announce.sort())
})

test('decode: empty magnet URIs return empty object', () => {
  const empty1 = ''
  const empty2 = 'magnet:'
  const empty3 = 'magnet:?'

  expect(magnet.decode(empty1)).toEqual(empty)
  expect(magnet.decode(empty2)).toEqual(empty)
  expect(magnet.decode(empty3)).toEqual(empty)
})

test('empty string as keys is okay', () => {
  const uri = 'magnet:?a=&b=&c='
  expect(magnet.decode(uri)).toEqual(Object.assign({ a: '', b: '', c: '' }, empty))
})

test('decode: invalid magnet URIs return empty object', () => {
  const invalid1 = 'magnet:?xt=urn:btih:==='
  const invalid2 = 'magnet:?xt'
  const invalid3 = 'magnet:?xt=?dn='
  const invalid4 = 'magnet:?xt=urn:btmh:==='

  expect(magnet.decode(invalid1)).toEqual(empty)
  expect(magnet.decode(invalid2)).toEqual(empty)
  expect(magnet.decode(invalid3)).toEqual(empty)
  expect(magnet.decode(invalid4)).toEqual(empty)
})

test('decode: invalid magnet URIs return only valid keys (ignoring invalid ones)', () => {
  const invalid1 = 'magnet:?a=a&==='
  const invalid2 = 'magnet:?a==&b=b'
  const invalid3 = 'magnet:?a=b=&c=c&d==='

  expect(magnet.decode(invalid1)).toEqual(Object.assign({ a: 'a' }, empty))
  expect(magnet.decode(invalid2)).toEqual(Object.assign({ b: 'b' }, empty))
  expect(magnet.decode(invalid3)).toEqual(Object.assign({ c: 'c' }, empty))
})

test('decode: extracts 40-char hex BitTorrent info_hash', () => {
  const result = magnet.decode('magnet:?xt=urn:btih:aad050ee1bb22e196939547b134535824dabf0ce')
  expect(result.infoHash).toBe('aad050ee1bb22e196939547b134535824dabf0ce')
})

test('decode: extracts 32-char base32 BitTorrent info_hash', () => {
  const result = magnet.decode('magnet:?xt=urn:btih:64DZYZWMUAVLIWJUXGDIK4QGAAIN7SL6')
  expect(result.infoHash).toBe('f7079c66cca02ab45934b9868572060010dfc97e')
})

test('decode: extracts 64-char hex BitTorrent V2 info_hash', () => {
  const result = magnet.decode(
    'magnet:?xt=urn:btmh:122080e00d84343afd2b6392e966c1267807461946ba9db1d5af4bb50779dcf1ab4e'
  )
  expect(result.infoHash).toBeUndefined()
  expect(result.infoHashV2).toBe('80e00d84343afd2b6392e966c1267807461946ba9db1d5af4bb50779dcf1ab4e')
})

test('decode: extracts keywords', () => {
  const result = magnet.decode(
    'magnet:?xt=urn:btih:64DZYZWMUAVLIWJUXGDIK4QGAAIN7SL6&kt=joe+blow+mp3'
  )
  expect(result.keywords).toEqual(['joe', 'blow', 'mp3'])
})

test('decode: complicated magnet uri (multiple xt params, and as, xs)', () => {
  const result = magnet.decode(
    'magnet:?xt=urn:ed2k:354B15E68FB8F36D7CD88FF94116CDC1&xt=urn:tree:tiger:7N5OAMRNGMSSEUE3ORHOKWN4WWIQ5X4EBOOTLJY&xt=urn:btih:QHQXPYWMACKDWKP47RRVIV7VOURXFE5Q&xl=10826029&dn=mediawiki-1.15.1.tar.gz&tr=udp%3A%2F%2Ftracker.example4.com%3A80%2Fannounce&as=http%3A%2F%2Fdownload.wikimedia.org%2Fmediawiki%2F1.15%2Fmediawiki-1.15.1.tar.gz&xs=http%3A%2F%2Fcache.example.org%2FXRX2PEFXOOEJFRVUCX6HMZMKS5TWG4K5&xs=dchub://example.org'
  )
  expect(result.infoHash).toBe('81e177e2cc00943b29fcfc635457f575237293b0')
  expect(result.xt).toEqual([
    'urn:ed2k:354B15E68FB8F36D7CD88FF94116CDC1',
    'urn:tree:tiger:7N5OAMRNGMSSEUE3ORHOKWN4WWIQ5X4EBOOTLJY',
    'urn:btih:QHQXPYWMACKDWKP47RRVIV7VOURXFE5Q',
  ])
  expect((result as Record<string, unknown>).xl).toBe('10826029')
  expect(result.dn).toBe('mediawiki-1.15.1.tar.gz')
  const announce = 'udp://tracker.example4.com:80/announce'
  expect(result.tr).toEqual(announce)
  expect(result.announce).toEqual([announce])
  expect(result.as).toBe('http://download.wikimedia.org/mediawiki/1.15/mediawiki-1.15.1.tar.gz')
  expect(result.urlList).toEqual([
    'http://download.wikimedia.org/mediawiki/1.15/mediawiki-1.15.1.tar.gz',
  ])
  expect(result.xs).toEqual([
    'http://cache.example.org/XRX2PEFXOOEJFRVUCX6HMZMKS5TWG4K5',
    'dchub://example.org',
  ])
})

test('multiple as, ws params', () => {
  const result = magnet.decode(
    'magnet:?xt=urn:ed2k:354B15E68FB8F36D7CD88FF94116CDC1&as=http%3A%2F%2Fdownload.wikimedia.org%2Fmediawiki%2F1.15%2Fmediawiki-1.15.1.tar.gz&as=http%3A%2F%2Fdownload.wikimedia.org%2Fmediawiki%2F1.15%2Fmediawiki-1.15.1.tar.gz1&ws=http%3A%2F%2Fdownload.wikimedia.org%2Fmediawiki%2F1.15%2Fmediawiki-1.15.1.tar.gz2&ws=http%3A%2F%2Fdownload.wikimedia.org%2Fmediawiki%2F1.15%2Fmediawiki-1.15.1.tar.gz3'
  )
  expect(result.urlList).toEqual([
    'http://download.wikimedia.org/mediawiki/1.15/mediawiki-1.15.1.tar.gz',
    'http://download.wikimedia.org/mediawiki/1.15/mediawiki-1.15.1.tar.gz1',
    'http://download.wikimedia.org/mediawiki/1.15/mediawiki-1.15.1.tar.gz2',
    'http://download.wikimedia.org/mediawiki/1.15/mediawiki-1.15.1.tar.gz3',
  ])
})

test('dedupe repeated trackers', () => {
  const result = magnet.decode(
    'magnet:?xt=urn:ed2k:354B15E68FB8F36D7CD88FF94116CDC1&tr=udp%3A%2F%2Ftracker.example4.com%3A80&tr=udp%3A%2F%2Ftracker.example4.com%3A80&tr=udp%3A%2F%2Ftracker.example5.com%3A80&tr=udp%3A%2F%2Ftracker.example3.com%3A6969&tr=udp%3A%2F%2Ftracker.example2.com%3A80&tr=udp%3A%2F%2Ftracker.example1.com%3A1337'
  )
  const announce = [
    'udp://tracker.example1.com:1337',
    'udp://tracker.example2.com:80',
    'udp://tracker.example3.com:6969',
    'udp://tracker.example4.com:80',
    'udp://tracker.example5.com:80',
  ]
  expect(result.announce!.sort()).toEqual(announce.sort())
})

test('Cast file index (ix) to a number', () => {
  const result = magnet.decode(`${leavesOfGrass}&ix=1`)
  expect(typeof result.ix).toBe('number')
  expect(result.ix).toBe(1)
})

test('decode: Extracts public key from xs', () => {
  const key = '9a36edf0988ddc1a0fc02d4e8652cce87a71aaac71fce936e650a597c0fb72e0'
  const result = magnet.decode(`magnet:?xs=urn:btpk:${key}`)
  expect(result.publicKey).toBe(key)
  expect(result.publicKeyBuffer).toEqual(new Uint8Array(Buffer.from(key, 'hex')))
})

test('decode: select-only', () => {
  const result = magnet.decode('magnet:?xt=urn:btih:64DZYZWMUAVLIWJUXGDIK4QGAAIN7SL6&so=0,2,4,6-8')
  expect(result.so).toEqual([0, 2, 4, 6, 7, 8])
})

test('decode: peer-address single value', () => {
  const result = magnet.decode(
    'magnet:?xt=urn:btih:64DZYZWMUAVLIWJUXGDIK4QGAAIN7SL6&x.pe=123.213.32.10:47450'
  )
  const peerAddresses = ['123.213.32.10:47450']
  expect(result['x.pe']).toEqual(peerAddresses[0])
  expect(result.peerAddresses).toEqual(peerAddresses)
})

test('decode: peer-address multiple values', () => {
  const result = magnet.decode(
    'magnet:?xt=urn:btih:64DZYZWMUAVLIWJUXGDIK4QGAAIN7SL6&x.pe=123.213.32.10:47450&x.pe=[2001:db8::2]:55013'
  )
  const peerAddresses = ['123.213.32.10:47450', '[2001:db8::2]:55013']
  expect(result['x.pe']).toEqual(peerAddresses)
  expect(result.peerAddresses).toEqual(peerAddresses)
})

test('decode: peer-address remove duplicates', () => {
  const result = magnet.decode(
    'magnet:?xt=urn:btih:64DZYZWMUAVLIWJUXGDIK4QGAAIN7SL6&x.pe=123.213.32.10:47450&x.pe=[2001:db8::2]:55013&x.pe=123.213.32.10:47450'
  )
  expect(result['x.pe']).toEqual([
    '123.213.32.10:47450',
    '[2001:db8::2]:55013',
    '123.213.32.10:47450',
  ])
  expect(result.peerAddresses).toEqual(['123.213.32.10:47450', '[2001:db8::2]:55013'])
})

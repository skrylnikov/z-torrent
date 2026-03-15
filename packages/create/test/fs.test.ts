import { expect, test } from 'bun:test'
import fixtures from '@z-torrent/fixtures'
import parseTorrent from '@z-torrent/parse'
import path from 'path'
import { hash } from 'uint8-util'
import { createTorrentPromise } from './helpers.js'

test('create single file torrent', async () => {
  const startTime = Date.now()
  const torrent = await createTorrentPromise(fixtures.leaves.contentPath)
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('Leaves of Grass by Walt Whitman.epub')
  expect(parsedTorrent.private).toBeFalsy()
  expect(parsedTorrent.created.getTime()).toBeGreaterThanOrEqual(startTime)
  expect(Array.isArray(parsedTorrent.announce)).toBe(true)
  expect(path.normalize(parsedTorrent.files[0].path)).toBe(
    path.normalize('Leaves of Grass by Walt Whitman.epub')
  )
  expect(parsedTorrent.files[0].length).toBe(362017)
  expect(parsedTorrent.length).toBe(362017)
  expect(parsedTorrent.pieceLength).toBe(16384)
  expect(parsedTorrent.pieces).toEqual([
    '1f9c3f59beec079715ec53324bde8569e4a0b4eb',
    'ec42307d4ce5557b5d3964c5ef55d354cf4a6ecc',
    '7bf1bcaf79d11fa5e0be06593c8faafc0c2ba2cf',
    '76d71c5b01526b23007f9e9929beafc5151e6511',
    '0931a1b44c21bf1e68b9138f90495e690dbc55f5',
    '72e4c2944cbacf26e6b3ae8a7229d88aafa05f61',
    'eaae6abf3f07cb6db9677cc6aded4dd3985e4586',
    '27567fa7639f065f71b18954304aca6366729e0b',
    '4773d77ae80caa96a524804dfe4b9bd3deaef999',
    'c9dd51027467519d5eb2561ae2cc01467de5f643',
    '0a60bcba24797692efa8770d23df0a830d91cb35',
    'b3407a88baa0590dc8c9aa6a120f274367dcd867',
    'e88e8338c572a06e3c801b29f519df532b3e76f6',
    '70cf6aee53107f3d39378483f69cf80fa568b1ea',
    'c53b506159e988d8bc16922d125d77d803d652c3',
    'ca3070c16eed9172ab506d20e522ea3f1ab674b3',
    'f923d76fe8f44ff32e372c3b376564c6fb5f0dbe',
    '52164f03629fd1322636babb2c014b7dae582da4',
    '1363965261e6ce12b43701f0a8c9ed1520a70eba',
    '004400a267765f6d3dd5c7beb5bd3c75f3df2a54',
    '560a61801147fa4ec7cf568e703acb04e5610a4d',
    '56dcc242d03293e9446cf5e457d8eb3d9588fd90',
    'c698de9b0dad92980906c026d8c1408fa08fe4ec',
  ])
  expect(await hash(parsedTorrent.infoBuffer, 'hex')).toBe(
    'd2474e86c95b19b8bcfdb92bc12c9d44667cfa36'
  )
})

test('create single file torrent from buffer', async () => {
  const torrent = await createTorrentPromise(Buffer.from('blah'), { name: 'blah.txt' })
  await expect(parseTorrent(torrent)).resolves.toBeDefined()
})

test('create multi file torrent', async () => {
  const startTime = Date.now()
  const torrent = await createTorrentPromise(fixtures.numbers.contentPath, {
    pieceLength: 32768,
    private: false,
  })
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('numbers')
  expect(parsedTorrent.private).toBeFalsy()
  expect(parsedTorrent.created.getTime()).toBeGreaterThanOrEqual(startTime)
  expect(Array.isArray(parsedTorrent.announce)).toBe(true)
  const files = parsedTorrent.files.sort((a, b) => a.path.localeCompare(b.path))
  expect(path.normalize(files[0].path)).toBe(path.normalize('numbers/1.txt'))
  expect(files[0].length).toBe(1)
  expect(path.normalize(files[1].path)).toBe(path.normalize('numbers/2.txt'))
  expect(files[1].length).toBe(2)
  expect(path.normalize(files[2].path)).toBe(path.normalize('numbers/3.txt'))
  expect(files[2].length).toBe(3)
  expect(parsedTorrent.length).toBe(6)
  expect(parsedTorrent.info.pieces.length).toBe(20)
  expect(parsedTorrent.pieceLength).toBe(32768)
  expect(parsedTorrent.pieces).toHaveLength(1)
  expect(parsedTorrent.pieces[0]).toMatch(/^[a-f0-9]{40}$/)
  expect(parsedTorrent.infoHash).toMatch(/^[a-f0-9]{40}$/)
})

test('create multi file torrent with nested directories', async () => {
  const startTime = Date.now()
  const torrent = await createTorrentPromise(fixtures.lotsOfNumbers.contentPath, {
    pieceLength: 32768,
    private: false,
  })
  const parsedTorrent = await parseTorrent(torrent)

  expect(parsedTorrent.name).toBe('lots-of-numbers')
  expect(parsedTorrent.private).toBeFalsy()
  expect(parsedTorrent.created.getTime()).toBeGreaterThanOrEqual(startTime)
  expect(Array.isArray(parsedTorrent.announce)).toBe(true)
  const files = parsedTorrent.files.sort((a, b) => a.path.localeCompare(b.path))
  expect(path.normalize(files[0].path)).toBe(path.normalize('lots-of-numbers/big numbers/10.txt'))
  expect(files[0].length).toBe(2)
  expect(path.normalize(files[1].path)).toBe(path.normalize('lots-of-numbers/big numbers/11.txt'))
  expect(files[1].length).toBe(2)
  expect(path.normalize(files[2].path)).toBe(path.normalize('lots-of-numbers/big numbers/12.txt'))
  expect(files[2].length).toBe(2)
  expect(path.normalize(files[3].path)).toBe(path.normalize('lots-of-numbers/small numbers/1.txt'))
  expect(files[3].length).toBe(1)
  expect(path.normalize(files[4].path)).toBe(path.normalize('lots-of-numbers/small numbers/2.txt'))
  expect(files[4].length).toBe(2)
  expect(path.normalize(files[5].path)).toBe(path.normalize('lots-of-numbers/small numbers/3.txt'))
  expect(files[5].length).toBe(3)
  expect(parsedTorrent.length).toBe(12)
  expect(parsedTorrent.pieceLength).toBe(32768)
  expect(parsedTorrent.pieces).toHaveLength(1)
  expect(parsedTorrent.pieces[0]).toMatch(/^[a-f0-9]{40}$/)
  expect(parsedTorrent.infoHash).toMatch(/^[a-f0-9]{40}$/)
})

test('create multi file torrent with array of paths', async () => {
  const number10Path = path.join(fixtures.lotsOfNumbers.contentPath, 'big numbers', '10.txt')
  const number11Path = path.join(fixtures.lotsOfNumbers.contentPath, 'big numbers', '11.txt')
  const numbersPath = fixtures.numbers.contentPath
  const input = [number10Path, number11Path, numbersPath]

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
  expect(path.normalize(files[2].path)).toBe(path.normalize('multi/numbers/1.txt'))
  expect(files[2].length).toBe(1)
  expect(path.normalize(files[3].path)).toBe(path.normalize('multi/numbers/2.txt'))
  expect(files[3].length).toBe(2)
  expect(path.normalize(files[4].path)).toBe(path.normalize('multi/numbers/3.txt'))
  expect(files[4].length).toBe(3)
  expect(parsedTorrent.length).toBe(10)
  expect(parsedTorrent.info.pieces.length).toBe(20)
  expect(parsedTorrent.pieceLength).toBe(32768)
  expect(parsedTorrent.pieces).toHaveLength(1)
  expect(parsedTorrent.pieces[0]).toMatch(/^[a-f0-9]{40}$/)
  expect(parsedTorrent.infoHash).toMatch(/^[a-f0-9]{40}$/)
})

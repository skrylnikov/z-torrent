import fs from 'fs'
import path, { dirname } from 'path'
import parseTorrent, { parseTorrentSync, toMagnetURI, type Instance } from 'parse-torrent'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface Fixture {
  contentPath?: string
  torrentPath?: string
  content?: Buffer
  torrent?: Buffer
  parsedTorrent?: Instance
  magnetURI?: string
  path?: string
  gzipPath?: string
}

export interface Fixtures {
  leaves: Fixture
  alice: Fixture
  folder: Fixture
  numbers: Fixture
  lotsOfNumbers: Fixture
  bunny: Fixture
  sintel: Fixture
  leavesMetadata: Fixture
  corrupt: Fixture
  blocklist: { path: string; gzipPath: string }
}

const fixtures: Fixtures = {
  leaves: {
    contentPath: path.join(__dirname, '../fixtures', 'Leaves of Grass by Walt Whitman.epub'),
    torrentPath: path.join(__dirname, '../fixtures', 'leaves.torrent'),
    content: fs.readFileSync(
      path.join(__dirname, '../fixtures', 'Leaves of Grass by Walt Whitman.epub')
    ),
    torrent: fs.readFileSync(path.join(__dirname, '../fixtures', 'leaves.torrent')),
    get parsedTorrent() {
      return parseTorrentSync(
        fs.readFileSync(path.join(__dirname, '../fixtures', 'leaves.torrent'))
      )
    },
    get magnetURI() {
      return toMagnetURI(
        parseTorrentSync(fs.readFileSync(path.join(__dirname, '../fixtures', 'leaves.torrent')))
      )
    },
  },

  alice: {
    contentPath: path.join(__dirname, '../fixtures', 'alice.txt'),
    torrentPath: path.join(__dirname, '../fixtures', 'alice.torrent'),
    content: fs.readFileSync(path.join(__dirname, '../fixtures', 'alice.txt')),
    torrent: fs.readFileSync(path.join(__dirname, '../fixtures', 'alice.torrent')),
    get parsedTorrent() {
      return parseTorrentSync(fs.readFileSync(path.join(__dirname, '../fixtures', 'alice.torrent')))
    },
    get magnetURI() {
      return toMagnetURI(
        parseTorrentSync(fs.readFileSync(path.join(__dirname, '../fixtures', 'alice.torrent')))
      )
    },
  },

  folder: {
    contentPath: path.join(__dirname, '../fixtures', 'folder'),
    torrentPath: path.join(__dirname, '../fixtures', 'folder.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, '../fixtures', 'folder.torrent')),
    get parsedTorrent() {
      return parseTorrentSync(
        fs.readFileSync(path.join(__dirname, '../fixtures', 'folder.torrent'))
      )
    },
    get magnetURI() {
      return toMagnetURI(
        parseTorrentSync(fs.readFileSync(path.join(__dirname, '../fixtures', 'folder.torrent')))
      )
    },
  },

  numbers: {
    contentPath: path.join(__dirname, '../fixtures', 'numbers'),
    torrentPath: path.join(__dirname, '../fixtures', 'numbers.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, '../fixtures', 'numbers.torrent')),
    get parsedTorrent() {
      return parseTorrentSync(
        fs.readFileSync(path.join(__dirname, '../fixtures', 'numbers.torrent'))
      )
    },
    get magnetURI() {
      return toMagnetURI(
        parseTorrentSync(fs.readFileSync(path.join(__dirname, '../fixtures', 'numbers.torrent')))
      )
    },
  },

  lotsOfNumbers: {
    contentPath: path.join(__dirname, '../fixtures', 'lots-of-numbers'),
    torrentPath: path.join(__dirname, '../fixtures', 'lots-of-numbers.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, '../fixtures', 'lots-of-numbers.torrent')),
    get parsedTorrent() {
      return parseTorrentSync(
        fs.readFileSync(path.join(__dirname, '../fixtures', 'lots-of-numbers.torrent'))
      )
    },
    get magnetURI() {
      return toMagnetURI(
        parseTorrentSync(
          fs.readFileSync(path.join(__dirname, '../fixtures', 'lots-of-numbers.torrent'))
        )
      )
    },
  },

  bunny: {
    torrentPath: path.join(__dirname, '../fixtures', 'bunny.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, '../fixtures', 'bunny.torrent')),
    get parsedTorrent() {
      return parseTorrentSync(fs.readFileSync(path.join(__dirname, '../fixtures', 'bunny.torrent')))
    },
    get magnetURI() {
      return toMagnetURI(
        parseTorrentSync(fs.readFileSync(path.join(__dirname, '../fixtures', 'bunny.torrent')))
      )
    },
  },

  sintel: {
    torrentPath: path.join(__dirname, '../fixtures', 'sintel.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, '../fixtures', 'sintel.torrent')),
    get parsedTorrent() {
      return parseTorrentSync(
        fs.readFileSync(path.join(__dirname, '../fixtures', 'sintel.torrent'))
      )
    },
    get magnetURI() {
      return toMagnetURI(
        parseTorrentSync(fs.readFileSync(path.join(__dirname, '../fixtures', 'sintel.torrent')))
      )
    },
  },

  leavesMetadata: {
    contentPath: path.join(__dirname, '../fixtures', 'Leaves of Grass by Walt Whitman.epub'),
    torrentPath: path.join(__dirname, '../fixtures', 'leaves-metadata.torrent'),
    content: fs.readFileSync(
      path.join(__dirname, '../fixtures', 'Leaves of Grass by Walt Whitman.epub')
    ),
    torrent: fs.readFileSync(path.join(__dirname, '../fixtures', 'leaves-metadata.torrent')),
    get parsedTorrent() {
      return parseTorrentSync(
        fs.readFileSync(path.join(__dirname, '../fixtures', 'leaves-metadata.torrent'))
      )
    },
    get magnetURI() {
      return toMagnetURI(
        parseTorrentSync(
          fs.readFileSync(path.join(__dirname, '../fixtures', 'leaves-metadata.torrent'))
        )
      )
    },
  },

  corrupt: {
    torrentPath: path.join(__dirname, '../fixtures', 'corrupt.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, '../fixtures', 'corrupt.torrent')),
  },

  blocklist: {
    path: path.join(__dirname, '../fixtures', 'blocklist.txt'),
    gzipPath: path.join(__dirname, '../fixtures', 'blocklist.txt.gz'),
  },
}

export default fixtures

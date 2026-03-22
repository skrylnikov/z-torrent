import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const torrentFixtures = {
  leaves: {
    torrentPath: path.join(__dirname, 'leaves.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, 'leaves.torrent')),
  },
  leavesMetadata: {
    torrentPath: path.join(__dirname, 'leaves-metadata.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, 'leaves-metadata.torrent')),
  },
  numbers: {
    torrentPath: path.join(__dirname, 'numbers.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, 'numbers.torrent')),
  },
  bunny: {
    torrentPath: path.join(__dirname, 'bunny.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, 'bunny.torrent')),
  },
  corrupt: {
    torrentPath: path.join(__dirname, 'corrupt.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, 'corrupt.torrent')),
  },
  'bittorrent-v2-test': {
    torrentPath: path.join(__dirname, 'bittorrent-v2-test.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, 'bittorrent-v2-test.torrent')),
  },
  'bittorrent-v2-hybrid-test': {
    torrentPath: path.join(__dirname, 'bittorrent-v2-hybrid-test.torrent'),
    torrent: fs.readFileSync(path.join(__dirname, 'bittorrent-v2-hybrid-test.torrent')),
  },
}

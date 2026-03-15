import fs from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default {
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
}

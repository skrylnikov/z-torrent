import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../..')
const webtorrentDir = join(root, 'webtorrent')
const webtorrentDist = join(webtorrentDir, 'dist')
const distDir = join(__dirname, '../dist')

// Build browser bundle in webtorrent package
const result = spawnSync('bun', ['run', 'build-browser'], {
  cwd: webtorrentDir,
  stdio: 'inherit',
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

mkdirSync(distDir, { recursive: true })

const artifacts = ['z-torrent.min.js', 'z-torrent.min.js.map', 'sw.min.js', 'sw.min.js.map']
for (const name of artifacts) {
  const src = join(webtorrentDist, name)
  if (existsSync(src)) {
    copyFileSync(src, join(distDir, name))
  }
}

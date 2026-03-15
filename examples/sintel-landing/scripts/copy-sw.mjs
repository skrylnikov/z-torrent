import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../../..')
const webtorrentBrowserDir = join(root, 'packages/browser')
const publicDir = join(__dirname, '../public')

// Ensure browser build exists (z-torrent-browser)
spawnSync('bun', ['run', 'build'], {
  cwd: webtorrentBrowserDir,
  stdio: 'inherit',
})

// Copy service worker (required for streaming; z-torrent.min.js is bundled via import)
const swSrc = join(webtorrentBrowserDir, 'dist/sw.min.js')
if (existsSync(swSrc)) {
  mkdirSync(publicDir, { recursive: true })
  copyFileSync(swSrc, join(publicDir, 'sw.min.js'))
}

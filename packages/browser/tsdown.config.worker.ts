import { defineConfig } from 'tsdown'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const cryptoPath = require.resolve('crypto-browserify')
const trackerClientBrowser = resolve(__dirname, '../tracker/dist/client.browser.js')

export default defineConfig({
  entry: {
    'sw.min': 'src/lib/worker.ts',
  },
  platform: 'browser',
  format: 'esm',
  sourcemap: true,
  minify: true,
  dts: false,
  outDir: 'dist',
  hash: false,
  clean: false,
  resolve: {
    alias: {
      crypto: cryptoPath,
      '@z-torrent/tracker/client': trackerClientBrowser,
    },
  },
  deps: {
    alwaysBundle: [
      '@z-torrent/core',
      '@thaunknown/simple-peer',
      '@z-torrent/tracker',
      '@z-torrent/tracker/client',
      'crypto-browserify',
    ],
    neverBundle: ['node-datachannel'],
  },
  define: {
    global: 'globalThis',
  },
})

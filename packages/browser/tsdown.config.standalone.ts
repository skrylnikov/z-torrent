import { defineConfig } from 'tsdown'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const dgramPath = resolve(__dirname, 'src/polyfills/empty-dgram.js')
const streamPath = require.resolve('stream-browserify')
const trackerClientBrowser = resolve(__dirname, '../tracker/dist/client.browser.js')

export default defineConfig({
  entry: {
    'z-torrent.min': 'src/index.ts',
  },
  platform: 'browser',
  format: 'esm',
  sourcemap: true,
  minify: true,
  dts: true,
  outDir: 'dist',
  hash: false,
  clean: false,
  outputOptions: {
    codeSplitting: false,
  },
  resolve: {
    alias: {
      dgram: dgramPath,
      stream: streamPath,
      '@z-torrent/tracker/client': trackerClientBrowser,
    },
  },
  deps: {
    alwaysBundle: [/^@z-torrent\//, '@thaunknown/simple-peer'],
    neverBundle: ['node-datachannel'],
  },
  define: {
    global: 'globalThis',
    'process.browser': 'true',
  },
})

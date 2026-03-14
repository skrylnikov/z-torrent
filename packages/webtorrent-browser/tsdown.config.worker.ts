import { defineConfig } from 'tsdown'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
      crypto: resolve(__dirname, '../../node_modules/.bun/crypto-browserify@3.12.1/node_modules/crypto-browserify/index.js'),
      'bittorrent-tracker/client': resolve(__dirname, '../../packages/bittorrent-tracker/dist/client.js'),
    },
  },
  deps: {
    alwaysBundle: ['z-torrent-core', '@thaunknown/simple-peer', 'bittorrent-tracker', 'bittorrent-tracker/client', 'crypto-browserify'],
    neverBundle: ['node-datachannel'],
  },
  define: {
    global: 'globalThis',
  },
})

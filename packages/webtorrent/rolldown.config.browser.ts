import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'rolldown'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  input: 'src/index.ts',
  platform: 'browser',
  output: {
    file: 'dist/z-torrent.min.js',
    format: 'esm',
    sourcemap: true,
    minify: true,
    codeSplitting: false,
  },
  resolve: {
    aliasFields: [['browser']],
    alias: {
      path: path.resolve(__dirname, 'node_modules/path-esm/index.js'),
      process: path.resolve(__dirname, 'src/polyfills/process-fast.ts'),
      '../version.cjs': path.resolve(__dirname, 'src/version-browser.ts'),
      'bittorrent-dht': path.resolve(__dirname, 'src/browser/empty-dht.ts'),
      'load-ip-set': path.resolve(__dirname, 'src/browser/empty-load-ip-set.ts'),
      '@silentbot1/nat-api': path.resolve(__dirname, 'src/browser/empty-nat-api.ts'),
      './lib/conn-pool.js': path.resolve(__dirname, 'src/browser/empty-conn-pool.ts'),
    },
  },
  define: {
    global: 'globalThis',
  },
  external: ['node-datachannel', 'webrtc-polyfill'],
  dts: false,
})

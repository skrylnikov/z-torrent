import { defineConfig } from 'tsdown'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

const dgramPath = resolve(__dirname, 'src/polyfills/empty-dgram.js')
const streamPath = require.resolve('stream-browserify')
const trackerClientBrowser = resolve(__dirname, '../tracker/dist/client.browser.js')

function aliasPlugin() {
  return {
    name: 'alias-node-polyfills',
    resolveId(source: string) {
      if (source === 'dgram') return dgramPath
      if (source === 'stream') return streamPath
      return null
    },
  }
}

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
  clean: true,
  outputOptions: {
    codeSplitting: false,
  },
  plugins: [aliasPlugin()],
  resolve: {
    alias: {
      dgram: dgramPath,
      stream: streamPath,
      '@z-torrent/tracker/client': trackerClientBrowser,
    },
  },
  deps: {
    alwaysBundle: [
      '@z-torrent/core',
      '@thaunknown/simple-peer',
      '@z-torrent/tracker',
      '@z-torrent/tracker/client',
    ],
    neverBundle: ['node-datachannel'],
  },
  define: {
    global: 'globalThis',
    'process.browser': 'true',
  },
})

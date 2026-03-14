import { defineConfig } from 'tsdown'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dgramPath = resolve(__dirname, 'src/polyfills/empty-dgram.js')
const streamPath = resolve(__dirname, '../../node_modules/.bun/stream-browserify@2.0.2/node_modules/stream-browserify/index.js')

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
  dts: false,
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
      'bittorrent-tracker/client': resolve(__dirname, '../../packages/bittorrent-tracker/dist/client.js'),
    },
  },
  deps: {
    alwaysBundle: ['z-torrent-core', '@thaunknown/simple-peer', 'bittorrent-tracker', 'bittorrent-tracker/client'],
    neverBundle: ['node-datachannel'],
  },
  define: {
    global: 'globalThis',
    'process.browser': 'true',
  },
})

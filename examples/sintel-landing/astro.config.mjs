import { defineConfig } from 'astro/config'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

export default defineConfig({
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [
      nodePolyfills({
        include: ['stream', 'util', 'buffer'],
        globals: { Buffer: true, process: true },
      }),
    ],
    define: {
      global: 'globalThis',
      'process.env': '{}',
      'process.browser': 'true',
    },
    resolve: {
      alias: {
        'z-torrent-browser': resolve(
          __dirname,
          '../../packages/webtorrent-browser/dist/z-torrent.min.js'
        ),
        // Resolve externals from pre-built z-torrent.min.js
        crypto: require.resolve('crypto-browserify'),
        'bittorrent-tracker/client': resolve(__dirname, '../../packages/bittorrent-tracker/dist/client.js'),
        dgram: resolve(__dirname, 'src/polyfills/empty.js'),
      },
    },
    optimizeDeps: {
      include: ['webrtc-polyfill', '@thaunknown/simple-peer'],
      exclude: ['z-torrent-browser'],
    },
  },
})

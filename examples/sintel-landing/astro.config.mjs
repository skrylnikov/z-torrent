import { defineConfig } from 'astro/config'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    define: {
      global: 'globalThis',
      'process.env': '{}',
      'process.browser': 'true',
    },
    resolve: {
      alias: {
        'z-torrent-browser': resolve(__dirname, '../../packages/browser/dist/z-torrent.min.js'),
      },
    },
    optimizeDeps: {
      include: ['webrtc-polyfill', '@thaunknown/simple-peer'],
      exclude: ['z-torrent-browser'],
    },
  },
})

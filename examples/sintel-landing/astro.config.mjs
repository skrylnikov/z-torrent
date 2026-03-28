import { defineConfig } from 'astro/config'
import { zTorrentSW } from '@z-torrent/browser/vite'

export default defineConfig({
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [zTorrentSW()],
    define: {
      global: 'globalThis',
      'process.env': '{}',
      'process.browser': 'true',
    },
    optimizeDeps: {
      include: ['webrtc-polyfill', '@thaunknown/simple-peer'],
    },
  },
})

import { defineConfig } from 'astro/config'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { zTorrentSW } from '@z-torrent/browser/vite'

export default defineConfig({
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [
      zTorrentSW(),
      nodePolyfills({
        protocolImports: true,
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
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

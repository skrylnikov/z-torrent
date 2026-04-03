import { svelte } from '@sveltejs/vite-plugin-svelte'
import { zTorrentSW } from '@z-torrent/browser/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [svelte(), zTorrentSW()],
  define: {
    'import.meta.env.VITE_DEV_TRACKER': JSON.stringify(process.env.VITE_DEV_TRACKER ?? ''),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
})

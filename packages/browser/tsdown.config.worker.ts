import { defineConfig } from 'tsdown'

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
  deps: {
    alwaysBundle: [/^@z-torrent\//],
    neverBundle: ['node-datachannel'],
  },
  define: {
    global: 'globalThis',
  },
})

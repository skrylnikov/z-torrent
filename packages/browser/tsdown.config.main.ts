import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  platform: 'browser',
  format: 'esm',
  sourcemap: true,
  minify: false,
  dts: true,
  outDir: 'dist',
  hash: false,
  clean: true,
  deps: {
    neverBundle: ['node-datachannel'],
  },
  define: {
    global: 'globalThis',
  },
})

import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'vite-plugin': 'src/vite-plugin.ts',
  },
  platform: 'node',
  format: 'esm',
  sourcemap: false,
  minify: false,
  dts: true,
  outDir: 'dist',
  hash: false,
  clean: false,
})

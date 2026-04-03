import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  platform: 'browser',
  format: 'esm',
  sourcemap: true,
  dts: true,
  hash: false,
  fixedExtension: false,
  minify: true,
})

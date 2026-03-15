import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  platform: 'neutral',
  format: 'esm',
  sourcemap: true,
  dts: true,
  hash: false,
  fixedExtension: false,
})

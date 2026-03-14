import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'bin/cmd': 'src/bin/cmd.ts',
  },
  platform: 'node',
  format: 'esm',
  sourcemap: true,
  dts: true,
  hash: false,
  fixedExtension: false,
})

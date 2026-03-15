import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  platform: 'node',
  format: 'esm',
  sourcemap: true,
  dts: true,
  deps: {
    neverBundle: ['node-datachannel', 'webrtc-polyfill'],
  },
  hash: false,
  fixedExtension: false,
})

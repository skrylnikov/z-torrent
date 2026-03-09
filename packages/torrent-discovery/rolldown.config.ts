import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].js',
  },
  platform: 'node',
  dts: true,
  external: ['node-datachannel', 'webrtc-polyfill'],
})

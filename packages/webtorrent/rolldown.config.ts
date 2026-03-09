import { defineConfig } from 'rolldown'

export default defineConfig({
  input: {
    index: 'src/index.ts',
    'lib/worker': 'src/lib/worker.ts',
  },
  external: ['node-datachannel', 'webrtc-polyfill'],
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].js',
  },
  platform: 'node',
  dts: true,
})

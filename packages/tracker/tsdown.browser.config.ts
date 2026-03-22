import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'client.browser': './src/client.browser-entry.ts',
  },
  platform: 'browser',
  format: 'esm',
  sourcemap: true,
  dts: true,
  hash: false,
  fixedExtension: false,
  clean: false,
  external: [
    '@thaunknown/simple-peer',
    '@thaunknown/simple-peer/lite.js',
    '@thaunknown/simple-websocket',
    'debug',
    'eventemitter3',
    'run-parallel',
    'uint8-util',
    '@z-torrent/utils',
  ],
})

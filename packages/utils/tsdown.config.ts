import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: [
      'src/index.ts',
      'src/streaming-mime.ts',
      'src/addr-ip-port.ts',
      'src/string-compact.ts',
      'src/piece.ts',
      'src/load-ip-set.ts',
      'src/ip-set.ts',
      'src/netmask.ts',
      'src/once.ts',
      'src/piece-length.ts',
    ],
    platform: 'node',
    format: 'esm',
    sourcemap: true,
    dts: true,
    hash: false,
    fixedExtension: false,
  },
  {
    entry: ['src/idb-chunk-store.ts'],
    platform: 'browser',
    format: 'esm',
    sourcemap: true,
    dts: true,
    hash: false,
    fixedExtension: false,
  },
])

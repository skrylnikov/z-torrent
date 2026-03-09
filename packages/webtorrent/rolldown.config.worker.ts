import { defineConfig } from 'rolldown'

export default defineConfig({
  input: 'src/lib/worker.ts',
  platform: 'browser',
  output: {
    file: 'dist/sw.min.js',
    format: 'esm',
    sourcemap: true,
    minify: true,
  },
  dts: false,
})

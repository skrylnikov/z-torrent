import webpack from 'webpack'
import path from 'path'
import { fileURLToPath } from 'url'
import TerserPlugin from 'terser-webpack-plugin'
import info from '../package.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const polyfillProcess = path.resolve(__dirname, '../src/polyfills/process-fast.js')

/** @type {import('webpack').Configuration} */
export default {
  entry: './dist/index.js',
  devtool: 'source-map',
  context: path.resolve(__dirname, '..'),
  resolve: {
    aliasFields: ['browser'],
    alias: {
      ...info.browser,
      path: 'path-esm',
    },
  },
  output: {
    chunkFormat: 'module',
    filename: 'z-torrent.min.js',
    library: {
      type: 'module',
    },
  },
  mode: 'production',
  target: 'web',
  experiments: {
    outputModule: true,
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: polyfillProcess,
    }),
    new webpack.DefinePlugin({
      global: 'globalThis',
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
  },
}

#!/usr/bin/env node

import { parseArgs } from 'node:util'
import { publish } from './index.js'
import type { PublishOptions, PublishProgress } from './types.js'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let version = '0.0.1'
try {
  const pkg = require('../package.json')
  version = pkg.version
} catch {}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function progressBar(bytesDone: number, bytesTotal: number, width = 30): string {
  const pct = bytesTotal > 0 ? Math.min(bytesDone / bytesTotal, 1) : 0
  const filled = Math.round(pct * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return `${bar} ${formatBytes(bytesDone)} / ${formatBytes(bytesTotal)} (${(pct * 100).toFixed(1)}%)`
}

const HELP = `z-torrent-publish v${version}

Usage: z-torrent-publish [options]

Create a torrent from a static site directory with zt-manifest.json.

Options:
  --dir, -d <path>       Site directory (default: from config or cwd)
  --config, -c <path>    Config file path (default: auto-detect z-torrent.config.*)
  --output, -o <path>    Output .torrent file path (default: <site-name>.torrent)
  --server <url>         Seed server URL (overrides config)
  --dry-run              Generate torrent without writing to disk
  --verbose, -v          Show progress details
  --help, -h             Show this help
  --version              Show version`

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    dir: { type: 'string', short: 'd' },
    config: { type: 'string', short: 'c' },
    output: { type: 'string', short: 'o' },
    server: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    verbose: { type: 'boolean', short: 'v', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', default: false },
  },
  strict: true,
})

if (args.version) {
  console.log(`z-torrent-publish v${version}`)
  process.exit(0)
}

if (args.help) {
  console.log(HELP)
  process.exit(0)
}

const opts: PublishOptions = {
  dir: args.dir,
  config: args.config,
  output: args.output,
  server: args.server,
  dryRun: args['dry-run'],
  verbose: args.verbose,
  onProgress: (progress: PublishProgress) => {
    if (!args.verbose) return

    switch (progress.phase) {
      case 'scanning':
        console.log('Scanning directory...')
        break
      case 'manifest':
        console.log(progress.message)
        break
      case 'hashing':
        process.stdout.write(`\r  Hashing: ${progressBar(progress.bytesDone, progress.bytesTotal)}`)
        break
      case 'writing':
        console.log(`\n  Writing: ${progress.path}`)
        break
      case 'uploading':
        console.log(`  ${progress.message}`)
        break
      case 'done': {
        const r = progress.result
        console.log(`\n  ✓ Published: ${r.infoHash}`)
        console.log(`    Torrent: ${r.torrentPath}`)
        console.log(`    Files:   ${r.fileCount}`)
        console.log(`    Size:    ${formatBytes(r.totalSize)}`)
        console.log(`    Type:    ${r.manifest.type}`)
        console.log(`    Site:    ${r.manifest.site.name}`)
        break
      }
    }
  },
}

publish(process.cwd(), opts)
  .then((result) => {
    if (!args.verbose) {
      console.log(`✓ Published: ${result.infoHash}`)
      console.log(`  Torrent: ${result.torrentPath}`)
      console.log(`  Files:   ${result.fileCount}`)
      console.log(`  Size:    ${formatBytes(result.totalSize)}`)
    }
  })
  .catch((err: Error) => {
    console.error(`\n✗ ${err.message}`)
    if (args.verbose && err.stack) {
      console.error(err.stack)
    }
    process.exit(1)
  })

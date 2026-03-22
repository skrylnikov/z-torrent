#!/usr/bin/env node

import { createRequire } from 'node:module'
import { stdin as stdinStream } from 'node:process'

import { parse } from '../index.js'

import type { Instance } from '../types.js'

const require = createRequire(import.meta.url)

async function readStdinBuffer(): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stdinStream) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

function usage(): void {
  console.error('Usage: parse-torrent /path/to/torrent')
  console.error('       parse-torrent magnet_uri')
  console.error('       parse-torrent --stdin')
  console.error('       parse-torrent --raw /path/to/torrent')
  console.error('       parse-torrent --raw magnet_uri')
}

function error(err: Error): void {
  console.error(err.message)
  process.exit(1)
}

const args = process.argv.slice(2)

if (!args[0] || args.includes('--help')) {
  usage()
  process.exit(1)
}

if (args.includes('--stdin') || args.includes('-')) {
  void readStdinBuffer().then(onTorrentId).catch(error)
} else if (args.includes('--version') || args.includes('-v')) {
  console.log(require('../../package.json').version)
} else {
  const lastArg = args[args.length - 1]
  if (lastArg) {
    onTorrentId(lastArg)
  }
}

function onTorrentId(torrentId: string | Uint8Array): void {
  parse.remote(torrentId, function (err: Error | null, parsedTorrent?: Instance) {
    if (err) return error(err)
    if (!parsedTorrent) return

    if (args.includes('--raw') && parsedTorrent.info) {
      recursiveStringify(parsedTorrent.info as Record<string, unknown>)
    } else {
      delete parsedTorrent.info
    }

    delete parsedTorrent.infoBuffer
    delete parsedTorrent.infoHashBuffer

    console.log(JSON.stringify(parsedTorrent, undefined, 2))
  })
}

function recursiveStringify(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (!Buffer.isBuffer(value) && typeof value === 'object' && value !== null) {
      recursiveStringify(value as Record<string, unknown>)
    } else if (Buffer.isBuffer(value)) {
      ;(obj as Record<string, unknown>)[key] = value.toString()
    }
  }
}

import fs from 'fs'
import zlib from 'zlib'

import { Transform } from 'stream'

import { Netmask } from './netmask'
import { once } from './once'
import { IPSet, type IPRange, type IPInput } from './ip-set'

const ipSetRegex = /^\s*(?:[^#].*?\s*:\s*)?([a-f0-9.:]+)(?:\s*-\s*([a-f0-9.:]+))?\s*$/
const cidrRegex = /^\s*(?:[^#].*?\s*:\s*)?([0-9.:]+)\/([0-9]{1,2})\s*$/

function split(): Transform {
  let buffer = ''
  return new Transform({
    transform(chunk: Buffer, _encoding, cb) {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        this.push(line)
      }
      cb()
    },
    flush(cb) {
      if (buffer) this.push(buffer)
      cb()
    },
  })
}

export interface LoadIPSetOptions {
  headers?: Record<string, string>
}

export interface LoadIPSetOptions {
  headers?: Record<string, string>
}

export function loadIPSet(
  input?: string | IPInput[],
  opts?: LoadIPSetOptions | ((err: Error | null, ipSet: IPSet) => void),
  cb?: (err: Error | null, ipSet: IPSet) => void
): Promise<IPSet> | void {
  if (typeof opts === 'function') {
    return loadIPSet(input, {}, opts)
  }
  if (typeof cb !== 'function') {
    return new Promise((resolve, reject) => {
      loadIPSet(input, opts, (err, ipSet) => {
        if (err) reject(err)
        else resolve(ipSet)
      })
    })
  }
  const callback = once(cb!)

  if (Array.isArray(input) || !input) {
    queueMicrotask(() => {
      callback(null, new IPSet(Array.isArray(input) ? input : undefined))
    })
  } else if (/^https?:\/\//.test(input)) {
    const headers: Record<string, string> =
      opts && typeof opts === 'object' && 'headers' in opts ? (opts.headers ?? {}) : {}
    fetch(input, { headers })
      .then((res) => {
        return res.text()
      })
      .then((text) => {
        const blocklist: IPRange[] = []
        for (const line of text.split('\n')) {
          handleLine(line, blocklist)
        }
        callback(null, new IPSet(blocklist))
      })
      .catch((err) => {
        callback(err, null as unknown as IPSet)
      })
  } else {
    let f: NodeJS.ReadableStream = fs
      .createReadStream(input)
      .on('error', callback as (err: Error) => void)
    if (/.gz$/.test(input)) f = f.pipe(zlib.createGunzip())
    onStream(f as NodeJS.ReadableStream)
  }

  function handleLine(line: string, blocklist: IPRange[]): void {
    let match = ipSetRegex.exec(line)
    if (match) {
      blocklist.push({ start: match[1]!, end: match[2] })
    } else {
      match = cidrRegex.exec(line)
      if (match) {
        const range = new Netmask(`${match[1]}/${match[2]}`)
        blocklist.push({
          start: range.first,
          end: range.broadcast || range.last,
        })
      }
    }
  }

  function onStream(stream: NodeJS.ReadableStream): void {
    const blocklist: IPRange[] = []
    stream
      .on('error', callback as (err: Error) => void)
      .pipe(split())
      .on('data', (line: string) => {
        handleLine(line, blocklist)
      })
      .on('end', () => {
        callback(null, new IPSet(blocklist))
      })
  }
}

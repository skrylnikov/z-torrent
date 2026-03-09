import fs from 'fs'
import fetch from 'cross-fetch-ponyfill'
import IPSet from 'ip-set'
import { Netmask } from 'netmask'
import once from 'once'
import split from 'split'
import zlib from 'zlib'
import queueMicrotask from 'queue-microtask'

const ipSetRegex = /^\s*(?:[^#].*?\s*:\s*)?([a-f0-9.:]+)(?:\s*-\s*([a-f0-9.:]+))?\s*$/
const cidrRegex = /^\s*(?:[^#].*?\s*:\s*)?([0-9.:]+)\/([0-9]{1,2})\s*$/

interface IPRange {
  start: string
  end?: string
}

function loadIPSet(
  input?: string | IPRange[],
  opts?: Record<string, string> | ((err: Error | null, ipSet: IPSet) => void),
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
      callback(null, new IPSet(input))
    })
  } else if (/^https?:\/\//.test(input)) {
    fetch(input, { headers: (opts?.headers as Record<string, string>) || {} })
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
        callback(err)
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
      blocklist.push({ start: match[1], end: match[2] })
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

export default loadIPSet

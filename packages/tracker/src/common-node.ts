/**
 * Functions/constants needed by both the client and server (but only in node).
 * These are separate from common.js so they can be skipped when bundling for the browser.
 */

import { concat } from 'uint8-util'

/** Parsed query string - compatible with Node's querystring.ParsedUrlQuery */
export type ParsedUrlQuery = Record<string, string | string[] | undefined>

/** Input for stringify - compatible with Node's querystring.ParsedUrlQueryInput */
export type ParsedUrlQueryInput = Record<string, string | number | boolean | string[] | undefined>

export const IPV4_RE = /^[\d.]+$/
export const IPV6_RE = /^[\da-fA-F:]+$/
export const REMOVE_IPV4_MAPPED_IPV6_RE = /^::ffff:/

export const CONNECTION_ID = concat([toUInt32(0x417), toUInt32(0x27101980)])
export const ACTIONS = {
  CONNECT: 0,
  ANNOUNCE: 1,
  SCRAPE: 2,
  ERROR: 3,
} as const
export const EVENTS = {
  update: 0,
  completed: 1,
  started: 2,
  stopped: 3,
  paused: 4,
} as const
export const EVENT_IDS: Record<number, string> = {
  0: 'update',
  1: 'completed',
  2: 'started',
  3: 'stopped',
  4: 'paused',
}
export const EVENT_NAMES: Record<string, string> = {
  update: 'update',
  completed: 'complete',
  started: 'start',
  stopped: 'stop',
  paused: 'pause',
}

/**
 * Client request timeout. How long to wait before considering a request to a
 * tracker server to have timed out.
 */
export const REQUEST_TIMEOUT = 15000

/**
 * Client destroy timeout. How long to wait before forcibly cleaning up all
 * pending requests, open sockets, etc.
 */
export const DESTROY_TIMEOUT = 1000

export function toUInt32(n: number): Uint8Array {
  const buf = new Uint8Array(4)
  const view = new DataView(buf.buffer)
  view.setUint32(0, n)
  return buf
}

/**
 * Parse query string using `unescape` instead of decodeURIComponent, since bittorrent
 * clients send non-UTF8 querystrings
 */
export function querystringParse(q: string): ParsedUrlQuery {
  const result: ParsedUrlQuery = {}
  if (!q) return result
  for (const part of q.split('&')) {
    const eq = part.indexOf('=')
    const key = eq === -1 ? unescape(part) : unescape(part.slice(0, eq))
    const value = eq === -1 ? '' : unescape(part.slice(eq + 1))
    if (key in result) {
      const existing = result[key]
      result[key] = Array.isArray(existing) ? [...existing, value] : [existing as string, value]
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Stringify query object using `escape` instead of encodeURIComponent, since bittorrent
 * clients send non-UTF8 querystrings
 */
export function querystringStringify(obj: ParsedUrlQueryInput): string {
  const parts: string[] = []
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (value === undefined) continue
    const encodedKey = (escape as (s: string) => string)(key).replace(
      /[@*/+]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    )
    if (Array.isArray(value)) {
      for (const v of value) {
        parts.push(
          `${encodedKey}=${(escape as (s: string) => string)(String(v)).replace(/[@*/+]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`
        )
      }
    } else {
      parts.push(
        `${encodedKey}=${(escape as (s: string) => string)(String(value)).replace(/[@*/+]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`
      )
    }
  }
  return parts.join('&')
}

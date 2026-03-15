/*! magnet-uri. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */
import { decode } from '@thaunknown/thirty-two'
import { parse, compose } from 'bep53-range'
import { hex2arr, arr2hex } from 'uint8-util'
import type { MagnetURI, MagnetURIEncodeInput } from './types.js'

function magnetURIDecode(uri: string): MagnetURI {
  const result: MagnetURI = {}

  // Support 'magnet:' and 'stream-magnet:' uris
  const data = uri.split('magnet:?')[1]

  const params = data && data.length >= 0 ? data.split('&') : []

  params.forEach((param) => {
    const keyval = param.split('=')

    // This keyval is invalid, skip it
    if (keyval.length !== 2) return

    const key = keyval[0]
    let val: string | string[] | number | number[] = keyval[1]

    // Clean up torrent name
    if (key === 'dn') val = decodeURIComponent(val as string).replace(/\+/g, ' ')

    // Address tracker (tr), exact source (xs), and acceptable source (as) are encoded
    // URIs, so decode them
    if (key === 'tr' || key === 'xs' || key === 'as' || key === 'ws') {
      val = decodeURIComponent(val as string)
    }

    // Return keywords as an array
    if (key === 'kt') val = decodeURIComponent(val as string).split('+')

    // Cast file index (ix) to a number
    if (key === 'ix') val = Number(val)

    // bep53
    if (key === 'so') val = parse(decodeURIComponent(val as string).split(','))

    // If there are repeated parameters, return an array of values
    if ((result as Record<string, unknown>)[key]) {
      if (!Array.isArray((result as Record<string, unknown>)[key])) {
        ;(result as Record<string, unknown>)[key] = [(result as Record<string, unknown>)[key]]
      }

      ;((result as Record<string, unknown>)[key] as (string | number)[]).push(
        val as string & number
      )
    } else {
      ;(result as Record<string, unknown>)[key] = val
    }
  })

  // Convenience properties for parity with `parse-torrent-file` module
  let m: RegExpMatchArray | null
  if (result.xt) {
    const xts = Array.isArray(result.xt) ? result.xt : [result.xt]
    xts.forEach((xt) => {
      if ((m = xt.match(/^urn:btih:(.{40})/))) {
        result.infoHash = m[1].toLowerCase()
      } else if ((m = xt.match(/^urn:btih:(.{32})/))) {
        result.infoHash = arr2hex(decode(m[1]))
      } else if ((m = xt.match(/^urn:btmh:1220(.{64})/))) {
        result.infoHashV2 = m[1].toLowerCase()
      }
    })
  }

  if (result.xs) {
    const xss = Array.isArray(result.xs) ? result.xs : [result.xs]
    xss.forEach((xs) => {
      if ((m = xs.match(/^urn:btpk:(.{64})/))) {
        result.publicKey = m[1].toLowerCase()
      }
    })
  }

  if (result.infoHash) result.infoHashBuffer = hex2arr(result.infoHash)
  if (result.infoHashV2) result.infoHashV2Buffer = hex2arr(result.infoHashV2)
  if (result.publicKey) result.publicKeyBuffer = hex2arr(result.publicKey)

  if (result.dn) result.name = result.dn
  if (result.kt) result.keywords = result.kt

  result.announce = []
  if (typeof result.tr === 'string' || Array.isArray(result.tr)) {
    result.announce = result.announce.concat(result.tr)
  }

  result.urlList = []
  if (typeof result.as === 'string' || Array.isArray(result.as)) {
    result.urlList = result.urlList.concat(result.as)
  }
  if (typeof result.ws === 'string' || Array.isArray(result.ws)) {
    result.urlList = result.urlList.concat(result.ws)
  }

  result.peerAddresses = []
  if (typeof result['x.pe'] === 'string' || Array.isArray(result['x.pe'])) {
    result.peerAddresses = result.peerAddresses.concat(result['x.pe'])
  }

  // remove duplicates by converting to Set and back
  result.announce = Array.from(new Set(result.announce))
  result.urlList = Array.from(new Set(result.urlList))
  result.peerAddresses = Array.from(new Set(result.peerAddresses))

  return result
}

function magnetURIEncode(obj: MagnetURIEncodeInput): string {
  obj = Object.assign({}, obj) as MagnetURIEncodeInput // clone obj, so we can mutate it

  // support using convenience names, in addition to spec names
  // (example: `infoHash` for `xt`, `name` for `dn`)

  // Deduplicate xt by using a set
  let xts = new Set<string>()
  if (obj.xt && typeof obj.xt === 'string') xts.add(obj.xt)
  if (obj.xt && Array.isArray(obj.xt)) xts = new Set(obj.xt)
  if (obj.infoHashBuffer) xts.add(`urn:btih:${arr2hex(obj.infoHashBuffer)}`)
  if (obj.infoHash) xts.add(`urn:btih:${obj.infoHash}`)
  if (obj.infoHashV2Buffer) {
    const xt = `urn:btmh:1220${arr2hex(obj.infoHashV2Buffer)}`
    xts.add(xt)
    ;(obj as MagnetURI).xt = xt
  }
  if (obj.infoHashV2) xts.add(`urn:btmh:1220${obj.infoHashV2}`)
  const xtsDeduped = Array.from(xts)
  if (xtsDeduped.length === 1) (obj as MagnetURI).xt = xtsDeduped[0]
  if (xtsDeduped.length > 1) (obj as MagnetURI).xt = xtsDeduped

  if (obj.publicKeyBuffer) (obj as MagnetURI).xs = `urn:btpk:${arr2hex(obj.publicKeyBuffer)}`
  if (obj.publicKey) (obj as MagnetURI).xs = `urn:btpk:${obj.publicKey}`
  if (obj.name) (obj as MagnetURI).dn = obj.name
  if (obj.keywords) (obj as MagnetURI).kt = obj.keywords
  if (obj.announce) (obj as MagnetURI).tr = obj.announce
  if (obj.urlList) {
    ;(obj as MagnetURI).ws = obj.urlList
    delete (obj as MagnetURI).as
  }
  if (obj.peerAddresses) (obj as MagnetURI)['x.pe'] = obj.peerAddresses

  let result = 'magnet:?'
  Object.keys(obj)
    .filter((key) => key.length === 2 || key === 'x.pe')
    .forEach((key, i) => {
      const values = Array.isArray((obj as Record<string, unknown>)[key])
        ? ((obj as Record<string, unknown>)[key] as unknown[])
        : [(obj as Record<string, unknown>)[key]]
      values.forEach((val, j) => {
        if ((i > 0 || j > 0) && ((key !== 'kt' && key !== 'so') || j === 0)) result += '&'

        if (key === 'dn') val = encodeURIComponent(val as string).replace(/%20/g, '+')
        if (key === 'tr' || key === 'as' || key === 'ws') {
          val = encodeURIComponent(val as string)
        }
        // Don't URI encode BEP46 keys
        if (key === 'xs' && typeof val === 'string' && !val.startsWith('urn:btpk:')) {
          val = encodeURIComponent(val)
        }
        if (key === 'kt') val = encodeURIComponent(val as string)
        if (key === 'so') return

        if (key === 'kt' && j > 0) result += `+${val}`
        else result += `${key}=${val}`
      })
      if (key === 'so') result += `${key}=${compose(values as number[][])}`
    })

  return result
}

export default magnetURIDecode
export { magnetURIDecode as decode, magnetURIEncode as encode }
export type { MagnetURI, MagnetURIEncodeInput }

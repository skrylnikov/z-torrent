import thirtyTwo from '@thaunknown/thirty-two'
import { parse, compose } from 'bep53-range'
import { hex2arr, arr2hex } from 'uint8-util'
import type { MagnetURI, MagnetURIEncodeInput } from './types.js'

function decode(uri: string): MagnetURI {
  const result: MagnetURI = {
    announce: [],
    urlList: [],
    peerAddresses: [],
  }

  const data = uri.split('magnet:?')[1]
  const params = data && data.length >= 0 ? data.split('&') : []

  for (const param of params) {
    const keyval = param.split('=')

    if (keyval.length !== 2) continue

    const key = keyval[0]
    const rawVal = keyval[1]
    if (!key || rawVal === undefined) continue

    let val: string | string[] | number | number[] = rawVal

    if (key === 'dn') {
      val = decodeURIComponent(rawVal).replace(/\+/g, ' ')
    } else if (key === 'tr' || key === 'xs' || key === 'as' || key === 'ws') {
      val = decodeURIComponent(rawVal)
    } else if (key === 'kt') {
      val = decodeURIComponent(rawVal).split('+')
    } else if (key === 'ix') {
      val = Number(rawVal)
    } else if (key === 'so') {
      val = parse(decodeURIComponent(rawVal).split(','))
    }

    const existing = (result as Record<string, unknown>)[key]
    if (existing !== undefined) {
      if (!Array.isArray(existing)) {
        ;(result as Record<string, unknown>)[key] = [existing]
      }

      ;((result as Record<string, unknown>)[key] as (string | number)[]).push(
        val as string & number
      )
    } else {
      ;(result as Record<string, unknown>)[key] = val
    }
  }

  let m: RegExpMatchArray | null
  const xt = result.xt
  if (xt) {
    const xts = Array.isArray(xt) ? xt : [xt]
    for (const xtItem of xts) {
      if ((m = xtItem.match(/^urn:btih:(.{40})/))) {
        result.infoHash = m[1]!.toLowerCase()
      } else if ((m = xtItem.match(/^urn:btih:(.{32})/))) {
        result.infoHash = arr2hex(thirtyTwo.decode(m[1]!))
      } else if ((m = xtItem.match(/^urn:btmh:1220(.{64})/))) {
        result.infoHashV2 = m[1]!.toLowerCase()
      }
    }
  }

  const xs = result.xs
  if (xs) {
    const xss = Array.isArray(xs) ? xs : [xs]
    for (const xsItem of xss) {
      if ((m = xsItem.match(/^urn:btpk:(.{64})/))) {
        result.publicKey = m[1]!.toLowerCase()
      }
    }
  }

  if (result.infoHash) result.infoHashBuffer = hex2arr(result.infoHash)
  if (result.infoHashV2) result.infoHashV2Buffer = hex2arr(result.infoHashV2)
  if (result.publicKey) result.publicKeyBuffer = hex2arr(result.publicKey)

  if (result.dn) result.name = result.dn
  if (result.kt) result.keywords = result.kt

  if (typeof result.tr === 'string' || Array.isArray(result.tr)) {
    result.announce = result.announce!.concat(result.tr)
  }

  if (typeof result.as === 'string' || Array.isArray(result.as)) {
    result.urlList = result.urlList!.concat(result.as)
  }
  if (typeof result.ws === 'string' || Array.isArray(result.ws)) {
    result.urlList = result.urlList!.concat(result.ws)
  }

  if (typeof result['x.pe'] === 'string' || Array.isArray(result['x.pe'])) {
    result.peerAddresses = result.peerAddresses!.concat(result['x.pe'])
  }

  result.announce = Array.from(new Set(result.announce))
  result.urlList = Array.from(new Set(result.urlList))
  result.peerAddresses = Array.from(new Set(result.peerAddresses))

  return result
}

function encode(obj: MagnetURIEncodeInput): string {
  obj = Object.assign({}, obj) as MagnetURIEncodeInput

  let xts = new Set<string>()
  if (obj.xt && typeof obj.xt === 'string') xts.add(obj.xt)
  if (obj.xt && Array.isArray(obj.xt)) xts = new Set(obj.xt)
  if (obj.infoHashBuffer) xts.add(`urn:btih:${arr2hex(obj.infoHashBuffer)}`)
  if (obj.infoHash) xts.add(`urn:btih:${obj.infoHash}`)
  if (obj.infoHashV2Buffer) {
    const xt = `urn:btmh:1220${arr2hex(obj.infoHashV2Buffer)}`
    xts.add(xt)
    ;(obj as Record<string, unknown>).xt = xt
  }
  if (obj.infoHashV2) xts.add(`urn:btmh:1220${obj.infoHashV2}`)
  const xtsDeduped = Array.from(xts)
  if (xtsDeduped.length === 1) (obj as Record<string, unknown>).xt = xtsDeduped[0]
  if (xtsDeduped.length > 1) (obj as Record<string, unknown>).xt = xtsDeduped

  if (obj.publicKeyBuffer)
    (obj as Record<string, unknown>).xs = `urn:btpk:${arr2hex(obj.publicKeyBuffer)}`
  if (obj.publicKey) (obj as Record<string, unknown>).xs = `urn:btpk:${obj.publicKey}`
  if (obj.name) (obj as Record<string, unknown>).dn = obj.name
  if (obj.keywords) (obj as Record<string, unknown>).kt = obj.keywords
  if (obj.announce) (obj as Record<string, unknown>).tr = obj.announce
  if (obj.urlList) {
    ;(obj as Record<string, unknown>).ws = obj.urlList
    delete (obj as Record<string, unknown>).as
  }
  if (obj.peerAddresses) (obj as Record<string, unknown>)['x.pe'] = obj.peerAddresses

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
        if (key === 'xs' && typeof val === 'string' && !val.startsWith('urn:btpk:')) {
          val = encodeURIComponent(val)
        }
        if (key === 'kt') val = encodeURIComponent(val as string)
        if (key === 'so') return

        if (key === 'kt' && j > 0) result += `+${val}`
        else result += `${key}=${val}`
      })
      if (key === 'so') result += `${key}=${compose(values as number[])}`
    })

  return result
}

const magnet = { decode, encode }

export { magnet }
export type { MagnetURI, MagnetURIEncodeInput }

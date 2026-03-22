declare module 'bittorrent-dht-sodium' {
  export function sign(buf: Buffer, sk: Buffer): Buffer
  export function verify(buf: Buffer, sig: Buffer, pk: Buffer): boolean
  export function createKeypair(): { sk: Buffer; pk: Buffer }
  /** @deprecated use createKeypair */
  export function keygen(): { sk: Buffer; pk: Buffer }
  export function salt(): Buffer
}

declare module 'bittorrent-dht-sodium' {
  export function sign(buf: Buffer, sk: Buffer): Buffer
  export function verify(buf: Buffer, sig: Buffer, pk: Buffer): boolean
  export function createKeypair(): { sk: Buffer; pk: Buffer }
}

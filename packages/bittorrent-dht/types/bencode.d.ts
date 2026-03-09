declare module 'bencode' {
  export function encode(data: any): Buffer
  export function decode(data: Uint8Array): any
}

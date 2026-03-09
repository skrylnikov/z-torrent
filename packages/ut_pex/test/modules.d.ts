declare module 'bencode' {
  export function decode(data: Uint8Array): unknown
  export function encode(data: unknown): Uint8Array
}

declare module 'compact2string' {
  function compact2string(data: Buffer | Uint8Array): string
  namespace compact2string {
    function multi(data: Buffer | Uint8Array): string[]
    function multi6(data: Buffer | Uint8Array): string[]
  }
  export = compact2string
}

declare module 'string2compact' {
  function string2compact(addr: string | string[]): Uint8Array
  namespace string2compact {
    function multi(addrs: string[]): Uint8Array
    function multi6(addrs: string[]): Uint8Array
  }
  export = string2compact
}

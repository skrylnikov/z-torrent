declare module 'compact2string' {
  function compact2string(data: Buffer | Uint8Array): string
  namespace compact2string {
    function multi(data: Buffer | Uint8Array): string[]
    function multi6(data: Buffer | Uint8Array): string[]
  }
  export = compact2string
}

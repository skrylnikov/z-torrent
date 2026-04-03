declare module 'minimist' {
  function minimist(
    args?: string[],
    opts?: Record<string, unknown>
  ): Record<string, unknown> & { _: string[] }
  export default minimist
}

declare module 'run-parallel' {
  function parallel<T>(
    tasks: Array<(cb: (err: Error | null, result?: T | T[]) => void) => void>,
    callback: (err: Error | null, results?: T[]) => void
  ): void
  export default parallel
}

declare module 'is-file' {
  function isFile(path: string, cb: (err: Error | null, result?: boolean) => void): void
  export default isFile
}

declare module 'join-async-iterator' {
  function joinAsyncIterator<T>(iterables: AsyncIterable<T>[]): AsyncIterable<T>
  export default joinAsyncIterator
}

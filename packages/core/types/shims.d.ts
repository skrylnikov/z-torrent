declare module 'run-parallel' {
  function parallel(
    tasks: Array<(cb: (err?: Error | null) => void) => void>,
    callback?: (err?: Error | null) => void
  ): void
  export default parallel
}

declare module 'run-parallel-limit' {
  function parallelLimit(
    tasks: Array<(cb: (err?: Error | null | undefined) => void) => void>,
    limit: number,
    callback?: (err?: Error | null | undefined) => void
  ): void
  export default parallelLimit
}

declare module 'throughput' {
  function throughput(): (bytes?: number) => number
  export default throughput
}

declare module 'speed-limiter' {
  export class ThrottleGroup {
    constructor(opts: { rate: number; enabled: boolean })
    destroy(): void
    /** Returns a Transform stream segment for `pipeline()` (see `speed-limiter` runtime). */
    throttle(opts?: Record<string, unknown>): import('streamx').Transform
  }
}

declare module 'chunk-store-iterator' {
  export function chunkStoreRead(...args: unknown[]): unknown
  export function chunkStoreWrite(...args: unknown[]): unknown
}

declare module 'lt_donthave' {
  function ltDontHave(): import('@z-torrent/protocol').ProtocolExtensionConstructor
  export default ltDontHave
}

declare module 'cache-chunk-store' {
  export default class CacheChunkStore {
    constructor(...args: unknown[])
  }
}

declare module 'immediate-chunk-store' {
  export default class ImmediateChunkStore {
    constructor(...args: unknown[])
  }
}

declare module 'memory-chunk-store' {
  export default class MemoryChunkStore {
    constructor(...args: unknown[])
  }
}

declare module 'join-async-iterator' {
  function joinAsyncIterator<T>(iterables: AsyncIterable<T>[]): AsyncIterable<T>
  export default joinAsyncIterator
}

declare module 'random-iterate' {
  function randomIterate<T>(arr: T[]): () => T
  export default randomIterate
}

declare module 'run-parallel' {
  function parallel(
    tasks: Array<(cb: (err?: Error | null) => void) => void>,
    callback?: (err?: Error | null) => void
  ): void
  export default parallel
}

declare module 'throughput' {
  function throughput(): (bytes?: number) => number
  export default throughput
}

declare module 'speed-limiter' {
  export class ThrottleGroup {
    constructor(opts: { rate: number; enabled: boolean })
    destroy(): void
    throttle(): () => import('streamx').Transform
  }
}

declare module 'debug' {
  function debug(namespace: string): (...args: unknown[]) => void
  export default debug
}

declare module 'chunk-store-iterator' {
  export function chunkStoreRead(...args: unknown[]): unknown
  export function chunkStoreWrite(...args: unknown[]): unknown
}

declare module 'mime/lite.js' {
  const mime: { getType(path: string): string | false }
  export default mime
}

declare module 'streamx' {
  export class Transform {
    constructor(opts?: Record<string, unknown>)
  }
  export function pipeline(...streams: unknown[]): unknown
}

declare module 'unordered-array-remove' {
  function arrayRemove(arr: unknown[], index: number): void
  export default arrayRemove
}

declare module 'escape-html' {
  function escapeHtml(s: string): string
  export default escapeHtml
}

declare module 'cross-fetch-ponyfill' {
  export default function fetch(
    input: string,
    init?: { method?: string; headers?: Record<string, string>; signal?: AbortSignal; cache?: string }
  ): Promise<{
    status: number
    ok: boolean
    arrayBuffer(): Promise<ArrayBuffer>
  }>
}

declare module 'lt_donthave' {
  function ltDontHave(): unknown
  export default ltDontHave
}

declare module '@z-torrent/protocol' {
  export default class Wire {
    constructor(...args: any[])
    destroyed: boolean
    peerPieces: { get(index: number): boolean }
    on(event: string, fn: (...args: any[]) => void): this
    once(event: string, fn: (...args: any[]) => void): this
    removeListener(event: string, fn: (...args: any[]) => void): this
    use(ext: unknown): this
    destroy(): this
    setKeepAlive(keepAlive: boolean): void
    handshake(infoHash: string, peerId: string, opts?: Record<string, unknown>): void
    sendPe1(): void
    sendPe2(): void
    sendPe3(infoHash: string): void
    sendPe4(infoHash: string): void
    unpipe(): void
    bitfield(field: unknown): void
    unchoke(): void
    have(index: number): void
  }
}

declare module 'bitfield' {
  export default class BitField {
    constructor(sizeOrBuffer: number | Uint8Array, opts?: { grow?: number; buffer?: Uint8Array })
    get(index: number): boolean
    set(index: number, value?: boolean): void
  }
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

declare module 'range-parser' {
  function rangeParser(
    size: number,
    range: string,
    options?: Record<string, unknown>
  ): number | Array<{ start: number; end: number }>
  export default rangeParser
}

declare module 'run-parallel-limit' {
  function parallelLimit(
    tasks: Array<(cb: (err?: Error | null | undefined) => void) => void>,
    limit: number,
    callback?: (err?: Error | null | undefined) => void
  ): void
  export default parallelLimit
}

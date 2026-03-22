declare module '@thaunknown/simple-peer/lite.js' {
  const Peer: { WEBRTC_SUPPORT: boolean }
  export default Peer
}

declare module 'memory-chunk-store' {
  const MemoryChunkStore: new (...args: unknown[]) => unknown
  export default MemoryChunkStore
}

declare module 'streamx' {
  export class Transform {
    constructor(opts?: Record<string, unknown>)
  }
  export class Duplex {
    constructor(opts?: Record<string, unknown>)
  }
  export function pipeline(...streams: unknown[]): unknown
}

/** Pulled in via @z-torrent/core / @z-torrent/protocol .d.ts when skipLibCheck is off */
declare module 'speed-limiter' {
  export class ThrottleGroup {
    constructor(opts: { rate: number; enabled: boolean })
    destroy(): void
    throttle(): () => import('streamx').Transform
  }
}

declare module 'rc4' {
  export default class RC4 {
    constructor(key: Uint8Array | number[])
    randomByte(): number
  }
}

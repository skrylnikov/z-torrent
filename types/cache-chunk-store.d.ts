declare module "cache-chunk-store" {
  import ChunkStore = require("chunk-store");

  interface CacheChunkStoreOptions {
    max?: number;
  }

  class CacheChunkStore implements ChunkStore {
    constructor(store: ChunkStore, opts?: CacheChunkStoreOptions);

    put(index: number, buf: Buffer, cb: (err?: Error) => void): void;
    get(
      index: number,
      opts?: { offset?: number; length?: number },
      cb: (err: Error | null, buf?: Buffer) => void,
    ): void;
    close(cb: (err?: Error) => void): void;
    destroy(cb: (err?: Error) => void): void;

    chunkLength: number;
    length: number;
    lastChunkLength: number;
  }

  export = CacheChunkStore;
}

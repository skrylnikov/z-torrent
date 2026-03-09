declare module "fs-chunk-store" {
  import ChunkStore = require("chunk-store");

  interface FSChunkStoreOptions {
    length: number;
    chunkLength: number;
    path?: string;
  }

  class FSChunkStore implements ChunkStore {
    constructor(opts: FSChunkStoreOptions);

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

  export = FSChunkStore;
}

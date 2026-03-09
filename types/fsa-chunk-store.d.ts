declare module "fsa-chunk-store" {
  import ChunkStore = require("chunk-store");

  interface FSAChunkStoreOptions {
    length: number;
    chunkLength: number;
    path?: string;
    rootDir?: FileSystemDirectoryHandle;
  }

  class FSAChunkStore implements ChunkStore {
    constructor(opts: FSAChunkStoreOptions);

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

  export = FSAChunkStore;
}

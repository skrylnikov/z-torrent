declare module "chunk-store-iterator" {
  import ChunkStore = require("chunk-store");

  export function chunkStoreRead(
    store: ChunkStore,
    opts: { offset: number; length: number },
  ): AsyncIterable<Uint8Array>;
}

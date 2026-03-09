declare module "bittorrent-dht" {
  import { EventEmitter } from "events";

  export interface DHTOptions {
    bootstrap?: boolean | string[];
    nodes?: string | string[];
    id?: Buffer | string;
    nodeId?: Buffer | string;
    host?: string;
    maxTables?: number;
    maxValues?: number;
    maxPeers?: number;
    maxAge?: number;
    hash?: (buf: Buffer) => Buffer;
    verify?: (sig: Buffer, data: Buffer, key: Buffer) => boolean;
    krpc?: any;
    timeBucketOutdated?: number;
    concurrency?: number;
    backgroundConcurrency?: number;
    k?: number;
  }

  export interface DHTPeer {
    host: string;
    port: number;
  }

  export interface DHTNode {
    id?: Buffer;
    host: string;
    port: number;
  }

  export interface PutOptions {
    v: Buffer | string;
    k?: Buffer;
    seq?: number;
    sign?: (data: Buffer) => Buffer;
    sig?: Buffer;
    salt?: Buffer;
    cas?: number;
  }

  export interface GetOptions {
    verify?: (sig: Buffer, data: Buffer, key: Buffer) => boolean;
    salt?: Buffer;
    cache?: boolean;
  }

  export interface GetValue {
    v: Buffer;
    id?: Buffer;
    k?: Buffer;
    sig?: Buffer;
    seq?: number;
    salt?: Buffer;
    token?: Buffer;
  }

  export interface ToJSONResult {
    nodes: Array<{ host: string; port: number }>;
    values: {
      [key: string]: {
        v: string;
        id: string;
        seq?: number;
        sig?: string;
        k?: string;
      };
    };
  }

  interface DHTEvents {
    ready: () => void;
    listening: () => void;
    warning: (err: Error) => void;
    error: (err: Error) => void;
    peer: (peer: DHTPeer, infoHash: Buffer, from: DHTNode | null) => void;
    node: (node: DHTNode) => void;
    announce: (peer: DHTPeer, infoHash: Buffer, from: DHTNode) => void;
    find_node: (target: Buffer) => void;
    get_peers: (infoHash: Buffer) => void;
    announce_peer: (infoHash: Buffer, peer: DHTPeer) => void;
    get: (target: Buffer, value: GetValue | null) => void;
    put: (key: Buffer, value: Buffer) => void;
    close: () => void;
  }

  export class DHT extends EventEmitter {
    nodeId: Buffer;
    nodes: {
      add: (node: DHTNode) => void;
      remove: (id: Buffer) => void;
      get: (id: Buffer) => DHTNode | null;
      closest: (id: Buffer) => DHTNode[];
      toArray: () => DHTNode[];
      metadata: {
        lastChange: number;
      };
    };
    listening: boolean;
    destroyed: boolean;
    ready: boolean;

    constructor(opts?: DHTOptions);

    listen(port?: number, address?: string, onlistening?: () => void): void;
    address(): { port: number; address: string; family: string };
    destroy(cb?: () => void): void;

    addNode(node: DHTNode): void;
    removeNode(id: Buffer | string): void;

    announce(
      infoHash: string | Buffer,
      port: number,
      cb?: (err?: Error | null) => void,
    ): void;

    lookup(
      infoHash: string | Buffer,
      cb?: (err?: Error | null) => void,
    ): () => void;

    put(
      opts: PutOptions | Buffer | string,
      cb?: (err: Error | null, key?: Buffer, n?: number) => void,
    ): Buffer;

    get(
      key: Buffer | string,
      opts?: GetOptions,
      cb?: (err: Error | null, value?: GetValue | null) => void,
    ): void;

    get(
      key: Buffer | string,
      cb?: (err: Error | null, value?: GetValue | null) => void,
    ): void;

    toJSON(): ToJSONResult;

    updateBucketTimestamp(): void;
    removeBucketCheckInterval(): void;

    on<E extends keyof DHTEvents>(event: E, listener: DHTEvents[E]): this;
    once<E extends keyof DHTEvents>(event: E, listener: DHTEvents[E]): this;
    emit<E extends keyof DHTEvents>(
      event: E,
      ...args: Parameters<DHTEvents[E]>
    ): boolean;
    removeListener<E extends keyof DHTEvents>(
      event: E,
      listener: DHTEvents[E],
    ): this;
    addListener<E extends keyof DHTEvents>(
      event: E,
      listener: DHTEvents[E],
    ): this;
    off<E extends keyof DHTEvents>(event: E, listener: DHTEvents[E]): this;
    prependListener<E extends keyof DHTEvents>(
      event: E,
      listener: DHTEvents[E],
    ): this;
    prependOnceListener<E extends keyof DHTEvents>(
      event: E,
      listener: DHTEvents[E],
    ): this;
  }

  export default DHT;
}

declare module "lru" {
  import { EventEmitter } from "events";

  export interface LRUOptions {
    max?: number;
    maxAge?: number;
  }

  export interface LRU<K = string, V = unknown> extends EventEmitter {
    max: number;
    maxAge: number;
    keys: K[];
    length: number;
    itemCount: number;

    get(key: K): V | undefined;
    set(key: K, value: V): void;
    peek(key: K): V | undefined;
    del(key: K): void;
    remove(key: K): void;
    reset(): void;
    has(key: K): boolean;
    prune(): void;
    dump(): Array<[K, { value: V; maxAge?: number }]>;
    load(cacheEntries: Array<[K, { value: V; maxAge?: number }]>): void;
    on(event: "evict", callback: (data: { key: K; value: V }) => void): this;
  }

  class LRUClass<K = string, V = unknown> implements LRU<K, V> {
    max: number;
    maxAge: number;
    keys: K[];
    length: number;
    itemCount: number;

    constructor(options?: LRUOptions | number);
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    peek(key: K): V | undefined;
    del(key: K): void;
    remove(key: K): void;
    reset(): void;
    has(key: K): boolean;
    prune(): void;
    dump(): Array<[K, { value: V; maxAge?: number }]>;
    load(cacheEntries: Array<[K, { value: V; maxAge?: number }]>): void;
    on(event: "evict", callback: (data: { key: K; value: V }) => void): this;
  }

  export default LRUClass;
}

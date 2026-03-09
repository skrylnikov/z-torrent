declare module 'lru' {
  export interface LRUOptions {
    maxAge?: number
    max?: number
    length?: (value: any, key: string) => number
    dispose?: (key: string, value: any) => void
    stale?: boolean
  }

  interface LRUInstance<K = string, V = any> {
    maxAge: number
    max: number
    length: (value: V, key: K) => number
    dispose: ((key: K, value: V) => void) | null
    stale: boolean
    cache: { [key: string]: { value: V; maxAge?: number } }
    size: number

    set(key: K, value: V, maxAge?: number): boolean
    get(key: K): V | undefined
    peek(key: K): V | undefined
    has(key: K): boolean
    del(key: K): void
    reset(): void
    forEach(callback: (value: V, key: K, cache: this) => void, thisArg?: any): void
    keys(): K[]
    values(): V[]
    prune(): void
  }

  interface LRUConstructor {
    new <K = string, V = any>(options?: LRUOptions): LRUInstance<K, V>
    <K = string, V = any>(options?: LRUOptions): LRUInstance<K, V>
    prototype: LRUInstance
  }

  const LRU: LRUConstructor
  export default LRU
}

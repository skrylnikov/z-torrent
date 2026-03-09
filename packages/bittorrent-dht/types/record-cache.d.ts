declare module 'record-cache' {
  export interface RecordCacheOptions {
    maxSize?: number
    maxAge?: number
  }

  export interface RecordCache {
    add(key: string, value: Buffer): void
    get(key: string, max?: number): Buffer[]
    remove(key: string, value?: Buffer): void
    clear(): void
    destroy(): void
    size: number
  }

  function RecordCache(options?: RecordCacheOptions): RecordCache

  export default RecordCache
}

/* eslint-disable no-undef -- IndexedDB types are DOM globals (browser-only entry) */

const DB_NAME = 'z-torrent-chunks'
const STORE_NAME = 'chunks'
const DB_VERSION = 1

export interface IDBChunkStoreOpts {
  infoHash?: string
  dbName?: string
  /** Set by z-torrent core when constructing the default browser store */
  torrent?: { infoHash?: string }
}

export class IDBChunkStore {
  private _db: IDBDatabase | null = null
  private _pending: Promise<void>
  private _pieceLength: number
  private _opts: IDBChunkStoreOpts
  private _destroyed = false
  chunkLength: number

  constructor(pieceLength: number, opts: IDBChunkStoreOpts = {}) {
    this._pieceLength = pieceLength
    this.chunkLength = pieceLength
    this._opts = opts
    this._pending = this._open()
  }

  private _dbName(): string {
    if (this._opts.dbName) return this._opts.dbName
    const ih = this._opts.infoHash ?? this._opts.torrent?.infoHash
    if (ih) return `${DB_NAME}-${ih}`
    return DB_NAME
  }

  private _open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this._dbName(), DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = () => {
        if (this._destroyed) {
          request.result.close()
          reject(new Error('Database destroyed'))
          return
        }

        this._db = request.result
        resolve()
      }

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`))
      }
    })
  }

  private _getStore(mode: IDBTransactionMode): IDBObjectStore {
    if (this._destroyed) throw new Error('Database destroyed')
    if (!this._db) throw new Error('Database not open')
    const tx = this._db.transaction(STORE_NAME, mode)
    return tx.objectStore(STORE_NAME)
  }

  get(
    index: number,
    opts: { offset?: number; length?: number } | ((err: Error | null, chunk?: Uint8Array) => void),
    cb?: (err: Error | null, chunk?: Uint8Array) => void
  ): void {
    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    const realCb = cb!
    this._pending
      .then(() => {
        const store = this._getStore('readonly')
        const req = store.get(index)

        req.onsuccess = () => {
          const data = req.result as ArrayBuffer | undefined
          if (!data) {
            realCb(new Error(`Chunk ${index} not found`))
            return
          }

          const buf = new Uint8Array(data)
          const offset = opts.offset ?? 0
          const length = opts.length ?? buf.byteLength - offset

          if (offset === 0 && length === buf.byteLength) {
            realCb(null, buf)
          } else {
            realCb(null, buf.subarray(offset, offset + length))
          }
        }

        req.onerror = () => {
          realCb(new Error(`Failed to get chunk ${index}: ${req.error?.message}`))
        }
      })
      .catch((err) => realCb(err))
  }

  put(
    index: number,
    chunk: Uint8Array,
    _opts: Record<string, unknown> | ((err?: Error) => void),
    cb?: (err?: Error) => void
  ): void {
    if (typeof _opts === 'function') {
      cb = _opts
    }
    const realCb = cb!
    this._pending
      .then(() => {
        const store = this._getStore('readwrite')
        const req = store.put(
          chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength),
          index
        )

        req.onsuccess = () => realCb()
        req.onerror = () => {
          const err = req.error
          if (err?.name === 'QuotaExceededError') {
            console.warn(
              `[@z-torrent/utils/idb-chunk-store] IndexedDB quota exceeded. Piece ${index} not stored.`
            )
          }
          realCb(new Error(`Failed to put chunk ${index}: ${err?.message}`))
        }
      })
      .catch((err) => realCb(err))
  }

  close(cb?: (err?: Error | null) => void): void {
    this.destroy(cb)
  }

  destroy(cb?: (err?: Error | null) => void): void {
    this._destroyed = true

    this._pending
      .then(() => {
        this._db?.close()
        this._db = null
        cb?.()
      })
      .catch(() => {
        this._db?.close()
        this._db = null
        cb?.()
      })
  }
}

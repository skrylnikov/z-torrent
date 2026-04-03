/* eslint-disable no-undef -- mocks IndexedDB DOM APIs */

import { test, expect } from 'bun:test'

import { IDBChunkStore } from '../src/idb-chunk-store'

test('uses per-torrent db name when torrent.infoHash is set', async () => {
  const originalIndexedDB = globalThis.indexedDB
  let openedName = ''

  globalThis.indexedDB = {
    open(name: string) {
      openedName = name
      const request = {
        result: null as unknown,
        error: null,
        onupgradeneeded: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null,
        onsuccess: null as ((this: IDBOpenDBRequest, ev: Event) => void) | null,
        onerror: null,
      } as unknown as IDBOpenDBRequest

      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore() {},
        transaction() {
          return {
            objectStore() {
              return {
                get() {
                  const r = {
                    onsuccess: null as ((this: IDBRequest) => void) | null,
                    onerror: null,
                    result: undefined,
                  }
                  queueMicrotask(() => r.onsuccess?.call(r as IDBRequest, new Event('success')))
                  return r
                },
              }
            },
          }
        },
        close() {},
      }
      ;(request as { result: unknown }).result = db

      queueMicrotask(() => {
        request.onupgradeneeded?.call(request as IDBOpenDBRequest, new Event('upgradeneeded'))
        request.onsuccess?.call(request as IDBOpenDBRequest, new Event('success'))
      })

      return request
    },
  } as unknown as typeof indexedDB

  try {
    const store = new IDBChunkStore(1024, {
      torrent: { infoHash: 'abc123deadbeef' },
    })
    await new Promise<void>((resolve, reject) => {
      store.get(0, (err) => {
        if (err && err.message.includes('not found')) resolve()
        else if (err) reject(err)
        else resolve()
      })
    })
    expect(openedName).toBe('z-torrent-chunks-abc123deadbeef')
  } finally {
    globalThis.indexedDB = originalIndexedDB
  }
})

test('destroy and close alias each other', async () => {
  const originalIndexedDB = globalThis.indexedDB
  let closeCount = 0

  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore() {},
    transaction() {
      return {
        objectStore() {
          return {}
        },
      }
    },
    close() {
      closeCount += 1
    },
  } as unknown as IDBDatabase

  globalThis.indexedDB = {
    open() {
      const request = {
        result: db,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      } as unknown as IDBOpenDBRequest

      queueMicrotask(() => {
        request.onsuccess?.call(request, new Event('success'))
      })

      return request
    },
  } as unknown as typeof indexedDB

  try {
    const store = new IDBChunkStore(1024)

    await new Promise<void>((resolve) => store.destroy(() => resolve()))
    expect(closeCount).toBe(1)

    await new Promise<void>((resolve) => store.close(() => resolve()))
    expect(closeCount).toBe(1)
  } finally {
    globalThis.indexedDB = originalIndexedDB
  }
})

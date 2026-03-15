declare module 'k-bucket' {
  import { EventEmitter } from 'events'

  export interface KBucketContact {
    id: Buffer
    host?: string
    port?: number
    token?: Buffer
    seen?: number
    distance?: number
    [key: string]: any
  }

  export interface KBucketOptions {
    localNodeId?: Buffer
    numberOfNodesPerKBucket?: number
    numberOfNodesToPing?: number
    distance?: (firstId: Buffer, secondId: Buffer) => number
    arbiter?: (incumbent: KBucketContact, candidate: KBucketContact) => KBucketContact
    metadata?: any
  }

  export interface KBucketNode {
    contacts: KBucketContact[]
    dontSplit: boolean
    left: KBucketNode | null
    right: KBucketNode | null
  }

  interface KBucketEvents {
    added: (contact: KBucketContact) => void
    removed: (contact: KBucketContact) => void
    ping: (contacts: KBucketContact[]) => void
    update: (contact: KBucketContact) => void
  }

  export class KBucket extends EventEmitter {
    localNodeId: Buffer
    numberOfNodesPerKBucket: number
    numberOfNodesToPing: number
    distance: (firstId: Buffer, secondId: Buffer) => number
    arbiter: (incumbent: KBucketContact, candidate: KBucketContact) => KBucketContact
    metadata: any
    root: KBucketNode

    constructor(options?: KBucketOptions)

    add(contact: KBucketContact): KBucket
    remove(id: Buffer): KBucket | null
    get(id: Buffer): KBucketContact | null
    closest(id: Buffer, n?: number): KBucketContact[]
    toArray(): KBucketContact[]
    count(): number
    clear(): void

    on<E extends keyof KBucketEvents>(event: E, listener: KBucketEvents[E]): this
    once<E extends keyof KBucketEvents>(event: E, listener: KBucketEvents[E]): this
    emit<E extends keyof KBucketEvents>(event: E, ...args: Parameters<KBucketEvents[E]>): boolean
  }

  export default KBucket
}

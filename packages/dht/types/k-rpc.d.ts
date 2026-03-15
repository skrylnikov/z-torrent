declare module 'k-rpc' {
  import { EventEmitter } from 'events'

  export interface KRpcNode {
    id?: Buffer
    host: string
    port: number
    address?: string
    token?: Buffer
    seen?: number
    distance?: number
  }

  export interface KRpcOptions {
    idLength?: number
    id?: Buffer | string
    nodeId?: Buffer | string
    krpcSocket?: any
    nodes?: string | string[] | KRpcNode[]
    bootstrap?: boolean | string | string[] | KRpcNode[]
    concurrency?: number
    backgroundConcurrency?: number
    k?: number
    hash?: (buf: Buffer) => Buffer
  }

  export interface KRpcQuery {
    q: string
    a?: any
    t?: Buffer
  }

  export interface KRpcMessage {
    q?: string
    a?: any
    r?: any
    t?: Buffer
    e?: [number, string]
  }

  export interface KRpcPeer {
    address: string
    host: string
    port: number
  }

  interface KRpcEvents {
    query: (query: KRpcMessage, peer: KRpcPeer) => void
    response: (response: KRpcMessage, peer: KRpcPeer) => void
    warning: (err: Error) => void
    error: (err: Error) => void
    listening: () => void
    node: (node: KRpcNode) => void
    update: () => void
    ping: (older: KRpcNode[], swap: (node: KRpcNode) => void) => void
  }

  export interface KRpc extends EventEmitter {
    id: Buffer
    nodes: {
      add: (node: KRpcNode) => void
      remove: (id: Buffer) => void
      get: (id: Buffer) => KRpcNode | null
      closest: (id: Buffer) => KRpcNode[]
      toArray: () => KRpcNode[]
      metadata: {
        lastChange: number
      }
    }
    destroyed: boolean
    k: number

    query(
      node: KRpcNode,
      message: KRpcQuery,
      cb: (err: Error | null, response?: KRpcMessage, node?: KRpcNode) => void
    ): void
    queryAll(
      nodes: KRpcNode[],
      message: KRpcQuery,
      onreply: ((message: KRpcMessage, node: KRpcNode) => boolean) | null,
      cb: (err: Error | null, n?: number) => void
    ): void
    response(
      peer: KRpcPeer,
      query: KRpcMessage,
      response: any,
      nodes?: KRpcNode[] | ((err?: Error) => void),
      cb?: (err?: Error) => void
    ): void
    error(peer: KRpcPeer, query: KRpcMessage, error: [number, string]): void
    closest(
      target: Buffer,
      message: KRpcQuery,
      onreply: (message: KRpcMessage, node: KRpcNode) => boolean,
      cb: (err: Error | null, n?: number) => void
    ): void
    populate(id: Buffer, message: KRpcQuery, cb: () => void): void
    bind(...args: any[]): void
    address(): { port: number; address: string; family: string }
    destroy(cb?: () => void): void
    clear(): void

    on<E extends keyof KRpcEvents>(event: E, listener: KRpcEvents[E]): this
    once<E extends keyof KRpcEvents>(event: E, listener: KRpcEvents[E]): this
    emit<E extends keyof KRpcEvents>(event: E, ...args: Parameters<KRpcEvents[E]>): boolean
  }

  function KRpc(opts?: KRpcOptions): KRpc

  export default KRpc
}

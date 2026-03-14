declare module 'p2p-graph' {
  export default class P2PGraph {
    constructor(root: string | Element)
    add(peer: { id: string; name: string; me?: boolean }): void
    connect(id1: string, id2: string): void
    disconnect(id1: string, id2: string): void
    remove(id: string): void
  }
}

declare module 'prettier-bytes' {
  export default function prettierBytes(bytes: number): string
}

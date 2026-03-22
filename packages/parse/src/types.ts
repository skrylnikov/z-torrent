export interface FileTreeEntry {
  length: number
  'path.utf-8'?: Uint8Array[]
  path?: Uint8Array[]
  attr?: string
  [key: string]: unknown
}

export interface FileTree {
  [name: string]: FileTreeEntry | FileTree
}

export interface Instance {
  info?: {
    'name.utf-8'?: Uint8Array
    name: Uint8Array
    'piece length': number
    pieces?: Uint8Array
    private?: number
    files?: Array<{
      length: number
      'path.utf-8'?: Uint8Array[]
      path?: Uint8Array[]
    }>
    'file tree'?: FileTree
    length?: number
    'meta version'?: number
  }
  'piece layers'?: Record<string, Uint8Array>
  infoBuffer?: Uint8Array
  infoHash?: string
  infoHashBuffer?: Uint8Array
  infoHashV2?: string
  infoHashV2Buffer?: Uint8Array
  version?: 'v1' | 'v2' | 'hybrid'
  name?: string
  private?: boolean
  created?: Date
  createdBy?: string
  comment?: string
  announce?: string[]
  urlList?: string[]
  files?: Array<{
    path: string
    name: string
    length: number
    offset: number
    /** BEP 47 file attributes (e.g. pad files) when present in the v2 file tree */
    attr?: string
  }>
  length?: number
  pieceLength?: number
  lastPieceLength?: number
  pieces?: string[]
}

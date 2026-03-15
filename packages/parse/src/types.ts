export interface Instance {
  info?: {
    'name.utf-8'?: Uint8Array
    name: Uint8Array
    'piece length': number
    pieces: Uint8Array
    private?: number
    files?: Array<{
      length: number
      'path.utf-8'?: Uint8Array[]
      path?: Uint8Array[]
    }>
    length?: number
  }
  infoBuffer?: Uint8Array
  infoHash?: string
  infoHashBuffer?: Uint8Array
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
  }>
  length?: number
  pieceLength?: number
  lastPieceLength?: number
  pieces?: string[]
}

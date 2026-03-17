export interface PEXFlags {
  prefersEncryption?: boolean
  isSender?: boolean
  supportsUtp?: boolean
  supportsUtHolepunch?: boolean
  isReachable?: boolean
}

export interface DecodedPEXFlags {
  prefersEncryption: boolean
  isSender: boolean
  supportsUtp: boolean
  supportsUtHolepunch: boolean
  isReachable: boolean
}

export interface PEXMessage {
  added?: Uint8Array
  'added.f'?: Uint8Array
  dropped?: Uint8Array
  added6?: Uint8Array
  'added6.f'?: Uint8Array
  dropped6?: Uint8Array
}

export interface Wire {
  extended(name: string, data: Uint8Array | Record<string, unknown>): void
  destroy(): void
}

export interface PeerEntry {
  ip: 4 | 6
  flags?: number
}

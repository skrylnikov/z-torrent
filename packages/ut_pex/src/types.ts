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

interface PeerInfo {
  ip: 4 | 6
  flags?: number
}

interface Wire {
  extended(name: string, data: unknown): void
  destroy(): void
}

interface ExtendedHandshake {
  m?: {
    ut_pex?: number
  }
}

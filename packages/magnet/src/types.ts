export interface MagnetURI {
  xt?: string | string[]
  dn?: string
  tr?: string | string[]
  xs?: string | string[]
  as?: string | string[]
  ws?: string | string[]
  kt?: string[]
  so?: number[]
  ix?: number
  xl?: string
  infoHash?: string
  infoHashBuffer?: Uint8Array
  infoHashV2?: string
  infoHashV2Buffer?: Uint8Array
  publicKey?: string
  publicKeyBuffer?: Uint8Array
  name?: string
  keywords?: string[]
  announce?: string[]
  urlList?: string[]
  peerAddresses?: string[]
  'x.pe'?: string | string[]
}

export interface MagnetURIEncodeInput {
  xt?: string | string[]
  dn?: string
  tr?: string | string[]
  xs?: string | string[]
  as?: string | string[]
  ws?: string | string[]
  kt?: string[]
  so?: number[]
  ix?: number
  xl?: string
  infoHash?: string
  infoHashBuffer?: Uint8Array
  infoHashV2?: string
  infoHashV2Buffer?: Uint8Array
  publicKey?: string
  publicKeyBuffer?: Uint8Array
  name?: string
  keywords?: string[]
  announce?: string[]
  urlList?: string[]
  peerAddresses?: string[]
}

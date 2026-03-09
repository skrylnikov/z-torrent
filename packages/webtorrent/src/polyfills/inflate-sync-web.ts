import { inflate } from 'pako'

export const inflateSync = (buffer: Uint8Array): string => inflate(buffer, { to: 'string' })

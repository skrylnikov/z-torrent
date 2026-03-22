import crypto from 'crypto'

export function randomPort(): number {
  return crypto.randomBytes(2).readUInt16LE(0)
}

export function randomId(): Buffer {
  return crypto.randomBytes(20)
}

export function randomHash(): Buffer {
  return crypto.randomBytes(20)
}

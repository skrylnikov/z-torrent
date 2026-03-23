/**
 * Pure JS Diffie-Hellman for browser — no Node crypto, no Buffer.
 * MSE/PE handshake uses 1024-bit DH. BigInt handles arbitrary precision.
 */

import { randomBytes } from 'uint8-util'

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n
  base = base % mod
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % mod
    exp >>= 1n
    base = (base * base) % mod
  }
  return result
}

function randomBigInt(max: bigint): bigint {
  const bytes = 128 // 1024 bits
  const arr = randomBytes(bytes)
  let n = 0n
  for (let i = 0; i < arr.length; i++) {
    n = (n << 8n) | BigInt(arr[i])
  }
  return n % max
}

export interface DiffieHellman {
  generateKeys(encoding: 'hex'): string
  computeSecret(otherPublicKey: string, inEncoding: 'hex', outEncoding: 'hex'): string
}

export function createDiffieHellman(
  primeHex: string,
  _encoding: string,
  generator: number
): DiffieHellman {
  const p = BigInt('0x' + primeHex)
  const g = BigInt(generator)
  let privateKey: bigint
  let publicKey: bigint

  return {
    generateKeys(encoding: 'hex'): string {
      if (encoding !== 'hex') throw new Error('Only hex encoding supported')
      privateKey = randomBigInt(p - 1n) + 1n
      publicKey = modPow(g, privateKey, p)
      return publicKey.toString(16)
    },
    computeSecret(otherPublicKeyHex: string, inEnc: 'hex', outEnc: 'hex'): string {
      if (inEnc !== 'hex' || outEnc !== 'hex') throw new Error('Only hex encoding supported')
      const otherPub = BigInt('0x' + otherPublicKeyHex)
      const secret = modPow(otherPub, privateKey, p)
      return secret.toString(16)
    },
  }
}

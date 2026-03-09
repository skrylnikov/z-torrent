declare module 'ip' {
  export function toString(buf: Buffer): string
  export function toBuffer(ip: string): Buffer
  export function isPrivate(ip: string): boolean
  export function isPublic(ip: string): boolean
  export function isLoopback(ip: string): boolean
  export function address(): string
}

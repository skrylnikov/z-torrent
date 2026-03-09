declare module "pako" {
  export interface InflateOptions {
    to?: "string" | "uint8array";
  }

  export interface DeflateOptions {
    level?: number;
  }

  export function inflate(
    data: Uint8Array,
    options?: InflateOptions,
  ): Uint8Array | string;
  export function deflate(
    data: Uint8Array | string,
    options?: DeflateOptions,
  ): Uint8Array;
  export function inflateRaw(
    data: Uint8Array,
    options?: InflateOptions,
  ): Uint8Array | string;
  export function deflateRaw(
    data: Uint8Array | string,
    options?: DeflateOptions,
  ): Uint8Array;
}

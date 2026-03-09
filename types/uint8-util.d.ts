declare module "uint8-util" {
  export function concat(
    arrays: Array<Uint8Array | number[]>,
    length?: number,
  ): Uint8Array;
  export function hex2arr(hex: string): Uint8Array;
  export function arr2hex(arr: Uint8Array | number[]): string;
  export function hex2bin(hex: string): string;
  export function bin2hex(bin: string): string;
  export function text2arr(text: string): Uint8Array;
  export function arr2text(
    arr: Uint8Array | number[],
    encoding?: string,
  ): string;
  export function hash(
    data: Uint8Array | string,
    algorithm?: string,
  ): Promise<Uint8Array>;
  export function equal(
    a: Uint8Array | number[],
    b: Uint8Array | number[],
  ): boolean;
  export function randomBytes(length: number): Uint8Array;
}

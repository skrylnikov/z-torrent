declare module "bitfield" {
  export default class BitField {
    constructor(data: number | Uint8Array, opts?: { grow?: number });
    buffer: Uint8Array;
    get(index: number): boolean;
    set(index: number, value?: boolean): void;
  }
}

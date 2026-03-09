declare module "bittorrent-protocol" {
  import { Duplex } from "streamx";
  import BitField from "bitfield";

  interface WireEvents {
    extended: (ext: string, buf: Uint8Array) => void;
    have: (index: number) => void;
    bitfield: (bitfield: BitField) => void;
    request: (
      index: number,
      offset: number,
      length: number,
      callback: (err?: Error, block?: Uint8Array) => void,
    ) => void;
    piece: (index: number, offset: number, buffer: Uint8Array) => void;
    cancel: (index: number, offset: number, length: number) => void;
    port: (port: number) => void;
    suggest: (index: number) => void;
    "have-all": () => void;
    "have-none": () => void;
    "allowed-fast": (index: number) => void;
    choke: () => void;
    unchoke: () => void;
    interested: () => void;
    "not-interested": () => void;
    keepAlive: () => void;
    error: (err: Error) => void;
    close: () => void;
    end: () => void;
    finish: () => void;
  }

  export default class Wire extends Duplex {
    peerExtensions: {
      dht: boolean;
      fast: boolean;
      extended: boolean;
    };
    extensions: string[];
    peerPieces: BitField;
    peerChoking: boolean;
    peerInterested: boolean;
    amChoking: boolean;
    amInterested: boolean;
    requests: Array<{ index: number; offset: number; length: number }>;
    peerRequests: Array<{ index: number; offset: number; length: number }>;

    constructor(opts?: { isUtP?: boolean; encrypted?: boolean });

    setKeepAlive(enable?: boolean): void;
    setTimeout(ms: number, callback?: () => void): void;
    destroy(error?: Error): void;

    use(fn: (wire: Wire) => void): void;
    extend(handshake: {
      m: { [key: string]: number };
      [key: string]: unknown;
    }): void;
    extended(ext: string | number, buf: Uint8Array): void;

    handshake(
      infoHash: Uint8Array,
      peerId: Uint8Array,
      extensions?: { dht?: boolean; fast?: boolean; [key: string]: unknown },
    ): void;
    bitfield(bitfield: BitField | Uint8Array): void;
    have(index: number): void;
    choke(): void;
    unchoke(): void;
    interested(): void;
    notInterested(): void;
    request(
      index: number,
      offset: number,
      length: number,
      callback?: (err?: Error, block?: Uint8Array) => void,
    ): boolean;
    piece(index: number, offset: number, buffer: Uint8Array): boolean;
    cancel(index: number, offset: number, length: number): boolean;
    port(port: number): void;
    suggest(index: number): void;
    haveAll(): void;
    haveNone(): void;
    allowedFast(index: number): void;

    on<K extends keyof WireEvents>(event: K, listener: WireEvents[K]): this;
    once<K extends keyof WireEvents>(event: K, listener: WireEvents[K]): this;
    removeListener<K extends keyof WireEvents>(
      event: K,
      listener: WireEvents[K],
    ): this;
    emit<K extends keyof WireEvents>(
      event: K,
      ...args: Parameters<WireEvents[K]>
    ): boolean;
  }
}

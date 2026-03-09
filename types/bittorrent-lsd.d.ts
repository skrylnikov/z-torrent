declare module "bittorrent-lsd" {
  import { EventEmitter } from "events";

  export interface LSDOptions {
    infoHash: string;
    peerId: string;
    port: number;
  }

  export default class LSD extends EventEmitter {
    constructor(opts: LSDOptions);
    on(event: "warning", cb: (err: Error) => void): this;
    on(event: "error", cb: (err: Error) => void): this;
    on(event: "peer", cb: (peer: string, infoHash: Buffer) => void): this;
    removeListener(event: "warning", cb: (err: Error) => void): this;
    removeListener(event: "error", cb: (err: Error) => void): this;
    removeListener(
      event: "peer",
      cb: (peer: string, infoHash: Buffer) => void,
    ): this;
    start(): void;
    destroy(cb?: () => void): void;
  }
}

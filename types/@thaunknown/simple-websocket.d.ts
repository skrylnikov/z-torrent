declare module "@thaunknown/simple-websocket" {
  import { EventEmitter } from "events";

  export interface SimpleWebSocketOptions {
    url?: string;
    socket?: WebSocket;
    agent?: any;
  }

  export interface SimpleWebSocket extends EventEmitter {
    readonly connected: boolean;
    readonly destroyed: boolean;

    send(data: string | Uint8Array | ArrayBuffer | Blob): void;
    destroy(error?: Error): void;

    on(event: "connect", callback: () => void): this;
    on(event: "data", callback: (data: Uint8Array | string) => void): this;
    on(event: "end", callback: () => void): this;
    on(event: "error", callback: (err: Error) => void): this;
    on(event: "close", callback: () => void): this;

    once(event: "connect", callback: () => void): this;
    once(event: "close", callback: () => void): this;
    once(event: "error", callback: (err: Error) => void): this;
    once(event: "data", callback: (data: Uint8Array | string) => void): this;

    removeListener(event: "connect", callback: () => void): this;
    removeListener(
      event: "data",
      callback: (data: Uint8Array | string) => void,
    ): this;
    removeListener(event: "close", callback: () => void): this;
    removeListener(event: "error", callback: (err: Error) => void): this;
  }

  export default class Socket implements SimpleWebSocket {
    constructor(opts?: SimpleWebSocketOptions);
  }
}

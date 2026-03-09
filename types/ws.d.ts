declare module "ws" {
  import { EventEmitter } from "events";
  import { IncomingMessage, Server as HttpServer } from "http";

  interface WebSocketServerOptions {
    server?: HttpServer;
    perMessageDeflate?: boolean;
    clientTracking?: boolean;
    noServer?: boolean;
    [key: string]: any;
  }

  interface WebSocket extends EventEmitter {
    readyState: number;
    upgradeReq?: IncomingMessage | null;
    send(
      data: string | Buffer,
      cb?: (err?: Error | null | undefined) => void,
    ): void;
    close(): void;
    terminate(): void;
    on(event: "message", listener: (data: Buffer | string) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: string, listener: Function): this;
    once(event: string, listener: Function): this;
    removeListener(event: string, listener: Function): this;
  }

  class WebSocketServer extends EventEmitter {
    constructor(options: WebSocketServerOptions);
    address(): any;
    close(): void;
    on(
      event: "connection",
      listener: (socket: WebSocket, req: IncomingMessage) => void,
    ): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: string, listener: Function): this;
  }

  export { WebSocket, WebSocketServer };
}

declare module "@webtorrent/http-node" {
  import { EventEmitter } from "events";
  import { IncomingMessage, ServerResponse } from "http";

  export class IncomingMessage extends EventEmitter {
    constructor(socket: any);
    method: string;
    url: string;
    headers: { [key: string]: string | undefined };
    httpVersion: string;
    connection: any;
    socket: any;

    destroy(error?: Error): void;
  }

  export class ServerResponse extends EventEmitter {
    constructor(req: IncomingMessage);
    statusCode: number;
    statusMessage: string;
    headersSent: boolean;

    writeHead(statusCode: number, headers?: { [key: string]: string }): this;
    write(chunk: Buffer | string, encoding?: string): boolean;
    end(chunk?: Buffer | string, encoding?: string): void;
    setHeader(name: string, value: string | number): void;
    getHeader(name: string): string | number | undefined;
    removeHeader(name: string): void;
  }

  export class Server extends EventEmitter {
    constructor(
      requestListener?: (req: IncomingMessage, res: ServerResponse) => void,
    );

    listen(port?: number, hostname?: string, callback?: () => void): this;
    listen(port?: number, callback?: () => void): this;
    close(callback?: () => void): this;
    address(): { port: number; family: string; address: string } | null;

    on(
      event: "request",
      listener: (req: IncomingMessage, res: ServerResponse) => void,
    ): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "listening", listener: () => void): this;
  }

  export function createServer(
    requestListener?: (req: IncomingMessage, res: ServerResponse) => void,
  ): Server;
  export function request(
    options: any,
    callback?: (res: IncomingMessage) => void,
  ): any;
  export function get(
    options: any,
    callback?: (res: IncomingMessage) => void,
  ): any;
}

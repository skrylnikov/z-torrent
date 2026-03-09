declare module "streamx" {
  import { EventEmitter } from "events";

  export class Stream extends EventEmitter {
    destroyed: boolean;
    destroying: boolean;
    destroy(cb?: () => void): this;
  }

  export class Readable extends Stream {
    readableEnded: boolean;
    readableLength: number;
    readableObjectMode: boolean;
    readableHighWaterMark: number;
    readable: boolean;
    readableEnded: boolean;
    readableFlowing: boolean | null;
    readableListening: boolean;

    _read(cb: (err?: Error | null) => void): void;
    read(size?: number): any;
    push(data: any): boolean;
    unshift(data: any): void;
    resume(): this;
    pause(): this;
    isPaused(): boolean;
    pipe<W extends Writable>(dest: W, opts?: { end?: boolean }): W;
    read(size?: number): any;
    wrap(stream: NodeJS.ReadableStream): this;
  }

  export class Writable extends Stream {
    writableEnded: boolean;
    writableFinished: boolean;
    writableLength: number;
    writableObjectMode: boolean;
    writableHighWaterMark: number;
    writable: boolean;
    writableCorked: number;

    _write(data: any, cb: (err?: Error | null) => void): void;
    _writev(
      chunks: Array<{ chunk: any; encoding?: string }>,
      cb: (err?: Error | null) => void,
    ): void;
    write(data: any, cb?: (err?: Error | null) => void): boolean;
    end(data?: any, cb?: (err?: Error | null) => void): this;
    cork(): void;
    uncork(): void;
    setDefaultEncoding(encoding: string): this;
  }

  export interface DuplexOptions {
    highWaterMark?: number;
    allowHalfOpen?: boolean;
    readableObjectMode?: boolean;
    writableObjectMode?: boolean;
    readableHighWaterMark?: number;
    writableHighWaterMark?: number;
    readable?: boolean;
    writable?: boolean;
    decodeStrings?: boolean;
    defaultEncoding?: string;
    emitClose?: boolean;
  }

  export class Duplex
    extends Stream
    implements NodeJS.ReadableStream, NodeJS.WritableStream
  {
    readable: boolean;
    writable: boolean;
    readableEnded: boolean;
    writableEnded: boolean;
    destroyed: boolean;
    destroying: boolean;
    readableLength: number;
    writableLength: number;
    readableObjectMode: boolean;
    writableObjectMode: boolean;
    readableHighWaterMark: number;
    writableHighWaterMark: number;
    writableCorked: number;
    readableFlowing: boolean | null;
    readableListening: boolean;
    writableFinished: boolean;

    constructor(opts?: DuplexOptions);

    _read(cb: (err?: Error | null) => void): void;
    _write(data: any, cb: (err?: Error | null) => void): void;
    _writev(
      chunks: Array<{ chunk: any; encoding?: string }>,
      cb: (err?: Error | null) => void,
    ): void;
    _final(cb: (err?: Error | null) => void): void;
    _destroy(cb: (err?: Error | null) => void): void;

    read(size?: number): any;
    push(data: any): boolean;
    unshift(data: any): void;
    write(data: any, cb?: (err?: Error | null) => void): boolean;
    end(data?: any, cb?: (err?: Error | null) => void): this;
    cork(): void;
    uncork(): void;
    setDefaultEncoding(encoding: string): this;
    resume(): this;
    pause(): this;
    isPaused(): boolean;
    pipe<W extends Writable>(dest: W, opts?: { end?: boolean }): W;
    wrap(stream: NodeJS.ReadableStream): this;
    destroy(cb?: () => void): this;
  }
}

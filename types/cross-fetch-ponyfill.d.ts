declare module "cross-fetch-ponyfill" {
  interface RequestInitWithAgent extends RequestInit {
    agent?: any;
    dispatcher?: any;
  }

  function fetch(
    url: string | URL,
    init?: RequestInitWithAgent,
  ): Promise<Response>;

  class Request {
    constructor(input: string | URL | Request, init?: RequestInitWithAgent);
    readonly method: string;
    readonly url: string;
    readonly headers: Headers;
    readonly body: ReadableStream<Uint8Array> | null;
  }

  class Response {
    readonly ok: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly headers: Headers;
    readonly body: ReadableStream<Uint8Array> | null;
    arrayBuffer(): Promise<ArrayBuffer>;
    json(): Promise<any>;
    text(): Promise<string>;
  }

  class Headers {
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
  }

  export default fetch;
  export { fetch, Request, Response, Headers };
}

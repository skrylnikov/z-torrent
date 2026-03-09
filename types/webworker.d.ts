/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

interface FetchEvent extends Event {
  readonly request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<any>): void;
}

interface ServiceWorkerGlobalScope {
  readonly clients: Clients;
  readonly registration: ServiceWorkerRegistration;
  addEventListener(type: "fetch", listener: (event: FetchEvent) => void): void;
  addEventListener(
    type: "install",
    listener: (event: ExtendableEvent) => void,
  ): void;
  addEventListener(
    type: "activate",
    listener: (event: ExtendableEvent) => void,
  ): void;
  skipWaiting(): Promise<void>;
}

interface Clients {
  matchAll(options?: {
    type?: string;
    includeUncontrolled?: boolean;
  }): Promise<readonly Client[]>;
}

interface Client {
  postMessage(message: any, transfer?: Transferable[]): void;
}

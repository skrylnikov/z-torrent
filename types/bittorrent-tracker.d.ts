/// <reference types="node" />

import { EventEmitter } from "events";
import { IncomingMessage, ServerResponse, Server as HttpServer } from "http";
import { Socket as DatagramSocket, RemoteInfo } from "dgram";
import { WebSocketServer, WebSocket } from "ws";

export interface ClientOptions {
  infoHash: string | Uint8Array;
  peerId: string | Uint8Array;
  announce: string | string[];
  port?: number;
  getAnnounceOpts?: () => Record<string, unknown>;
  rtcConfig?: RTCConfiguration;
  userAgent?: string;
  wrtc?: unknown | (() => unknown);
  proxyOpts?: unknown;
}

export interface AnnounceOptions {
  uploaded?: number;
  downloaded?: number;
  left?: number;
  numwant?: number;
  compact?: number;
  event?: "started" | "stopped" | "completed" | "update" | "paused";
}

export interface AnnounceResponse {
  announce: string;
  infoHash: string;
  complete: number;
  incomplete: number;
  peers: PeerData[];
  offers?: OfferData[];
}

export interface ScrapeOptions {
  infoHash?: string | string[];
}

export interface ScrapeResponse {
  announce: string;
  infoHash: string;
  complete: number;
  incomplete: number;
  downloaded: number;
}

export interface PeerData {
  type?: "http" | "udp" | "ws";
  peerId?: string;
  ip: string;
  port: number;
  socket?: WebSocket;
  complete?: boolean;
}

export interface OfferData {
  offer: RTCSessionDescriptionInit;
  offer_id: string;
}

export interface TrackerStats {
  torrents: number;
  activeTorrents: number;
  peersAll: number;
  peersSeederOnly: number;
  peersLeecherOnly: number;
  peersSeederAndLeecher: number;
  peersIPv4: number;
  peersIPv6: number;
  clients: Record<string, Record<string, number>>;
}

export interface ServerOptions {
  interval?: number;
  trustProxy?: boolean;
  http?: boolean | Record<string, unknown>;
  udp?: boolean | Record<string, unknown>;
  ws?: boolean | Record<string, unknown>;
  stats?: boolean;
  filter?: (
    infoHash: string,
    params: RequestParams,
    cb: (err?: Error) => void,
  ) => void;
  peersCacheLength?: number;
  peersCacheTtl?: number;
}

export interface RequestParams {
  action?: number;
  info_hash?: string;
  peer_id?: string;
  port?: number;
  left?: number;
  uploaded?: number;
  downloaded?: number;
  event?: string;
  numwant?: number;
  compact?: number;
  addr?: string;
  ip?: string;
  type?: "http" | "udp" | "ws";
  transactionId?: Uint8Array;
  connectionId?: Uint8Array;
  socket?: WebSocket;
  httpReq?: IncomingMessage;
  httpRes?: ServerResponse;
  offers?: OfferData[];
  answer?: RTCSessionDescriptionInit;
  offer_id?: string;
  to_peer_id?: string;
}

export interface Swarm {
  infoHash: string;
  complete: number;
  incomplete: number;
  peers: LRU<string, PeerData>;
  announce(
    params: RequestParams,
    cb: (err: Error | null, response?: unknown) => void,
  ): void;
  scrape(
    params: RequestParams,
    cb: (
      err: Error | null,
      response?: { complete: number; incomplete: number },
    ) => void,
  ): void;
}

interface LRU<K, V> {
  max: number;
  maxAge: number;
  keys: K[];
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  peek(key: K): V | undefined;
  remove(key: K): void;
  on(event: "evict", callback: (data: { key: K; value: V }) => void): this;
}

export class Client extends EventEmitter {
  peerId: string;
  infoHash: string;
  destroyed: boolean;

  constructor(opts: ClientOptions);

  on(event: "warning", listener: (err: Error) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "peer", listener: (peer: PeerData) => void): this;
  on(event: "update", listener: (data: AnnounceResponse) => void): this;
  on(event: "scrape", listener: (data: ScrapeResponse) => void): this;

  once(event: "warning", listener: (err: Error) => void): this;
  once(event: "error", listener: (err: Error) => void): this;
  once(event: "peer", listener: (peer: PeerData) => void): this;
  once(event: "update", listener: (data: AnnounceResponse) => void): this;
  once(event: "scrape", listener: (data: ScrapeResponse) => void): this;

  removeListener(event: "warning", listener: (err: Error) => void): this;
  removeListener(event: "error", listener: (err: Error) => void): this;
  removeListener(event: "peer", listener: (peer: PeerData) => void): this;
  removeListener(
    event: "update",
    listener: (data: AnnounceResponse) => void,
  ): this;
  removeListener(
    event: "scrape",
    listener: (data: ScrapeResponse) => void,
  ): this;

  start(opts?: AnnounceOptions): void;
  stop(opts?: AnnounceOptions): void;
  complete(opts?: AnnounceOptions): void;
  update(opts?: AnnounceOptions): void;
  scrape(opts?: ScrapeOptions): void;
  setInterval(intervalMs: number): void;
  destroy(cb?: () => void): void;

  static scrape(
    opts: {
      infoHash: string | string[];
      announce: string;
      getAnnounceOpts?: () => Record<string, unknown>;
      rtcConfig?: RTCConfiguration;
      userAgent?: string;
      wrtc?: unknown;
      proxyOpts?: unknown;
    },
    cb: (
      err: Error | null,
      data: ScrapeResponse | Record<string, ScrapeResponse>,
    ) => void,
  ): Client;
}

export class Server extends EventEmitter {
  intervalMs: number;
  listening: boolean;
  destroyed: boolean;
  torrents: Record<string, Swarm>;
  http: HttpServer | null;
  udp4: DatagramSocket | null;
  udp6: DatagramSocket | null;
  udp: DatagramSocket | null;
  ws: WebSocketServer | null;
  peersCacheLength?: number;
  peersCacheTtl?: number;

  static Swarm: new (infoHash: string, server: Server) => Swarm;

  constructor(opts?: ServerOptions);

  on(event: "listening", listener: () => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "warning", listener: (err: Error) => void): this;
  on(
    event: "start",
    listener: (addr: string, params: RequestParams) => void,
  ): this;
  on(
    event: "stop",
    listener: (addr: string, params: RequestParams) => void,
  ): this;
  on(
    event: "complete",
    listener: (addr: string, params: RequestParams) => void,
  ): this;
  on(
    event: "update",
    listener: (addr: string, params: RequestParams) => void,
  ): this;

  listen(
    port?: number | { http?: number; udp?: number },
    hostname?: string | { http?: string; udp?: string; udp6?: string },
    onlistening?: () => void,
  ): void;
  close(cb?: () => void): void;
  createSwarm(
    infoHash: string | Uint8Array,
    cb: (err: Error | null, swarm: Swarm) => void,
  ): void;
  getSwarm(
    infoHash: string | Uint8Array,
    cb: (err: Error | null, swarm: Swarm | undefined) => void,
  ): void;
  onHttpRequest(
    req: IncomingMessage,
    res: ServerResponse,
    opts?: { trustProxy?: boolean },
  ): void;
  onUdpRequest(msg: Uint8Array, rinfo: RemoteInfo): void;
  onWebSocketConnection(
    socket: WebSocket,
    opts?: { trustProxy?: boolean },
  ): void;
}

declare const _default: typeof Client;
export default _default;

declare module "socks" {
  import { Socket } from "net";

  export interface SocksProxyOptions {
    ipaddress: string;
    port: number;
    type: 4 | 5;
    userId?: string;
    password?: string;
  }

  export interface SocksClientOptions {
    proxy: SocksProxyOptions;
    command: "connect" | "bind" | "associate";
    destination: {
      host: string;
      port: number;
    };
    timeout?: number;
    existing_socket?: Socket;
  }

  export interface SocksClientEstablishedResponse {
    socket: Socket;
    socksHost?: string;
    socksPort?: number;
    remoteHost?: string;
    remotePort?: number;
  }

  export class SocksClient {
    static createConnection(
      options: SocksClientOptions,
    ): Promise<SocksClientEstablishedResponse>;
    static createConnection(
      options: SocksClientOptions,
      callback: (
        err: Error | null,
        socket?: SocksClientEstablishedResponse,
      ) => void,
    ): void;
  }

  export function createUDPFrame(
    target: { host: string; port: number },
    data: Uint8Array,
  ): Buffer;
}

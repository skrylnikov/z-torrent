declare module "@silentbot1/nat-api" {
  import { EventEmitter } from "events";

  interface NatApiOptions {
    ttl?: number;
    description?: string;
    gateway?: string;
    enablePmp?: boolean;
    enableUpnp?: boolean;
  }

  interface PortMapping {
    public: { host: string; port: number };
    private: { host: string; port: number };
    protocol: string;
    enabled: boolean;
    description: string;
    ttl: number;
  }

  export default class NatAPI extends EventEmitter {
    constructor(opts?: NatApiOptions);

    map(
      publicPort: number,
      privatePort: number,
      callback?: (err: Error | null) => void,
    ): void;
    map(
      publicPort: number,
      privatePort: number,
      options?: { ttl?: number; description?: string },
      callback?: (err: Error | null) => void,
    ): void;

    unmap(publicPort: number, callback?: (err: Error | null) => void): void;

    destroy(callback?: (err: Error | null) => void): void;

    on(event: "mapping", listener: (mapping: PortMapping) => void): this;
    on(event: "unmapping", listener: (mapping: PortMapping) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
  }
}

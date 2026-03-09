declare module "@thaunknown/simple-peer/lite.js" {
  import { Duplex } from "stream";

  interface PeerOptions {
    initiator?: boolean;
    channelConfig?: RTCConfiguration;
    chunkSize?: number;
    stream?: MediaStream;
    streams?: MediaStream[];
    trickle?: boolean;
    wrtc?: any;
    objectMode?: boolean;
    allowHalfOpen?: boolean;
  }

  class Peer extends Duplex {
    readable: boolean;
    writable: boolean;
    initiator: boolean;
    channelConfig: RTCConfiguration | undefined;
    chunkSize: number;
    stream: MediaStream | undefined;
    streams: MediaStream[];
    trickle: boolean;
    wrtc: any;
    pc: RTCPeerConnection | undefined;
    destroyed: boolean;
    connected: boolean;
    static WEBRTC_SUPPORT: boolean;

    constructor(opts?: PeerOptions);

    signal(data: string | RTCSessionDescriptionInit | RTCIceCandidateInit): void;
    addStream(stream: MediaStream): void;
    removeStream(stream: MediaStream): void;
    addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender;
    removeTrack(sender: RTCRtpSender): void;
    replaceTrack(
      oldTrack: MediaStreamTrack | null,
      newTrack: MediaStreamTrack | null,
      stream: MediaStream
    ): Promise<void>;
    destroy(error?: Error): this;

    on(event: "signal", listener: (data: any) => void): this;
    on(event: "connect", listener: () => void): this;
    on(event: "data", listener: (data: Buffer | string) => void): this;
    on(event: "stream", listener: (stream: MediaStream) => void): this;
    on(event: "track", listener: (track: MediaStreamTrack, stream: MediaStream) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export default Peer;
}

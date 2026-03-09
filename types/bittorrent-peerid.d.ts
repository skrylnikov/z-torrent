declare module "bittorrent-peerid" {
  export interface PeerIdClient {
    client: string;
    version?: string;
  }

  function bittorrentPeerid(peerId: string | Uint8Array): PeerIdClient;

  export default bittorrentPeerid;
}

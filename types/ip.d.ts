declare module "ip" {
  function toBuffer(ip: string): Buffer;
  function toString(
    buff: Buffer | number[],
    offset?: number,
    length?: number,
  ): string;
  function fromPrefixLen(prefixlen: number, family?: string): string;
  function mask(addr: string, mask: string): string;
  function cidr(cidr: string): string;
  function isEqual(a: string | Buffer, b: string | Buffer): boolean;
  function isPrivate(addr: string): boolean;
  function isPublic(addr: string): boolean;
  function isLoopback(addr: string): boolean;
  function long(addr: string): number;
  function fromLong(long: number): string;
  function subnet(
    addr: string,
    mask: string,
  ): {
    networkAddress: string;
    firstAddress: string;
    lastAddress: string;
    broadcastAddress: string;
    subnetMask: string;
    subnetMaskLength: number;
    numHosts: number;
    length: number;
    contains(other: string): boolean;
  };
  function cidrSubnet(cidr: string): ReturnType<typeof subnet>;
  function address(name?: string, family?: string): string;
  function toLong(addr: string): number;
  function fromLong(num: number): string;
}

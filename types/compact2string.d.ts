declare module "compact2string" {
  interface Compact2String {
    (compact: string | Uint8Array): string[];
    multi(compact: string | Uint8Array): string[];
    multi6(compact: string | Uint8Array): string[];
  }

  const compact2string: Compact2String;

  export default compact2string;
}

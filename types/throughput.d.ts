declare module "throughput" {
  function throughput(): (bytes: number) => void;
  export = throughput;
}

declare module "random-iterate" {
  function randomIterate<T>(array: T[]): () => T | undefined;

  export default randomIterate;
}

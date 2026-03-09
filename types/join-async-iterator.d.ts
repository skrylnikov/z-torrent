declare module "join-async-iterator" {
  export default function joinAsyncIterator<T>(
    iterators: AsyncIterable<T>[],
    options?: { concurrency?: number },
  ): AsyncIterable<T[]>;
}

declare module "run-parallel-limit" {
  type Task<T = void> = (
    callback: (err?: Error | null, result?: T) => void,
  ) => void;

  export default function runParallelLimit<T>(
    tasks: Task<T>[],
    limit: number,
    cb: (err: Error | null, results?: T[]) => void,
  ): void;

  export default function runParallelLimit<T>(
    tasks: Task<T>[],
    limit: number,
  ): Promise<T[]>;
}

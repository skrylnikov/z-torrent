declare module "run-parallel" {
  import { AsyncResource } from "async_hooks";

  interface Task {
    (callback: (err?: Error | null, result?: any) => void): void;
  }

  function runParallel(
    tasks: Task[],
    callback?: (err?: Error | null, results?: any[]) => void,
  ): void;

  export = runParallel;
}

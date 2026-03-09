declare module "once" {
  import { EventEmitter } from "events";

  function once<T extends (...args: any[]) => any>(fn: T): T;

  namespace once {
    function strict<T extends (...args: any[]) => any>(fn: T): T;
  }

  export = once;
}

declare module "run-parallel" {
  type TaskCallback<T = void> = (
    err?: Error | null | undefined,
    result?: T,
  ) => void;
  type Task<T = void> = (callback: TaskCallback<T>) => void;

  function runParallel<T = void>(
    tasks: Task<T>[],
    callback?: TaskCallback<T[]>,
  ): void;

  export = runParallel;
}

declare module "queue-microtask" {
  function queueMicrotask(callback: () => void): void;

  export = queueMicrotask;
}

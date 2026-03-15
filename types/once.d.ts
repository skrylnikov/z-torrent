
declare module 'run-parallel' {
  type TaskCallback<T = void> = (err?: Error | null | undefined, result?: T) => void
  type Task<T = void> = (callback: TaskCallback<T>) => void

  function runParallel<T = void>(tasks: Task<T>[], callback?: TaskCallback<T[]>): void

  export = runParallel
}

declare module "run-series" {
  type TaskCallback<T = void> = (err: Error | null, result?: T) => void;
  type Task<T = void> = (callback: TaskCallback<T>) => void;

  function runSeries<T = void>(
    tasks: Task<T>[],
    callback?: TaskCallback<T[]>,
  ): void;

  export default runSeries;
}

declare module 'last-one-wins' {
  type AsyncFunction<T = any> = (opts: T, cb: (err?: Error | null) => void) => void

  function lastOneWins<T = any>(fn: AsyncFunction<T>): AsyncFunction<T>

  export default lastOneWins
}

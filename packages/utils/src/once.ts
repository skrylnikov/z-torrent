export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false
  let value: ReturnType<T>
  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    if (called) return value
    called = true
    value = fn.apply(this, args)
    return value
  } as T
}

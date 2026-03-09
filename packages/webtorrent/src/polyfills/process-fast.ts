import queueMicrotask from 'queue-microtask'

const title = 'browser'
const browser = true
const env: Record<string, string | undefined> = {}
const argv: string[] = []
const version = ''
const versions: Record<string, string> = {}

function noop(): void {}

const on = noop
const addListener = noop
const once = noop
const off = noop
const removeListener = noop
const removeAllListeners = noop
const emit = noop
const prependListener = noop
const prependOnceListener = noop

const nextTick = (func: (...args: unknown[]) => void, ...args: unknown[]): void =>
  queueMicrotask(() => func(...args))

const listeners = (_name: string): never[] => []

const cwd = (): string => '/'
const umask = (): number => 0
const binding = (_name: string): never => {
  throw new Error('process.binding is not supported')
}
const chdir = (_dir: string): never => {
  throw new Error('process.chdir is not supported')
}

const process = {
  title,
  browser,
  env,
  argv,
  version,
  versions,
  on,
  addListener,
  once,
  off,
  removeListener,
  removeAllListeners,
  emit,
  prependListener,
  prependOnceListener,
  nextTick,
  listeners,
  cwd,
  umask,
  binding,
  chdir,
}

export default process
export {
  title,
  browser,
  env,
  argv,
  version,
  versions,
  on,
  addListener,
  once,
  off,
  removeListener,
  removeAllListeners,
  emit,
  prependListener,
  prependOnceListener,
  nextTick,
  listeners,
  cwd,
  umask,
  binding,
  chdir,
}

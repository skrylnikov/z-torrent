declare module 'debug' {
  interface Debug {
    (namespace: string): Debug.Debugger
    enabled: boolean
  }

  interface Debugger {
    (formatter: string, ...args: any[]): void
    enabled: boolean
    namespace: string
    extend(namespace: string): Debugger
  }

  const debug: Debug
  export default debug
}

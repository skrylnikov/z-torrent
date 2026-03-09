declare module 'once' {
  export default function once<T extends Function>(fn: T): T
}

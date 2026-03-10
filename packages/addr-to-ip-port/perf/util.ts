import benchmark from 'benchmark'

export const suite = () => {
  const s = new benchmark.Suite()
  queueMicrotask(() => {
    s
      .on('error', (event: { target: { error: { stack?: string } } }) => {
        console.error(event.target.error.stack)
      })
      .on('cycle', (event: { target: unknown }) => {
        console.log(String(event.target))
      })
      // .on('complete', function () {
      //   console.log('Fastest is ' + this.filter('fastest').pluck('name'))
      // })
      .run({ async: true })
  })
  return s
}

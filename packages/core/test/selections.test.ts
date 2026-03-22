import { test, expect } from 'bun:test'
import { Selections } from '../src/selections.js'

test('Selections insert and toArray', () => {
  const s = new Selections()
  s.insert({
    from: 0,
    to: 5,
    offset: 0,
    priority: 0,
    notify: () => {},
  })
  expect(s.length).toBe(1)
  expect(s.toArray()).toEqual([{ from: 0, to: 5 }])
})

test('Selections remove stream vs normal', () => {
  const s = new Selections()
  s.insert({
    from: 1,
    to: 3,
    offset: 0,
    priority: 0,
    isStreamSelection: true,
    notify: () => {},
  })
  s.remove({ from: 1, to: 3, isStreamSelection: true })
  expect(s.length).toBe(0)
})

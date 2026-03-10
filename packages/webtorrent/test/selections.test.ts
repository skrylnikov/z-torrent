import {
  Selections,
  isCoveringExisting,
  isInsideExisting,
  isLowerIntersecting,
  isUpperIntersecting,
} from '../src/lib/selections.js'
import { test, expect } from 'bun:test'

interface SelectionItem {
  from: number
  to: number
}

const testCases = {
  isLowerIntersecting: {
    fn: isLowerIntersecting,
    cases: [
      {
        newItem: { from: 8, to: 12 },
        existing: { from: 1, to: 10 },
        expectedRemoveResult: [{ from: 1, to: 7 }],
      },
      {
        newItem: { from: 10, to: 15 },
        existing: { from: 1, to: 10 },
        expectedRemoveResult: [{ from: 1, to: 9 }],
      },
    ],
  },
  isUpperIntersecting: {
    fn: isUpperIntersecting,
    cases: [
      {
        newItem: { from: 15, to: 22 },
        existing: { from: 20, to: 25 },
        expectedRemoveResult: [{ from: 23, to: 25 }],
      },
      {
        newItem: { from: 15, to: 20 },
        existing: { from: 20, to: 25 },
        expectedRemoveResult: [{ from: 21, to: 25 }],
      },
    ],
  },
  isInsideExisting: {
    fn: isInsideExisting,
    cases: [
      {
        newItem: { from: 12, to: 15 },
        existing: { from: 10, to: 20 },
        expectedRemoveResult: [
          { from: 10, to: 11 },
          { from: 16, to: 20 },
        ],
      },
      {
        newItem: { from: 20, to: 20 },
        existing: { from: 10, to: 20 },
        expectedRemoveResult: [{ from: 10, to: 19 }],
      },
      {
        newItem: { from: 15, to: 20 },
        existing: { from: 10, to: 20 },
        expectedRemoveResult: [{ from: 10, to: 14 }],
      },
    ],
  },
  isCoveringExisting: {
    fn: isCoveringExisting,
    cases: [
      { newItem: { from: 10, to: 21 }, existing: { from: 10, to: 20 }, expectedRemoveResult: [] },
      { newItem: { from: 9, to: 20 }, existing: { from: 10, to: 20 }, expectedRemoveResult: [] },
      { newItem: { from: 10, to: 20 }, existing: { from: 10, to: 20 }, expectedRemoveResult: [] },
      { newItem: { from: 0, to: 986 }, existing: { from: 15, to: 986 }, expectedRemoveResult: [] },
    ],
  },
}

function toString(param: SelectionItem | SelectionItem[]): string {
  if (!Array.isArray(param)) {
    const { from, to } = param
    return `[${from}-${to}]`
  }
  return `[${param.map(toString).join(', ')}]`
}

function assertArrayContentsEqual(actual: SelectionItem[], expected: SelectionItem[]) {
  expect(actual.length).toBe(expected.length)
  for (const item of actual) {
    expect(expected.some((e) => e.from === item.from && e.to === item.to)).toBeTruthy()
  }
}

for (const [functionName, { fn, cases }] of Object.entries(testCases)) {
  for (const { newItem, existing } of cases) {
    test(
      `should return true for newItem: ${toString(newItem)} and existing: ${toString(existing)} and everything else should be false`,
      () => {
        expect(fn(newItem, existing)).toBe(true)
        for (const otherFn of Object.keys(testCases)) {
          if (otherFn !== functionName) {
            expect((testCases as any)[otherFn].fn(newItem, existing)).toBe(false)
          }
        }
      }
    )
  }
}

for (const { cases } of Object.values(testCases)) {
  for (const { newItem, existing, expectedRemoveResult } of cases) {
    test(
      `should remove the given item: ${toString(newItem)} from existing selection: ${toString(existing)} and leave: ${toString(expectedRemoveResult)}`,
      () => {
        const selection = new Selections()
        selection.insert(existing)
        selection.remove(newItem)
        assertArrayContentsEqual(selection._items, expectedRemoveResult)
      }
    )
  }
}

for (const { cases } of Object.values(testCases)) {
  for (const { newItem, existing, expectedRemoveResult } of cases) {
    test(
      `should truncate the existing item: ${toString(existing)} to prevent overlapping with the new selection: ${toString(newItem)}`,
      () => {
        const selection = new Selections()
        selection.insert(existing)
        selection.insert(newItem)
        const expected = { from: Infinity, to: 0 }
        for (const item of [...expectedRemoveResult, newItem]) {
          expected.from = Math.min(expected.from, item.from)
          expected.to = Math.max(expected.to, item.to)
        }
        assertArrayContentsEqual(selection._items, [expected])
      }
    )
  }
}

test('should insert large selection and truncate or delete existing selections', () => {
  const selection = new Selections()
  selection.insert({ from: 5, to: 10 })
  selection.insert({ from: 11, to: 19 })
  selection.insert({ from: 20, to: 40 })

  selection.insert({ from: 9, to: 25 })

  assertArrayContentsEqual(selection._items, [{ from: 5, to: 40 }])
})

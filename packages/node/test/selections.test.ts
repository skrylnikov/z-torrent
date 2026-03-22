import {
  Selections,
  isCoveringExisting,
  isInsideExisting,
  isLowerIntersecting,
  isUpperIntersecting,
} from '@z-torrent/core'
import { test, expect } from 'bun:test'

interface Interval {
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

function toString(param: Interval | Interval[]): string {
  if (!Array.isArray(param)) {
    const { from, to } = param
    return `[${from}-${to}]`
  }
  return `[${param.map(toString).join(', ')}]`
}

function assertSelectionRanges(selection: Selections, expected: Interval[]): void {
  selection.sort()
  expect(selection.length).toBe(expected.length)
  for (let i = 0; i < expected.length; i++) {
    const item = selection.get(i)!
    expect(item.from).toBe(expected[i]!.from)
    expect(item.to).toBe(expected[i]!.to)
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
            expect((testCases as Record<string, { fn: typeof fn }>)[otherFn]!.fn(newItem, existing)).toBe(
              false
            )
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
        selection.insert(existing as Parameters<Selections['insert']>[0])
        selection.remove(newItem)
        assertSelectionRanges(selection, expectedRemoveResult)
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
        selection.insert(existing as Parameters<Selections['insert']>[0])
        selection.insert(newItem as Parameters<Selections['insert']>[0])
        const expected = { from: Infinity, to: 0 }
        for (const item of [...expectedRemoveResult, newItem]) {
          expected.from = Math.min(expected.from, item.from)
          expected.to = Math.max(expected.to, item.to)
        }
        assertSelectionRanges(selection, [expected])
      }
    )
  }
}

test('should insert large selection and truncate or delete existing selections', () => {
  const selection = new Selections()
  selection.insert({ from: 5, to: 10 } as Parameters<Selections['insert']>[0])
  selection.insert({ from: 11, to: 19 } as Parameters<Selections['insert']>[0])
  selection.insert({ from: 20, to: 40 } as Parameters<Selections['insert']>[0])

  selection.insert({ from: 9, to: 25 } as Parameters<Selections['insert']>[0])

  assertSelectionRanges(selection, [{ from: 5, to: 40 }])
})

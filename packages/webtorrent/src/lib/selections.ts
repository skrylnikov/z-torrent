export interface MinimalSelectionItem {
  from: number
  to: number
}

export interface SelectionItem extends MinimalSelectionItem {
  offset: number
  priority?: number
  notify?: () => void
  remove?: () => void
  isStreamSelection?: boolean
}

export interface NotificationItem extends MinimalSelectionItem {
  notify: () => void
}

export class Selections {
  private _items: SelectionItem[] = []

  remove(item: MinimalSelectionItem & { isStreamSelection?: boolean }): void {
    for (let i = 0; i < this._items.length; i++) {
      const existing = this._items[i]
      if (!existing.isStreamSelection !== !item.isStreamSelection) continue

      if (existing.isStreamSelection) {
        if (existing.from === item.from && existing.to === item.to) {
          this._items.splice(i, 1)
          break
        }
      } else {
        if (isLowerIntersecting(item, existing)) {
          existing.to = Math.max(item.from - 1, 0)
        } else if (isUpperIntersecting(item, existing)) {
          existing.from = item.to + 1
        } else if (isInsideExisting(item, existing)) {
          const replacingItems: SelectionItem[] = []
          const existingStart = { ...existing, to: Math.max(item.from - 1, 0) }
          if (existingStart.to - existingStart.from >= 0 && item.from !== 0)
            replacingItems.push(existingStart)
          const existingEnd = { ...existing, from: item.to + 1 }
          if (existingEnd.to - existingEnd.from >= 0) replacingItems.push(existingEnd)
          this._items.splice(i, 1, ...replacingItems)
          i = i - 1 + replacingItems.length
        } else if (isCoveringExisting(item, existing)) {
          this._items.splice(i, 1)
          i--
        }
      }
    }
  }

  private _mergePriorityAndNotify(newItem: SelectionItem, existing: SelectionItem): void {
    if ((existing.priority ?? 0) > (newItem.priority ?? 0)) {
      newItem.priority = existing.priority
    }

    if (newItem.notify && existing.notify) {
      const oldNotify = newItem.notify
      newItem.notify = () => {
        oldNotify()
        existing.notify?.()
      }
    } else {
      newItem.notify = existing.notify || newItem.notify
    }
  }

  concatenate(newItem: SelectionItem): void {
    for (let i = 0; i < this._items.length; i++) {
      const existing = this._items[i]

      if (!existing.isStreamSelection) {
        if (isLowerIntersecting(newItem, existing)) {
          newItem.from = existing.from
        } else if (isUpperIntersecting(newItem, existing)) {
          newItem.to = existing.to
        } else if (isInsideExisting(newItem, existing)) {
          newItem.from = existing.from
          newItem.to = existing.to
        } else if (isCoveringExisting(newItem, existing)) {
          continue
        } else {
          continue
        }
        this._mergePriorityAndNotify(newItem, existing)
      }
    }

    this.remove(newItem)
  }

  insert(newItem: SelectionItem & NotificationItem): void {
    if (newItem.from > newItem.to) {
      throw new Error('Invalid interval')
    }
    if (!newItem.isStreamSelection) this.concatenate(newItem)
    this._items.push(newItem)
  }

  sort(sortFn: (a: SelectionItem, b: SelectionItem) => number = (a, b) => a.from - b.from): void {
    this._items.sort(sortFn)
  }

  get length(): number {
    return this._items.length
  }

  get(index: number): SelectionItem | undefined {
    return this._items[index]
  }

  swap(i: number, j: number): void {
    const temp = this._items[i]
    this._items[i] = this._items[j]
    this._items[j] = temp
  }

  clear(): void {
    this._items.length = 0
  }

  *[Symbol.iterator](): Generator<SelectionItem & { remove: () => void }> {
    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i]
      const removeFn = () => {
        this._items.splice(i, 1)
        i--
      }
      const result = Object.assign({}, item, { remove: removeFn })
      yield result
    }
  }
}

export function isLowerIntersecting(
  newItem: MinimalSelectionItem,
  existing: MinimalSelectionItem
): boolean {
  return newItem.from <= existing.to + 1 && newItem.from > existing.from && newItem.to > existing.to
}

export function isUpperIntersecting(
  newItem: MinimalSelectionItem,
  existing: MinimalSelectionItem
): boolean {
  return newItem.to >= existing.from - 1 && newItem.to < existing.to && newItem.from < existing.from
}

export function isInsideExisting(
  newItem: MinimalSelectionItem,
  existing: MinimalSelectionItem
): boolean {
  const existingIntervalSize = existing.to - existing.from
  const newItemIntervalSize = newItem.to - newItem.from
  return (
    newItem.from >= existing.from &&
    newItem.to <= existing.to &&
    newItemIntervalSize < existingIntervalSize
  )
}

export function isCoveringExisting(
  newItem: MinimalSelectionItem,
  existing: MinimalSelectionItem
): boolean {
  return newItem.from <= existing.from && newItem.to >= existing.to
}

export const isIntersecting =
  (newItem: MinimalSelectionItem, existing: MinimalSelectionItem) => (): boolean =>
    isLowerIntersecting(newItem, existing) ||
    isUpperIntersecting(newItem, existing) ||
    isInsideExisting(newItem, existing) ||
    isCoveringExisting(newItem, existing)

import { describe, it, expect } from 'vitest'
import {
  DOUBLE_CLICK_WINDOW_MS,
  isOpenableFile,
  shouldDeferSingleClick
} from '../../src/renderer/explorer/openGesture'

/**
 * Spec 029 (contracts/file-open-gesture.md): the pure gesture decision.
 */

describe('isOpenableFile', () => {
  it('accepts only file nodes', () => {
    expect(isOpenableFile({ kind: 'file' })).toBe(true)
    expect(isOpenableFile({ kind: 'directory' })).toBe(false)
  })
})

describe('shouldDeferSingleClick', () => {
  const base = { preferNewTab: false, activeExists: true, activeIsDirty: false as boolean | null, alreadyOpen: false }

  it('defers only a clean-active same-tab replace (FR-003)', () => {
    expect(shouldDeferSingleClick(base)).toBe(true)
  })

  it('never defers under the new-tab preference', () => {
    expect(shouldDeferSingleClick({ ...base, preferNewTab: true })).toBe(false)
  })

  it('never defers when the active tab is dirty (FR-009)', () => {
    expect(shouldDeferSingleClick({ ...base, activeIsDirty: true })).toBe(false)
  })

  it('never defers when there is no active tab (FR-008)', () => {
    expect(shouldDeferSingleClick({ ...base, activeExists: false, activeIsDirty: null })).toBe(false)
  })

  it('never defers when the file is already open (FR-005)', () => {
    expect(shouldDeferSingleClick({ ...base, alreadyOpen: true })).toBe(false)
  })
})

describe('DOUBLE_CLICK_WINDOW_MS', () => {
  it('uses a window of at least the OS double-click time (500 ms)', () => {
    expect(DOUBLE_CLICK_WINDOW_MS).toBe(500)
  })
})

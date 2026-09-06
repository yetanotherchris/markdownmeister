import { describe, it, expect } from 'vitest'
import {
  DOUBLE_CLICK_WINDOW_MS,
  isOpenableFile,
  shouldDeferSingleClick
} from '../../src/renderer/explorer/openGesture'

/**
 * Spec 029 (contracts/file-open-gesture.md), 2026-09-06 re-amendment: the
 * deferral decision is back so a double-click over a clean active tab always
 * opens a new tab and leaves the active tab untouched (FR-001/FR-003 restored).
 */

describe('isOpenableFile', () => {
  it('accepts only file nodes', () => {
    expect(isOpenableFile({ kind: 'file' })).toBe(true)
    expect(isOpenableFile({ kind: 'directory' })).toBe(false)
  })
})

describe('DOUBLE_CLICK_WINDOW_MS', () => {
  it('is at least the OS double-click window so a second click always lands first', () => {
    // Windows OS double-click time is 500 ms; the second click of a recognised
    // double-click must arrive before the deferred single-click open commits.
    expect(DOUBLE_CLICK_WINDOW_MS).toBeGreaterThanOrEqual(500)
  })
})

describe('shouldDeferSingleClick', () => {
  it('defers a single click that would replace a clean active tab in same-tab mode', () => {
    expect(
      shouldDeferSingleClick({
        preferNewTab: false,
        activeExists: true,
        activeIsDirty: false,
        alreadyOpen: false
      })
    ).toBe(true)
  })

  it('does not defer under the new-tab preference (a double-click adds nothing)', () => {
    expect(
      shouldDeferSingleClick({
        preferNewTab: true,
        activeExists: true,
        activeIsDirty: false,
        alreadyOpen: false
      })
    ).toBe(false)
  })

  it('does not defer when the file is already open (the reducer dedupes)', () => {
    expect(
      shouldDeferSingleClick({
        preferNewTab: false,
        activeExists: true,
        activeIsDirty: false,
        alreadyOpen: true
      })
    ).toBe(false)
  })

  it('does not defer with no active tab (a double-click matches a single click)', () => {
    expect(
      shouldDeferSingleClick({
        preferNewTab: false,
        activeExists: false,
        activeIsDirty: null,
        alreadyOpen: false
      })
    ).toBe(false)
  })

  it('does not defer over a dirty active tab (nothing would be replaced)', () => {
    expect(
      shouldDeferSingleClick({
        preferNewTab: false,
        activeExists: true,
        activeIsDirty: true,
        alreadyOpen: false
      })
    ).toBe(false)
  })
})

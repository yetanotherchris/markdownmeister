import { describe, it, expect } from 'vitest'
import { isOpenableFile } from '../../src/renderer/explorer/openGesture'

/**
 * Spec 029 (contracts/file-open-gesture.md), 2026-08-21 amendment: the
 * deferral decision was removed — every open commits immediately, so only the
 * pure routing helpers remain.
 */

describe('isOpenableFile', () => {
  it('accepts only file nodes', () => {
    expect(isOpenableFile({ kind: 'file' })).toBe(true)
    expect(isOpenableFile({ kind: 'directory' })).toBe(false)
  })
})

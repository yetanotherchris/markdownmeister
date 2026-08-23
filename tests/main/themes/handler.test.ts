import { describe, it, expect } from 'vitest'
import { unresolvedSelectionRepair } from '../../../src/main/ipc/handlers/themes'

/**
 * Spec 036 FR-013 (contracts/preload.md): handling `themes:list` silently
 * repairs a stored selection that matches no discovered theme by targeting
 * the default theme; a resolving selection must produce no repair at all.
 */

const THEMES = [
  { name: 'monotone' },
  { name: 'rustic' },
  { name: 'rustic-serif' },
  { name: 'scholarly' }
]

describe('unresolvedSelectionRepair', () => {
  it('returns null when the stored selection resolves', () => {
    expect(unresolvedSelectionRepair(THEMES, 'rustic')).toBeNull()
    expect(unresolvedSelectionRepair(THEMES, 'scholarly')).toBeNull()
  })

  it('targets the default theme when the file was deleted or renamed', () => {
    expect(unresolvedSelectionRepair(THEMES, 'midnight')).toBe('rustic')
  })

  it('targets the default theme even with an empty discovery', () => {
    expect(unresolvedSelectionRepair([], 'rustic')).toBe('rustic')
    expect(unresolvedSelectionRepair([], '')).toBe('rustic')
  })

  it('normalises a case-only mismatch to the delivered stem (review 2026-08-23)', () => {
    // A case-collision winner keeps its original-case stem; folding the
    // comparison means the stored selection resolves to that stem instead of
    // being rewritten to the default on every read while still failing the
    // renderer's exact-name resolution.
    expect(unresolvedSelectionRepair(THEMES, 'Rustic')).toBe('rustic')
    expect(unresolvedSelectionRepair([{ name: 'RUSTIC' }], 'rustic')).toBe('RUSTIC')
  })
})

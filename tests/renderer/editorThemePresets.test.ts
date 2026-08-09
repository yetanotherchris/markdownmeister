import { describe, it, expect } from 'vitest'
import type { EditorThemeName, EditorColors } from '../../src/shared/ipc-contract'
import { resolveEditorTheme, MONOTONE_COLORS, presetColorsFor } from '../../src/shared/editorThemePresets'

const RUSTIC: EditorColors = {
  background: '#fdf6e3', foreground: '#1f1b16', accent: '#805610',
  surface: '#fdf3d9', outline: '#817567', code: '#ba1a1a'
}
const SCHOLARLY: EditorColors = {
  background: '#ffffff', foreground: '#1a1a1a', accent: '#00b0e9',
  surface: '#f7f7f7', outline: '#8a8a8a', code: '#b50000'
}

function resolve(editorTheme: EditorThemeName, editorFont: 'serif' | 'sans-serif', editorColors: EditorColors | null) {
  return resolveEditorTheme({ editorTheme, editorFont, editorColors })
}

describe('resolveEditorTheme (spec 023 FR-003/004/007)', () => {
  it('returns the stored preset when there are no custom colours (SC-005)', () => {
    expect(resolve('rustic', 'sans-serif', null)).toEqual({ kind: 'preset', name: 'rustic' })
    expect(resolve('scholarly', 'sans-serif', null)).toEqual({ kind: 'preset', name: 'scholarly' })
  })

  it('matches a preset exactly by colours and font', () => {
    expect(resolve('rustic', 'sans-serif', RUSTIC)).toEqual({ kind: 'preset', name: 'rustic' })
    expect(resolve('rustic', 'serif', RUSTIC)).toEqual({ kind: 'preset', name: 'rustic-serif' })
    expect(resolve('scholarly', 'sans-serif', SCHOLARLY)).toEqual({ kind: 'preset', name: 'scholarly' })
  })

  it('treats a one-value colour difference as Custom', () => {
    const custom = { ...RUSTIC, background: '#2b2b2b' }
    expect(resolve('rustic', 'sans-serif', custom)).toEqual({ kind: 'custom' })
  })

  it('treats scholarly colours with a serif font as Custom (no such preset)', () => {
    expect(resolve('scholarly', 'serif', SCHOLARLY)).toEqual({ kind: 'custom' })
  })

  it('ignores the stored editorTheme when custom colours are present', () => {
    const custom = { ...RUSTIC, accent: '#ff0000' }
    expect(resolve('scholarly', 'sans-serif', custom)).toEqual({ kind: 'custom' })
  })

  it('matches the monotone presets against EITHER app-theme variant (clarified 2026-08-09)', () => {
    expect(resolve('monotone', 'sans-serif', MONOTONE_COLORS.light)).toEqual({ kind: 'preset', name: 'monotone' })
    expect(resolve('monotone', 'sans-serif', MONOTONE_COLORS.dark)).toEqual({ kind: 'preset', name: 'monotone' })
    expect(resolve('monotone', 'serif', MONOTONE_COLORS.dark)).toEqual({ kind: 'preset', name: 'monotone-serif' })
    // A palette saved under one variant is still a preset under the other.
    expect(resolve('monotone-serif', 'serif', MONOTONE_COLORS.light)).toEqual({ kind: 'preset', name: 'monotone-serif' })
  })

  it('treats a palette matching no preset variant as Custom', () => {
    const custom = { ...MONOTONE_COLORS.light, background: '#2b2b2b' }
    expect(resolve('monotone', 'sans-serif', custom)).toEqual({ kind: 'custom' })
  })
})

describe('presetColorsFor (spec 023 clarification 2026-08-09)', () => {
  it('returns the preset colours for a static preset', () => {
    expect(presetColorsFor('rustic', 'light')).toEqual(RUSTIC)
    expect(presetColorsFor('scholarly', 'dark')).toEqual(SCHOLARLY)
  })

  it('returns the app-theme variant colours for a monotone preset', () => {
    expect(presetColorsFor('monotone', 'light')).toEqual(MONOTONE_COLORS.light)
    expect(presetColorsFor('monotone-serif', 'dark')).toEqual(MONOTONE_COLORS.dark)
  })
})

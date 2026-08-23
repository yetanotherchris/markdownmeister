import { describe, it, expect } from 'vitest'
import {
  getEditorThemes,
  updateEditorThemes,
  paletteForMode,
  resolveEditorAppearance
} from '../../src/renderer/state/editorThemes'
import { EMERGENCY_EDITOR_THEME } from '../../src/shared/editorThemeTokens'
import type { EditorThemeDefinition } from '../../src/shared/ipc-contract'

/**
 * Spec 036: the renderer's theme cache and pure resolution. Appearance
 * re-resolution must pick the matching palette set (FR-004) and an unresolved
 * selection must yield today's default appearance (FR-001 exception / FR-013)
 * without ever producing empty colours.
 */

const MIDNIGHT: EditorThemeDefinition = {
  name: 'midnight',
  typeface: 'Test, serif',
  light: {
    background: '#ffffff',
    foreground: '#111111',
    accent: '#222222',
    surface: '#eeeeee',
    outline: '#333333',
    code: '#444444'
  },
  dark: {
    background: '#000000',
    foreground: '#dddddd',
    accent: '#999999',
    surface: '#111111',
    outline: '#888888',
    code: '#cccccc'
  }
}

const STATIC: EditorThemeDefinition = {
  name: 'static',
  typeface: 'Test Sans, sans-serif',
  light: EMERGENCY_EDITOR_THEME.light,
  dark: EMERGENCY_EDITOR_THEME.light
}

describe('paletteForMode', () => {
  it('picks the dark set in dark mode and the light set otherwise', () => {
    expect(paletteForMode(MIDNIGHT, 'dark')).toEqual(MIDNIGHT.dark)
    expect(paletteForMode(MIDNIGHT, 'light')).toEqual(MIDNIGHT.light)
  })
})

describe('theme cache (get/update)', () => {
  it('round-trips a delivered list including invalidNames', () => {
    updateEditorThemes({ themes: [MIDNIGHT], invalidNames: ['broken.json'] })
    expect(getEditorThemes()).toEqual({ themes: [MIDNIGHT], invalidNames: ['broken.json'] })
  })
})

describe('resolveEditorAppearance', () => {
  it('resolves a stored selection and follows the mode', () => {
    const light = resolveEditorAppearance('midnight', 'light', [MIDNIGHT])
    expect(light.definitionName).toBe('midnight')
    expect(light.palette).toEqual(MIDNIGHT.light)
    expect(light.typeface).toBe('Test, serif')
    expect(resolveEditorAppearance('midnight', 'dark', [MIDNIGHT]).palette).toEqual(MIDNIGHT.dark)
  })

  it('falls back to the emergency appearance when nothing resolves', () => {
    for (const missing of ['rustic', '', 'deleted-theme']) {
      const resolved = resolveEditorAppearance(missing, 'dark', [])
      expect(resolved.definitionName).toBeNull()
      expect(resolved.palette).toEqual(EMERGENCY_EDITOR_THEME.light)
      expect(resolved.typeface).toBe(EMERGENCY_EDITOR_THEME.typeface)
    }
  })

  it('renders identical colours for a static theme in both modes (US2 S3)', () => {
    expect(resolveEditorAppearance('static', 'light', [STATIC]).palette).toEqual(
      resolveEditorAppearance('static', 'dark', [STATIC]).palette
    )
  })
})

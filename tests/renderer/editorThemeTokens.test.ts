import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EDITOR_THEME_FILES,
  DEFAULT_EDITOR_THEME_STEMS,
  DEFAULT_THEME_LEGACY_CHOICES,
  DEFAULT_EDITOR_THEME_NAME,
  MIGRATED_CUSTOM_THEME_FILE,
  EMERGENCY_EDITOR_THEME,
  SANS_TYPEFACE,
  SERIF_TYPEFACE,
  fontStackFor,
  isSerifTypeface
} from '../../src/shared/editorThemeTokens'

/**
 * Spec 036 (data-model §Embedded defaults): the embedded default theme files
 * are copied VERBATIM from the pre-036 constants (editorThemePresets.ts:25-66,
 * themes.css font stacks) so seeded files render exactly as before. Pinning
 * every value here makes an accidental palette change a test failure.
 */

const RUSTIC = {
  background: '#fdf6e3',
  foreground: '#1f1b16',
  accent: '#805610',
  surface: '#fdf3d9',
  outline: '#817567',
  code: '#ba1a1a'
}
const SCHOLARLY = {
  background: '#ffffff',
  foreground: '#1a1a1a',
  accent: '#00b0e9',
  surface: '#f7f7f7',
  outline: '#8a8a8a',
  code: '#b50000'
}
const MONO_LIGHT = {
  background: '#ffffff',
  foreground: '#000000',
  accent: '#000000',
  surface: '#ffffff',
  outline: '#808080',
  code: '#000000'
}
const MONO_DARK = {
  background: '#000000',
  foreground: '#ffffff',
  accent: '#ffffff',
  surface: '#000000',
  outline: '#808080',
  code: '#ffffff'
}

describe('DEFAULT_EDITOR_THEME_FILES', () => {
  it('contains exactly the five default stems (FR-002)', () => {
    expect(Object.keys(DEFAULT_EDITOR_THEME_FILES).sort()).toEqual([
      'monotone',
      'monotone-serif',
      'rustic',
      'rustic-serif',
      'scholarly'
    ])
    expect(DEFAULT_EDITOR_THEME_STEMS).toHaveLength(5)
  })

  it('pins rustic verbatim (static, Inter sans)', () => {
    expect(DEFAULT_EDITOR_THEME_FILES.rustic).toEqual({
      typeface: SANS_TYPEFACE,
      light: RUSTIC,
      dark: RUSTIC
    })
  })

  it('pins rustic-serif verbatim (same palette, Georgia serif)', () => {
    expect(DEFAULT_EDITOR_THEME_FILES['rustic-serif']).toEqual({
      typeface: SERIF_TYPEFACE,
      light: RUSTIC,
      dark: RUSTIC
    })
  })

  it('pins scholarly verbatim with its rendered Arial stack', () => {
    expect(DEFAULT_EDITOR_THEME_FILES.scholarly).toEqual({
      typeface: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
      light: SCHOLARLY,
      dark: SCHOLARLY
    })
  })

  it('pins monotone and monotone-serif with DIFFERING light/dark sets', () => {
    expect(DEFAULT_EDITOR_THEME_FILES.monotone).toEqual({
      typeface: SANS_TYPEFACE,
      light: MONO_LIGHT,
      dark: MONO_DARK
    })
    expect(DEFAULT_EDITOR_THEME_FILES['monotone-serif']).toEqual({
      typeface: SERIF_TYPEFACE,
      light: MONO_LIGHT,
      dark: MONO_DARK
    })
  })

  it('static defaults ship identical sets; monotone pair does not (US2 S3/S4)', () => {
    for (const stem of ['rustic', 'rustic-serif', 'scholarly']) {
      expect(DEFAULT_EDITOR_THEME_FILES[stem].light).toEqual(DEFAULT_EDITOR_THEME_FILES[stem].dark)
    }
    for (const stem of ['monotone', 'monotone-serif']) {
      expect(DEFAULT_EDITOR_THEME_FILES[stem].light).not.toEqual(
        DEFAULT_EDITOR_THEME_FILES[stem].dark
      )
    }
  })

  it('mirrors spec 023 legacy choices for migration matching (FR-009)', () => {
    expect(DEFAULT_THEME_LEGACY_CHOICES).toEqual({
      rustic: 'sans-serif',
      'rustic-serif': 'serif',
      scholarly: 'sans-serif',
      monotone: 'sans-serif',
      'monotone-serif': 'serif'
    })
  })
})

describe('fontStackFor / isSerifTypeface', () => {
  it('maps the legacy choices to the two shipped stacks', () => {
    expect(fontStackFor('serif')).toBe(SERIF_TYPEFACE)
    expect(fontStackFor('sans-serif')).toBe(SANS_TYPEFACE)
  })

  it('detects serif body faces for the top-bar override', () => {
    expect(isSerifTypeface(SERIF_TYPEFACE)).toBe(true)
    expect(isSerifTypeface(' Georgia , serif '.trim())).toBe(true)
    expect(isSerifTypeface(SANS_TYPEFACE)).toBe(false)
    expect(isSerifTypeface("Arial, 'Helvetica Neue', Helvetica, sans-serif")).toBe(false)
  })
})

describe('reserved names and emergency appearance', () => {
  it('uses the reserved migration filename from the plan', () => {
    expect(MIGRATED_CUSTOM_THEME_FILE).toBe('migrated-custom.json')
  })

  it("falls back to today's default theme name and appearance (FR-001 exception)", () => {
    expect(DEFAULT_EDITOR_THEME_NAME).toBe('rustic')
    expect(EMERGENCY_EDITOR_THEME).toEqual({
      typeface: SANS_TYPEFACE,
      light: RUSTIC,
      dark: RUSTIC
    })
  })
})

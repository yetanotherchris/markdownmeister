import type { EditorColors } from './ipc-contract'

/**
 * Spec 036: the embedded contents of the five default editor theme files and
 * the typeface helpers. The palettes and stacks are copied VERBATIM from the
 * pre-036 code (editorThemePresets.ts / themes.css — research E1/E2) so seeded
 * files render exactly as before; this module is now their single home.
 *
 * Electron-free (src/shared) so main seeds files from it and the renderer uses
 * it for the FR-001 emergency appearance.
 */

/** The legacy two-valued typeface choice (spec 012/023). Migration matching
 *  (FR-009) still compares against it; rendering uses the full css stack. */
export type EditorTypefaceChoice = 'serif' | 'sans-serif'

export const SANS_TYPEFACE =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
export const SERIF_TYPEFACE = "Georgia, 'Times New Roman', 'Noto Serif', serif"

/** The font stack for a legacy `editorFont` choice, matching themes.css. */
export function fontStackFor(font: EditorTypefaceChoice): string {
  return font === 'serif' ? SERIF_TYPEFACE : SANS_TYPEFACE
}

/** True when a theme file's typeface is a serif body face (ends with the
 *  `serif` generic family, but not `sans-serif`). Drives the top-bar Inter
 *  override that keeps the Crepe toolbar readable in serif themes. */
export function isSerifTypeface(typeface: string): boolean {
  return /(,|^)\s*serif\s*$/i.test(typeface.trim())
}

export const RUSTIC_COLORS: EditorColors = {
  background: '#fdf6e3',
  foreground: '#1f1b16',
  accent: '#805610',
  surface: '#fdf3d9',
  outline: '#817567',
  code: '#ba1a1a'
}

export const SCHOLARLY_COLORS: EditorColors = {
  background: '#ffffff',
  foreground: '#1a1a1a',
  accent: '#00b0e9',
  surface: '#f7f7f7',
  outline: '#8a8a8a',
  code: '#b50000'
}

export const MONOTONE_LIGHT_COLORS: EditorColors = {
  background: '#ffffff',
  foreground: '#000000',
  accent: '#000000',
  surface: '#ffffff',
  outline: '#808080',
  code: '#000000'
}

export const MONOTONE_DARK_COLORS: EditorColors = {
  background: '#000000',
  foreground: '#ffffff',
  accent: '#ffffff',
  surface: '#000000',
  outline: '#808080',
  code: '#ffffff'
}

/** The contents of one default theme file (data-model §Embedded defaults).
 *  Static defaults ship identical light+dark sets; monotone differs so its
 *  rendered behaviour keeps following the appearance. */
export interface DefaultThemeFileContents {
  typeface: string
  light: EditorColors
  dark: EditorColors
}

const RUSTIC_FILE: DefaultThemeFileContents = {
  typeface: SANS_TYPEFACE,
  light: RUSTIC_COLORS,
  dark: RUSTIC_COLORS
}
const SCHOLARLY_FILE: DefaultThemeFileContents = {
  // Scholarly renders the Arial-like sans stack today (themes.css:97), even
  // though its legacy two-value choice is 'sans-serif' (research E2).
  typeface: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  light: SCHOLARLY_COLORS,
  dark: SCHOLARLY_COLORS
}

/** The five default theme files by stem, in no particular order (discovery
 *  sorts for display). Seeding copies these verbatim; migration matches
 *  against them. */
export const DEFAULT_EDITOR_THEME_FILES: Record<string, DefaultThemeFileContents> = {
  rustic: RUSTIC_FILE,
  'rustic-serif': { ...RUSTIC_FILE, typeface: SERIF_TYPEFACE },
  scholarly: SCHOLARLY_FILE,
  monotone: { typeface: SANS_TYPEFACE, light: MONOTONE_LIGHT_COLORS, dark: MONOTONE_DARK_COLORS },
  'monotone-serif': {
    typeface: SERIF_TYPEFACE,
    light: MONOTONE_LIGHT_COLORS,
    dark: MONOTONE_DARK_COLORS
  }
}

/** The default stems, fixed by FR-002. */
export const DEFAULT_EDITOR_THEME_STEMS: readonly string[] = [
  'rustic',
  'rustic-serif',
  'scholarly',
  'monotone',
  'monotone-serif'
]

/** The theme the app falls back to and repairs selections to (FR-013). */
export const DEFAULT_EDITOR_THEME_NAME = 'rustic'

/** Reserved migration filename (FR-009, plan D9): auto-created for stored
 *  custom colours that match no default; never overwritten once present. */
export const MIGRATED_CUSTOM_THEME_FILE = 'migrated-custom.json'

/** The legacy two-value choice each default implies — mirrors spec 023's
 *  preset table (editorThemePresets.ts:70-79) for migration matching only. */
export const DEFAULT_THEME_LEGACY_CHOICES: Record<string, EditorTypefaceChoice> = {
  rustic: 'sans-serif',
  'rustic-serif': 'serif',
  scholarly: 'sans-serif',
  monotone: 'sans-serif',
  'monotone-serif': 'serif'
}

/** The FR-001 emergency appearance: today's default (rustic + Inter), used
 *  ONLY when nothing resolves. Never listed or selectable. */
export const EMERGENCY_EDITOR_THEME: DefaultThemeFileContents = RUSTIC_FILE

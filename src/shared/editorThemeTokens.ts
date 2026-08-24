import type { EditorColors } from './ipc-contract'

export type EditorTypefaceChoice = 'serif' | 'sans-serif'

export const SANS_TYPEFACE =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', sans-serif"
export const SERIF_TYPEFACE = "Georgia, 'Times New Roman', 'Noto Serif', serif"

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

export const DEFAULT_EDITOR_THEME_STEMS: readonly string[] = [
  'rustic',
  'rustic-serif',
  'scholarly',
  'monotone',
  'monotone-serif'
]

export const DEFAULT_EDITOR_THEME_NAME = 'rustic'

export const MIGRATED_CUSTOM_THEME_FILE = 'migrated-custom.json'

export const DEFAULT_THEME_LEGACY_CHOICES: Record<string, EditorTypefaceChoice> = {
  rustic: 'sans-serif',
  'rustic-serif': 'serif',
  scholarly: 'sans-serif',
  monotone: 'sans-serif',
  'monotone-serif': 'serif'
}

export const EMERGENCY_EDITOR_THEME: DefaultThemeFileContents = RUSTIC_FILE

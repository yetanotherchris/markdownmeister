import type { EditorColors } from '../../shared/ipc-contract'



export interface ParsedThemeFile {
  typeface: string
  light: EditorColors
  dark: EditorColors
}

export type ParsedThemeFileResult = { ok: true; theme: ParsedThemeFile } | { ok: false }


export const MAX_THEME_FILE_BYTES = 1_000_000

/** Bound on theme NAMES (file stems) and therefore on the stored selection. */
export const MAX_THEME_NAME_LENGTH = 100

const THEME_EXTENSION = '.json'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

const COLOR_TOKEN_KEYS: readonly (keyof EditorColors)[] = [
  'background',
  'foreground',
  'accent',
  'surface',
  'outline',
  'code'
]


function hasControlCharacters(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}


export function isValidEditorThemeName(name: string): boolean {
  if (name.length === 0 || name.length > MAX_THEME_NAME_LENGTH) return false
  if (name.includes('/') || name.includes('\\')) return false
  return !hasControlCharacters(name)
}


export function themeStemOf(fileName: string): string | null {
  if (fileName.startsWith('.')) return null
  if (!fileName.toLowerCase().endsWith(THEME_EXTENSION)) return null
  const stem = fileName.slice(0, -THEME_EXTENSION.length)
  return isValidEditorThemeName(stem) ? stem : null
}

function isHexPalette(value: unknown): value is EditorColors {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  for (const key of COLOR_TOKEN_KEYS) {
    const color = record[key]
    if (typeof color !== 'string' || !HEX_COLOR.test(color)) return false
  }
  return true
}

/** Parse a theme file and return a generic failure for invalid input. */
export function parseThemeFile(text: string): ParsedThemeFileResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false }
  const record = parsed as Record<string, unknown>
  const typeface = record.typeface
  if (typeof typeface !== 'string' || typeface.length === 0 || typeface.length > 512) {
    return { ok: false }
  }
  if (hasControlCharacters(typeface)) return { ok: false }
  if (!isHexPalette(record.light) || !isHexPalette(record.dark)) return { ok: false }
  return { ok: true, theme: { typeface, light: record.light, dark: record.dark } }
}

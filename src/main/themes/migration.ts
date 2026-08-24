import * as fs from 'fs'
import * as path from 'path'
import type { EditorColors } from '../../shared/ipc-contract'
import {
  DEFAULT_EDITOR_THEME_FILES,
  DEFAULT_EDITOR_THEME_STEMS,
  DEFAULT_THEME_LEGACY_CHOICES,
  MIGRATED_CUSTOM_THEME_FILE,
  EditorTypefaceChoice,
  fontStackFor
} from '../../shared/editorThemeTokens'
import { atomicWrite } from '../fs/atomicWrite'
import { readConfigFile } from '../settingsFile'



export interface LegacyThemeFields {
  editorTheme: unknown
  editorFont: unknown
  editorColors: unknown
}

export interface MigrationOutcome {
  /** Stem written into `settings.editorTheme`, when a repair happened. */
  repairedThemeName: string | null
  /** `migrated-custom.json` when this run created it (not when it existed). */
  createdFileName: string | null
}

export const MIGRATED_CUSTOM_THEME_NAME = MIGRATED_CUSTOM_THEME_FILE.replace(/\.json$/, '')

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const COLOR_TOKEN_KEYS: readonly (keyof EditorColors)[] = [
  'background',
  'foreground',
  'accent',
  'surface',
  'outline',
  'code'
]


function isLegacyEditorColors(value: unknown): value is EditorColors {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  for (const key of COLOR_TOKEN_KEYS) {
    const color = record[key]
    if (typeof color !== 'string' || !HEX_COLOR.test(color)) return false
  }
  return Object.keys(record).length === COLOR_TOKEN_KEYS.length
}

function samePalette(a: EditorColors, b: EditorColors): boolean {
  return COLOR_TOKEN_KEYS.every((key) => a[key].toLowerCase() === b[key].toLowerCase())
}


export function matchDefaultThemeStem(
  colors: EditorColors,
  fontChoice: EditorTypefaceChoice
): string | null {
  for (const stem of DEFAULT_EDITOR_THEME_STEMS) {
    const file = DEFAULT_EDITOR_THEME_FILES[stem]
    if (file === undefined) continue
    if (DEFAULT_THEME_LEGACY_CHOICES[stem] !== fontChoice) continue
    const paletteMatches =
      samePalette(colors, file.light) ||
      (stem === 'monotone' || stem === 'monotone-serif' ? samePalette(colors, file.dark) : false)
    if (paletteMatches) return stem
  }
  return null
}

function readLegacySettings(configPath: string): LegacyThemeFields | null {
  const config = readConfigFile(configPath)
  const settings = config.settings
  if (!settings || typeof settings !== 'object') return null
  const record = settings as Record<string, unknown>
  return {
    editorTheme: record.editorTheme,
    editorFont: record.editorFont,
    editorColors: record.editorColors
  }
}


function persistSelectionAndStripLegacy(configPath: string, themeName: string): void {
  const current = readConfigFile(configPath)
  const rawSettings =
    current.settings && typeof current.settings === 'object'
      ? (current.settings as Record<string, unknown>)
      : {}
  const nextSettings: Record<string, unknown> = { ...rawSettings, editorTheme: themeName }
  delete nextSettings.editorColors
  delete nextSettings.editorFont
  const updated = { ...current, settings: nextSettings }
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  atomicWrite(configPath, JSON.stringify(updated, null, 2), 0o600)
}

/** Run the migration for one config + themes directory. Best-effort: a failed
 *  migrated-custom write leaves everything unchanged (the caller's discovery
 *  simply will not list it) and the error propagates to the caller's quiet
 *  startup handler. */
export function migrateLegacyCustomTheme(configPath: string, themesDir: string): MigrationOutcome {
  const legacy = readLegacySettings(configPath)
  if (legacy === null) return { repairedThemeName: null, createdFileName: null }
  if (!isLegacyEditorColors(legacy.editorColors)) {
    return { repairedThemeName: null, createdFileName: null }
  }
  // Missing/invalid editorFont behaved as 'sans-serif' at runtime pre-upgrade.
  const fontChoice: EditorTypefaceChoice = legacy.editorFont === 'serif' ? 'serif' : 'sans-serif'

  const matchedStem = matchDefaultThemeStem(legacy.editorColors as EditorColors, fontChoice)
  let targetName: string
  let createdFileName: string | null = null
  if (matchedStem !== null) {
    targetName = matchedStem
  } else {
    const filePath = path.join(themesDir, MIGRATED_CUSTOM_THEME_FILE)
    if (!fs.existsSync(filePath)) {
      const contents = {
        typeface: fontStackFor(fontChoice),
        light: legacy.editorColors,
        dark: legacy.editorColors
      }
      atomicWrite(filePath, `${JSON.stringify(contents, null, 2)}\n`)
      createdFileName = MIGRATED_CUSTOM_THEME_FILE
    }
    targetName = MIGRATED_CUSTOM_THEME_NAME
  }

  persistSelectionAndStripLegacy(configPath, targetName)
  return { repairedThemeName: targetName, createdFileName }
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  migrateLegacyCustomTheme,
  matchDefaultThemeStem,
  MIGRATED_CUSTOM_THEME_NAME
} from '../../../src/main/themes/migration'
import { ensureThemesDirectory } from '../../../src/main/themes/store'
import { SERIF_TYPEFACE, SANS_TYPEFACE } from '../../../src/shared/editorThemeTokens'

/**
 * Spec 036 FR-009 (data-model §Migration): spec-023 legacy custom colours are
 * mirrored into the file-based world — an exact default combo repairs the
 * selection to that stem, anything else becomes migrated-custom.json — and a
 * restart after migration is a complete no-op.
 */

let configDir: string
let themesDir: string

const SCHOLARLY_COLORS = {
  background: '#ffffff',
  foreground: '#1a1a1a',
  accent: '#00b0e9',
  surface: '#f7f7f7',
  outline: '#8a8a8a',
  code: '#b50000'
}
const CUSTOM_COLORS = {
  background: '#2b2b2b',
  foreground: '#e6e6e6',
  accent: '#3794ff',
  surface: '#1f1f1f',
  outline: '#6e6e6e',
  code: '#ff9d00'
}
const MONO_LIGHT = {
  background: '#ffffff',
  foreground: '#000000',
  accent: '#000000',
  surface: '#ffffff',
  outline: '#808080',
  code: '#000000'
}

function configPath(): string {
  return path.join(configDir, 'config.json')
}

function writeConfig(settings: Record<string, unknown>): void {
  fs.mkdirSync(configDir, { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify({ recentItems: [], settings }), 'utf-8')
}

function readRawSettings(): Record<string, unknown> {
  const parsed = JSON.parse(fs.readFileSync(configPath(), 'utf-8'))
  return parsed.settings ?? {}
}

beforeEach(() => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-themes-mig-'))
  themesDir = path.join(configDir, 'themes')
  ensureThemesDirectory(themesDir)
})

afterEach(() => {
  fs.rmSync(configDir, { recursive: true, force: true })
})

describe('matchDefaultThemeStem (pure detection mirror)', () => {
  it('matches every static default by palette + choice', () => {
    expect(matchDefaultThemeStem(SCHOLARLY_COLORS, 'sans-serif')).toBe('scholarly')
  })

  it('disambiguates rustic vs rustic-serif by the typeface choice', () => {
    expect(matchDefaultThemeStem(SCHOLARLY_COLORS, 'serif')).toBeNull()
    const rustic = {
      background: '#fdf6e3',
      foreground: '#1f1b16',
      accent: '#805610',
      surface: '#fdf3d9',
      outline: '#817567',
      code: '#ba1a1a'
    }
    expect(matchDefaultThemeStem(rustic, 'sans-serif')).toBe('rustic')
    expect(matchDefaultThemeStem(rustic, 'serif')).toBe('rustic-serif')
  })

  it('accepts either monotone variant (mirrors spec 023)', () => {
    expect(matchDefaultThemeStem(MONO_LIGHT, 'sans-serif')).toBe('monotone')
    expect(matchDefaultThemeStem(MONO_LIGHT, 'serif')).toBe('monotone-serif')
  })

  it('compares hex case-insensitively', () => {
    const upper = {
      ...SCHOLARLY_COLORS,
      accent: '#00B0E9',
      background: '#FFFFFF'
    }
    expect(matchDefaultThemeStem(upper, 'sans-serif')).toBe('scholarly')
  })
})

describe('migrateLegacyCustomTheme', () => {
  it('repairs an exact default combo to its stem and drops the legacy fields', () => {
    writeConfig({
      editorTheme: 'rustic',
      editorFont: 'sans-serif',
      editorColors: SCHOLARLY_COLORS,
      themeOverride: 'dark'
    })
    const outcome = migrateLegacyCustomTheme(configPath(), themesDir)
    expect(outcome).toEqual({ repairedThemeName: 'scholarly', createdFileName: null })
    const raw = readRawSettings()
    expect(raw.editorTheme).toBe('scholarly')
    expect('editorColors' in raw).toBe(false)
    expect('editorFont' in raw).toBe(false)
    // Untouched sibling fields survive the surgical write.
    expect(raw.themeOverride).toBe('dark')
    expect(JSON.parse(fs.readFileSync(configPath(), 'utf-8')).recentItems).toEqual([])
    expect(fs.readdirSync(themesDir)).toEqual([])
  })

  it('creates migrated-custom.json for a non-default combo in BOTH sets', () => {
    writeConfig({ editorTheme: 'rustic', editorFont: 'serif', editorColors: CUSTOM_COLORS })
    const outcome = migrateLegacyCustomTheme(configPath(), themesDir)
    expect(outcome.createdFileName).toBe('migrated-custom.json')
    expect(outcome.repairedThemeName).toBe(MIGRATED_CUSTOM_THEME_NAME)
    const created = JSON.parse(
      fs.readFileSync(path.join(themesDir, 'migrated-custom.json'), 'utf-8')
    )
    expect(created.typeface).toBe(SERIF_TYPEFACE)
    expect(created.light).toEqual(CUSTOM_COLORS)
    expect(created.dark).toEqual(CUSTOM_COLORS)
    expect(readRawSettings().editorTheme).toBe(MIGRATED_CUSTOM_THEME_NAME)
  })

  it('keeps an existing migrated-custom.json and never rewrites it (idempotent)', () => {
    writeConfig({ editorTheme: 'rustic', editorFont: 'serif', editorColors: CUSTOM_COLORS })
    const existingPath = path.join(themesDir, 'migrated-custom.json')
    fs.writeFileSync(existingPath, '{ "typeface": "UserCustom", "light": {}, "dark": {} }', 'utf-8')
    const outcome = migrateLegacyCustomTheme(configPath(), themesDir)
    expect(outcome.createdFileName).toBeNull()
    expect(outcome.repairedThemeName).toBe(MIGRATED_CUSTOM_THEME_NAME)
    expect(JSON.parse(fs.readFileSync(existingPath, 'utf-8')).typeface).toBe('UserCustom')
  })

  it('is a no-op on the run after migration (restart idempotency)', () => {
    writeConfig({ editorTheme: 'rustic', editorFont: 'sans-serif', editorColors: CUSTOM_COLORS })
    migrateLegacyCustomTheme(configPath(), themesDir)
    const before = fs.readFileSync(configPath(), 'utf-8')
    const outcome = migrateLegacyCustomTheme(configPath(), themesDir)
    expect(outcome).toEqual({ repairedThemeName: null, createdFileName: null })
    expect(fs.readFileSync(configPath(), 'utf-8')).toBe(before)
  })

  it('never re-yanks a later manual selection once migrated (FR-006)', () => {
    writeConfig({ editorTheme: 'rustic', editorFont: 'sans-serif', editorColors: SCHOLARLY_COLORS })
    migrateLegacyCustomTheme(configPath(), themesDir)
    // The user now picks something else through the dialog.
    writeConfig({ editorTheme: 'monotone' })
    const before = fs.readFileSync(configPath(), 'utf-8')
    const outcome = migrateLegacyCustomTheme(configPath(), themesDir)
    expect(outcome.repairedThemeName).toBeNull()
    expect(fs.readFileSync(configPath(), 'utf-8')).toBe(before)
  })

  it('does nothing when legacy colours are absent or invalid', () => {
    writeConfig({ editorTheme: 'monotone', editorColors: null })
    expect(migrateLegacyCustomTheme(configPath(), themesDir)).toEqual({
      repairedThemeName: null,
      createdFileName: null
    })
    writeConfig({ editorTheme: 'monotone', editorColors: { background: 'red' } })
    expect(migrateLegacyCustomTheme(configPath(), themesDir)).toEqual({
      repairedThemeName: null,
      createdFileName: null
    })
    expect(fs.readdirSync(themesDir)).toEqual([])
    expect(readRawSettings().editorTheme).toBe('monotone')
  })

  it('treats a missing/invalid legacy font as the old sans-serif fallback', () => {
    writeConfig({ editorTheme: 'monotone', editorColors: SCHOLARLY_COLORS })
    const outcome = migrateLegacyCustomTheme(configPath(), themesDir)
    // Scholarly palette + sans-serif → scholarly; a serif mismatch would have
    // produced migrated-custom with the Inter stack instead.
    expect(outcome.repairedThemeName).toBe('scholarly')
    expect(outcome.createdFileName).toBeNull()
  })

  it('writes the sans stack for a custom combo without a valid font field', () => {
    writeConfig({ editorColors: CUSTOM_COLORS })
    const outcome = migrateLegacyCustomTheme(configPath(), themesDir)
    expect(outcome.createdFileName).toBe('migrated-custom.json')
    const created = JSON.parse(
      fs.readFileSync(path.join(themesDir, 'migrated-custom.json'), 'utf-8')
    )
    expect(created.typeface).toBe(SANS_TYPEFACE)
  })

  it('does nothing when the config has no settings section', () => {
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(configPath(), JSON.stringify({ recentItems: [] }), 'utf-8')
    expect(migrateLegacyCustomTheme(configPath(), themesDir)).toEqual({
      repairedThemeName: null,
      createdFileName: null
    })
    expect(fs.existsSync(path.join(configDir, 'config.json'))).toBe(true)
    expect(fs.readdirSync(themesDir)).toEqual([])
  })
})

import * as fs from 'fs'
import * as path from 'path'
import type { Settings, EditorThemeName, SpellcheckLanguage, EditorColors, FileOpenBehavior } from '../shared/ipc-contract'
import { RUSTIC_COLORS } from '../shared/editorThemePresets'
import { atomicWrite } from './fs/atomicWrite'

/**
 * Pure, electron-free settings store (spec 010 T003/T004, spec 012 T003) —
 * mirrors the `recentItems`/`recentItemsPath` split so the load/save logic is
 * unit-testable without mocking Electron. Callers resolve the file path
 * (settings.ts) and pass it in; this module never touches `app`.
 *
 * Spec 012 FR-002: settings live in the SAME per-user configuration file as the
 * recent-items list — `config.json` at `appData/markdownmeister` (or the `MM_CONFIG_DIR`
 * test seam). The file shape is `{ recentItems?, settings? }`, and every write
 * is a read-modify-write so saving settings never clobbers the recent-items
 * list (and vice versa).
 *
 * Tolerance (FR-009, spec edges): a missing, unreadable, or malformed settings
 * file yields the defaults (never an exception). Each field is validated
 * individually so a partially-corrupt file keeps every recoverable value.
 */
export const DEFAULTS: Settings = {
  sidebarWidth: 30,
  themeOverride: null,
  explorerVisible: true,
  editorFont: 'sans-serif',
  editorTheme: 'rustic',
  // Spec 008 clarification 2026-08-09: presets are materialised in the config,
  // not stored as null. A fresh config's first write must therefore persist the
  // default preset's (rustic) exact colours, so the default carries them.
  editorColors: RUSTIC_COLORS,
  spellcheckEnabled: true,
  spellcheckLanguage: null,
  fileOpenBehavior: 'same-tab'
}

/** Read the whole shared config file, tolerantly: `{}` when missing or invalid.
 *  `settings` extracts only the `.settings` section. */
export function readConfigFile(filePath: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** The closed five-name union of editor themes (spec 016 FR-001/FR-006). */
const EDITOR_THEME_NAMES: readonly EditorThemeName[] = [
  'rustic', 'rustic-serif', 'monotone', 'monotone-serif', 'scholarly'
]

/** The closed union of selectable spellcheck languages (spec 020). */
const SPELLCHECK_LANGUAGES: readonly SpellcheckLanguage[] = ['en-GB', 'en-US']

/** The closed two-value union of explorer file-opening behavior (spec 008). */
const FILE_OPEN_BEHAVIORS: readonly FileOpenBehavior[] = ['same-tab', 'new-tab']

function isEditorThemeName(value: unknown): value is EditorThemeName {
  return typeof value === 'string' && (EDITOR_THEME_NAMES as readonly string[]).includes(value)
}

function isSpellcheckLanguage(value: unknown): value is SpellcheckLanguage {
  return typeof value === 'string' && (SPELLCHECK_LANGUAGES as readonly string[]).includes(value)
}

function isFileOpenBehavior(value: unknown): value is FileOpenBehavior {
  return typeof value === 'string' && (FILE_OPEN_BEHAVIORS as readonly string[]).includes(value)
}

/** Spec 023 FR-010: a valid `EditorColors` is either `null` or a closed
 *  six-key record whose values are all `#rrggbb` hex strings. Anything else is
 *  rejected whole (falls back to the preset's colours). */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function isEditorColors(value: unknown): value is EditorColors | null {
  if (value === null) return true
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const keys = ['background', 'foreground', 'accent', 'surface', 'outline', 'code']
  for (const key of keys) {
    if (!(key in record) || typeof record[key] !== 'string' || !HEX_COLOR.test(record[key] as string)) {
      return false
    }
  }
  return Object.keys(record).length === keys.length
}

function validateSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS }
  const parsed = raw as Record<string, unknown>
  return {
    sidebarWidth: typeof parsed.sidebarWidth === 'number' && Number.isFinite(parsed.sidebarWidth)
      ? parsed.sidebarWidth : DEFAULTS.sidebarWidth,
    themeOverride: (parsed.themeOverride === 'light' || parsed.themeOverride === 'dark' || parsed.themeOverride === null)
      ? parsed.themeOverride : DEFAULTS.themeOverride,
    explorerVisible: typeof parsed.explorerVisible === 'boolean' ? parsed.explorerVisible : DEFAULTS.explorerVisible,
    editorFont: (parsed.editorFont === 'sans-serif' || parsed.editorFont === 'serif')
      ? parsed.editorFont : DEFAULTS.editorFont,
    editorTheme: isEditorThemeName(parsed.editorTheme) ? parsed.editorTheme : DEFAULTS.editorTheme,
    editorColors: isEditorColors(parsed.editorColors) ? parsed.editorColors : null,
    spellcheckEnabled: typeof parsed.spellcheckEnabled === 'boolean'
      ? parsed.spellcheckEnabled : DEFAULTS.spellcheckEnabled,
    spellcheckLanguage: parsed.spellcheckLanguage === null || isSpellcheckLanguage(parsed.spellcheckLanguage)
      ? parsed.spellcheckLanguage : DEFAULTS.spellcheckLanguage,
    fileOpenBehavior: isFileOpenBehavior(parsed.fileOpenBehavior)
      ? parsed.fileOpenBehavior : DEFAULTS.fileOpenBehavior
  }
}

/**
 * Merge a renderer-supplied patch into `current`, validating every field
 * against a closed set (review #27: `editorFont` is a closed union — never
 * arbitrary text; `sidebarWidth` must be a finite number). Returns the merged
 * Settings. Pure and electron-free so the merge is unit-testable; `settings.ts`
 * holds the authoritative in-memory snapshot this is applied to.
 */
export function mergeSettingsPatch(current: Settings, patch: Partial<Settings>): Settings {
  return {
    sidebarWidth: typeof patch.sidebarWidth === 'number' && Number.isFinite(patch.sidebarWidth)
      ? patch.sidebarWidth : current.sidebarWidth,
    themeOverride: patch.themeOverride === 'light' || patch.themeOverride === 'dark' || patch.themeOverride === null
      ? patch.themeOverride as 'light' | 'dark' | null
      : current.themeOverride,
    explorerVisible: typeof patch.explorerVisible === 'boolean' ? patch.explorerVisible : current.explorerVisible,
    editorFont: patch.editorFont === 'sans-serif' || patch.editorFont === 'serif'
      ? patch.editorFont as 'sans-serif' | 'serif'
      : current.editorFont,
    editorTheme: isEditorThemeName(patch.editorTheme) ? patch.editorTheme : current.editorTheme,
    editorColors: isEditorColors(patch.editorColors) ? patch.editorColors : current.editorColors,
    spellcheckEnabled: typeof patch.spellcheckEnabled === 'boolean'
      ? patch.spellcheckEnabled : current.spellcheckEnabled,
    spellcheckLanguage: patch.spellcheckLanguage === null || isSpellcheckLanguage(patch.spellcheckLanguage)
      ? patch.spellcheckLanguage : current.spellcheckLanguage,
    fileOpenBehavior: isFileOpenBehavior(patch.fileOpenBehavior)
      ? patch.fileOpenBehavior : current.fileOpenBehavior
  }
}

/**
 * Strict pre-merge validation for a renderer-supplied `settings:update` patch
 * (spec 008 R1, contracts/settings-ui.md §Settings IPC Validation): a PRESENT
 * `fileOpenBehavior` outside the closed union throws before the patch reaches
 * the tolerant merge — malformed IPC input is never silently coerced into the
 * settings store. The disk-loaded path stays tolerant (validateSettings)
 * because a hand-edited or partially-written config should recover per-field
 * rather than be rejected whole. Electron-free so the handler is unit-testable.
 */
export function validateSettingsPatch(patch: unknown): void {
  if (!patch || typeof patch !== 'object') {
    throw Object.assign(new Error('Settings must be an object'), { code: 'IO' as const })
  }
  const record = patch as Record<string, unknown>
  if ('fileOpenBehavior' in record && !isFileOpenBehavior(record.fileOpenBehavior)) {
    throw Object.assign(new Error('fileOpenBehavior must be "same-tab" or "new-tab"'), { code: 'IO' as const })
  }
}

export function loadSettingsFile(filePath: string): Settings {
  return validateSettings(readConfigFile(filePath).settings)
}

/** True when the config file has a `.settings` key — lets the caller decide
 *  whether a legacy migration applies (settings.ts). */
export function hasSettingsKey(filePath: string): boolean {
  return 'settings' in readConfigFile(filePath)
}

/**
 * One-time migration (spec 012, plan decision), electron-free: when `configPath`
 * has no `.settings` key yet and `legacyPath` holds a pre-012 flat Settings
 * object, import its values into `configPath`. Returns the migrated Settings, or
 * `null` when no migration applies. Best-effort — a read/write failure returns
 * `null` and the caller falls through to the defaults (FR-009). The caller
 * resolves both paths (settings.ts); this module never touches `app`.
 */
export function migrateLegacySettingsFile(configPath: string, legacyPath: string): Settings | null {
  if (hasSettingsKey(configPath) || configPath === legacyPath) return null
  const legacy = readConfigFile(legacyPath)
  // Gate on "a non-empty object carrying at least one known Settings key", not
  // on any single field (review #27 #7): a hand-edited or partially-written
  // legacy file with, say, only `themeOverride` should still be imported rather
  // than dropped whole. validateSettings recovers every field individually.
  if (!legacy || typeof legacy !== 'object') return null
  const known: (keyof Settings)[] = ['sidebarWidth', 'themeOverride', 'explorerVisible', 'editorFont', 'editorTheme', 'editorColors', 'spellcheckEnabled', 'spellcheckLanguage', 'fileOpenBehavior']
  if (!known.some((k) => k in legacy)) return null
  const migrated = validateSettings(legacy)
  try {
    writeSettingsFile(configPath, migrated)
  } catch {
    return null
  }
  return migrated
}

/**
 * Read-modify-write: load the current config (tolerant → `{}`), merge the
 * `settings` section, and write the whole file back so `recentItems` survives.
 *
 * The write is ATOMIC (temp + fsync + rename, Principle III) with an explicit
 * `0o600` mode — review #27 M1/M2: settings now share the file that holds the
 * MRU list of absolute paths, so this writer must not be able to truncate it on
 * a crash (a plain `writeFileSync` could) or leave it world-readable on first
 * creation (the `ame` directory may not exist yet on a fresh profile).
 */
export function writeSettingsFile(filePath: string, settings: Settings): void {
  const current = readConfigFile(filePath)
  const updated = { ...current, settings }
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  atomicWrite(filePath, JSON.stringify(updated, null, 2), 0o600)
}

/**
 * Spec 008 clarification 2026-08-09: "Materialise defaults on first launch."
 * When the shared config has no settings section — the file is missing (fresh
 * install, config.json deleted) or it only carries sibling sections such as
 * `recentItems` — write the DEFAULTS section so the default Rustic palette is
 * persisted from the very first launch. Returns the settings written, or `null`
 * when nothing was materialised.
 *
 * FR-009 tolerance: a MALFORMED file (or any valid JSON that is not a config
 * object) is left untouched — an implicit startup write must never overwrite an
 * invalid config; only a real user settings write may repair it (the
 * malformed-config e2e tests depend on this). A config that already has a
 * `.settings` key is also left alone.
 *
 * `explorerVisible` is a parameter so the caller can write the honest FR-013
 * state (`false` at startup, when no folder is open — writing plain `true`
 * would be flipped to `false` by reconcile on the next launch anyway).
 *
 * Best-effort: a write failure returns `null` and the caller falls through to
 * the in-memory defaults (FR-009). Electron-free so the callers resolve the
 * path (settings.ts) and this logic is unit-testable.
 */
export function materialiseDefaultSettings(filePath: string, explorerVisible: boolean): Settings | null {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch {
    // Missing or unreadable: treat as a fresh install and materialise. A write
    // failure (e.g. EACCES) falls through to null — the defaults still apply.
    return writeDefaults(filePath, explorerVisible)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Malformed JSON: never overwrite an invalid config implicitly (FR-009).
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    // Valid JSON that is not a config object — leave it alone.
    return null
  }
  if ('settings' in (parsed as Record<string, unknown>)) {
    // A settings section already exists.
    return null
  }

  return writeDefaults(filePath, explorerVisible)
}

function writeDefaults(filePath: string, explorerVisible: boolean): Settings | null {
  const settings = { ...DEFAULTS, explorerVisible }
  try {
    writeSettingsFile(filePath, settings)
  } catch {
    return null
  }
  return settings
}

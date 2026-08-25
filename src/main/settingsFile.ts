import * as fs from 'fs'
import * as path from 'path'
import type { Settings, SpellcheckLanguage, FileOpenBehavior } from '../shared/ipc-contract'
import { MARKDOWN_SYNTAX_DEFAULTS } from '../shared/markdownSyntaxDefaults'
import { isValidEditorThemeName } from './themes/validate'
import { atomicWrite } from './fs/atomicWrite'

export const DEFAULTS: Settings = {
  sidebarWidth: 30,
  themeOverride: null,
  explorerVisible: true,
  editorTheme: 'rustic',
  spellcheckEnabled: true,
  spellcheckLanguage: null,
  fileOpenBehavior: 'same-tab',
  ...MARKDOWN_SYNTAX_DEFAULTS,
  visualCodeHighlighting: true,
  formattingBarVisible: true
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

const SPELLCHECK_LANGUAGES: readonly SpellcheckLanguage[] = ['en-GB', 'en-US']

const FILE_OPEN_BEHAVIORS: readonly FileOpenBehavior[] = ['same-tab', 'new-tab']

function isSpellcheckLanguage(value: unknown): value is SpellcheckLanguage {
  return typeof value === 'string' && (SPELLCHECK_LANGUAGES as readonly string[]).includes(value)
}

function isFileOpenBehavior(value: unknown): value is FileOpenBehavior {
  return typeof value === 'string' && (FILE_OPEN_BEHAVIORS as readonly string[]).includes(value)
}

function validateSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS }
  const parsed = raw as Record<string, unknown>
  return {
    sidebarWidth:
      typeof parsed.sidebarWidth === 'number' && Number.isFinite(parsed.sidebarWidth)
        ? parsed.sidebarWidth
        : DEFAULTS.sidebarWidth,
    themeOverride:
      parsed.themeOverride === 'light' ||
      parsed.themeOverride === 'dark' ||
      parsed.themeOverride === null
        ? parsed.themeOverride
        : DEFAULTS.themeOverride,
    explorerVisible:
      typeof parsed.explorerVisible === 'boolean'
        ? parsed.explorerVisible
        : DEFAULTS.explorerVisible,
    editorTheme:
      typeof parsed.editorTheme === 'string' && isValidEditorThemeName(parsed.editorTheme)
        ? parsed.editorTheme
        : DEFAULTS.editorTheme,
    spellcheckEnabled:
      typeof parsed.spellcheckEnabled === 'boolean'
        ? parsed.spellcheckEnabled
        : DEFAULTS.spellcheckEnabled,
    spellcheckLanguage:
      parsed.spellcheckLanguage === null || isSpellcheckLanguage(parsed.spellcheckLanguage)
        ? parsed.spellcheckLanguage
        : DEFAULTS.spellcheckLanguage,
    fileOpenBehavior: isFileOpenBehavior(parsed.fileOpenBehavior)
      ? parsed.fileOpenBehavior
      : DEFAULTS.fileOpenBehavior,
    hardBreaks: typeof parsed.hardBreaks === 'boolean' ? parsed.hardBreaks : DEFAULTS.hardBreaks,
    strikethrough:
      typeof parsed.strikethrough === 'boolean' ? parsed.strikethrough : DEFAULTS.strikethrough,
    tables: typeof parsed.tables === 'boolean' ? parsed.tables : DEFAULTS.tables,
    taskLists: typeof parsed.taskLists === 'boolean' ? parsed.taskLists : DEFAULTS.taskLists,
    math: typeof parsed.math === 'boolean' ? parsed.math : DEFAULTS.math,
    autolink: typeof parsed.autolink === 'boolean' ? parsed.autolink : DEFAULTS.autolink,
    visualCodeHighlighting:
      typeof parsed.visualCodeHighlighting === 'boolean'
        ? parsed.visualCodeHighlighting
        : DEFAULTS.visualCodeHighlighting,
    formattingBarVisible:
      typeof parsed.formattingBarVisible === 'boolean'
        ? parsed.formattingBarVisible
        : DEFAULTS.formattingBarVisible
  }
}

export function mergeSettingsPatch(current: Settings, patch: Partial<Settings>): Settings {
  return {
    sidebarWidth:
      typeof patch.sidebarWidth === 'number' && Number.isFinite(patch.sidebarWidth)
        ? patch.sidebarWidth
        : current.sidebarWidth,
    themeOverride:
      patch.themeOverride === 'light' ||
      patch.themeOverride === 'dark' ||
      patch.themeOverride === null
        ? (patch.themeOverride as 'light' | 'dark' | null)
        : current.themeOverride,
    explorerVisible:
      typeof patch.explorerVisible === 'boolean' ? patch.explorerVisible : current.explorerVisible,
    editorTheme:
      typeof patch.editorTheme === 'string' && isValidEditorThemeName(patch.editorTheme)
        ? patch.editorTheme
        : current.editorTheme,
    spellcheckEnabled:
      typeof patch.spellcheckEnabled === 'boolean'
        ? patch.spellcheckEnabled
        : current.spellcheckEnabled,
    spellcheckLanguage:
      patch.spellcheckLanguage === null || isSpellcheckLanguage(patch.spellcheckLanguage)
        ? patch.spellcheckLanguage
        : current.spellcheckLanguage,
    fileOpenBehavior: isFileOpenBehavior(patch.fileOpenBehavior)
      ? patch.fileOpenBehavior
      : current.fileOpenBehavior,
    hardBreaks: typeof patch.hardBreaks === 'boolean' ? patch.hardBreaks : current.hardBreaks,
    strikethrough:
      typeof patch.strikethrough === 'boolean' ? patch.strikethrough : current.strikethrough,
    tables: typeof patch.tables === 'boolean' ? patch.tables : current.tables,
    taskLists: typeof patch.taskLists === 'boolean' ? patch.taskLists : current.taskLists,
    math: typeof patch.math === 'boolean' ? patch.math : current.math,
    autolink: typeof patch.autolink === 'boolean' ? patch.autolink : current.autolink,
    visualCodeHighlighting:
      typeof patch.visualCodeHighlighting === 'boolean'
        ? patch.visualCodeHighlighting
        : current.visualCodeHighlighting,
    formattingBarVisible:
      typeof patch.formattingBarVisible === 'boolean'
        ? patch.formattingBarVisible
        : current.formattingBarVisible
  }
}

export function validateSettingsPatch(patch: unknown): void {
  if (!patch || typeof patch !== 'object') {
    throw Object.assign(new Error('Settings must be an object'), { code: 'IO' as const })
  }
  const record = patch as Record<string, unknown>
  if ('fileOpenBehavior' in record && !isFileOpenBehavior(record.fileOpenBehavior)) {
    throw Object.assign(new Error('fileOpenBehavior must be "same-tab" or "new-tab"'), {
      code: 'IO' as const
    })
  }
  if ('editorTheme' in record) {
    if (typeof record.editorTheme !== 'string' || !isValidEditorThemeName(record.editorTheme)) {
      throw Object.assign(new Error('editorTheme must be a valid theme name'), {
        code: 'IO' as const
      })
    }
  }
  const markdownBooleans = [
    'hardBreaks',
    'strikethrough',
    'tables',
    'taskLists',
    'math',
    'autolink',
    'visualCodeHighlighting',
    'formattingBarVisible'
  ] as const
  for (const key of markdownBooleans) {
    if (key in record && typeof record[key] !== 'boolean') {
      throw Object.assign(new Error(`${key} must be a boolean`), { code: 'IO' as const })
    }
  }
}

export function loadSettingsFile(filePath: string): Settings {
  return validateSettings(readConfigFile(filePath).settings)
}

export function hasSettingsKey(filePath: string): boolean {
  return 'settings' in readConfigFile(filePath)
}

export function migrateLegacySettingsFile(configPath: string, legacyPath: string): Settings | null {
  if (hasSettingsKey(configPath) || configPath === legacyPath) return null
  const legacy = readConfigFile(legacyPath)
  if (!legacy || typeof legacy !== 'object') return null
  const known: (keyof Settings)[] = [
    'sidebarWidth',
    'themeOverride',
    'explorerVisible',
    'editorTheme',
    'spellcheckEnabled',
    'spellcheckLanguage',
    'fileOpenBehavior',
    'hardBreaks',
    'strikethrough',
    'tables',
    'taskLists',
    'math',
    'autolink',
    'visualCodeHighlighting',
    'formattingBarVisible'
  ]
  if (!known.some((k) => k in legacy)) return null
  const migrated = validateSettings(legacy)
  try {
    writeSettingsFile(configPath, migrated)
  } catch {
    return null
  }
  return migrated
}

export function writeSettingsFile(filePath: string, settings: Settings): void {
  const current = readConfigFile(filePath)
  const updated = { ...current, settings }
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  atomicWrite(filePath, JSON.stringify(updated, null, 2), 0o600)
}

export function materialiseDefaultSettings(
  filePath: string,
  explorerVisible: boolean
): Settings | null {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf-8')
  } catch {
    // Missing or unreadable: treat as a fresh install and materialise. A write
    // failure (e.g. EACCES) falls through to null, the defaults still apply.
    return writeDefaults(filePath, explorerVisible)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    // Valid JSON that is not a config object, leave it alone.
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

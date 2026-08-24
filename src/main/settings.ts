import { app } from 'electron'
import * as path from 'path'
import type { Settings } from '../shared/ipc-contract'
import {
  loadSettingsFile,
  writeSettingsFile,
  migrateLegacySettingsFile,
  mergeSettingsPatch,
  materialiseDefaultSettings,
  DEFAULTS
} from './settingsFile'
import { recentItemsConfigPath } from './recentItemsPath'
import { ctx } from './ipc/handlers/context'

export { DEFAULTS }

function settingsPath(): string {
  return recentItemsConfigPath()
}

function legacySettingsPath(): string {
  const override = process.env.MM_CONFIG_DIR
  if (override && override.length > 0) {
    return path.join(override, 'settings.json')
  }
  return path.join(app.getPath('userData'), 'settings.json')
}

let currentSettings: Settings | null = null

function loadFromDisk(): Settings {
  const configPath = settingsPath()
  const migrated = migrateLegacySettingsFile(configPath, legacySettingsPath())
  if (migrated) return migrated
  const settings = loadSettingsFile(configPath)
  materialiseDefaultSettings(configPath, ctx.workspaceRoot !== null)
  return settings
}

export function loadSettings(): Settings {
  if (!currentSettings) currentSettings = loadFromDisk()
  return currentSettings
}

function validateAndMerge(patch: Partial<Settings>): Settings {
  return mergeSettingsPatch(loadSettings(), patch)
}

/** Merge a validated patch into the authoritative in-memory settings and
 *  schedule the (debounced) disk write. Returns the merged Settings. */
export function updateSettings(patch: Partial<Settings>): Settings {
  const updated = validateAndMerge(patch)
  currentSettings = updated
  saveSettings(updated)
  return updated
}

let writeTimer: ReturnType<typeof setTimeout> | null = null

export function saveSettings(settings: Settings): void {
  if (writeTimer) {
    clearTimeout(writeTimer)
  }

  writeTimer = setTimeout(() => {
    try {
      writeSettingsFile(settingsPath(), settings)
      writeTimer = null
    } catch {
      // A later settings change retries the deferred write.
    }
  }, 500)
}

export function flushSettings(): void {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
    try {
      writeSettingsFile(settingsPath(), currentSettings ?? loadFromDisk())
    } catch {
      // Keep the in-memory settings when persistence is unavailable.
    }
  }
}

export function adoptRepairedEditorTheme(themeName: string): void {
  if (!currentSettings || currentSettings.editorTheme === themeName) return
  currentSettings = { ...currentSettings, editorTheme: themeName }
  if (writeTimer) {
    clearTimeout(writeTimer)
    saveSettings(currentSettings)
  }
}

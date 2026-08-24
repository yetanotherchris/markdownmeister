import { ipcMain } from 'electron'
import { loadSettings, updateSettings } from '../../settings'
import { applyThemeOverride } from '../../theme'
import { applySpellcheckSetting } from '../../spellcheck'
import { validateSettingsPatch, DEFAULTS } from '../../settingsFile'
import type { Result, Settings } from '../../../shared/ipc-contract'
import { ctx, ok, err, sanitizeError, isAuthorizedRenderer } from './context'

export function registerSettingsHandlers(window: Electron.BrowserWindow, _ctx: typeof ctx): void {
  ipcMain.handle('settings:get', (event): Result<Settings> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      return ok(loadSettings())
    } catch {
      return ok({ ...DEFAULTS })
    }
  })

  ipcMain.handle('settings:update', (event, patch: unknown): Result<Settings> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateSettingsPatch(patch)
      const updated = updateSettings(patch as Partial<Settings>)
      applyThemeOverride(updated.themeOverride)
      applySpellcheckSetting(updated.spellcheckEnabled, updated.spellcheckLanguage)
      return ok(updated)
    } catch (e: unknown) {
      return err('IO', sanitizeError(e, null))
    }
  })
}

import { ipcMain } from 'electron'
import type { EditorThemesList, Result } from '../../../shared/ipc-contract'
import { DEFAULT_EDITOR_THEME_NAME } from '../../../shared/editorThemeTokens'
import { ensureThemesDirectory, listThemes } from '../../themes/store'
import { themesDir } from '../../themes/path'
import { loadSettings, updateSettings } from '../../settings'
import { ctx, ok, err, sanitizeError, isAuthorizedRenderer } from './context'

export function unresolvedSelectionRepair(
  themes: { name: string }[],
  storedSelection: string
): string | null {
  if (themes.some((theme) => theme.name === storedSelection)) return null
  const folded = storedSelection.toLowerCase()
  const caseMatch = themes.find((theme) => theme.name.toLowerCase() === folded)
  return caseMatch ? caseMatch.name : DEFAULT_EDITOR_THEME_NAME
}

function resolveEditorThemes(): EditorThemesList {
  const dir = themesDir()
  ensureThemesDirectory(dir)
  const outcome = listThemes(dir)
  const storedSelection = loadSettings().editorTheme
  const repaired = unresolvedSelectionRepair(outcome.themes, storedSelection)
  if (repaired !== null && repaired !== storedSelection) {
    updateSettings({ editorTheme: repaired })
  }
  return { themes: outcome.themes, invalidNames: outcome.invalidNames }
}

export function registerThemesHandlers(window: Electron.BrowserWindow, _ctx: typeof ctx): void {
  ipcMain.handle('themes:list', (event): Result<EditorThemesList> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      return ok(resolveEditorThemes())
    } catch (e: unknown) {
      return err('IO', sanitizeError(e, null))
    }
  })
}

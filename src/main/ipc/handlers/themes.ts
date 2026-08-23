import { ipcMain } from 'electron'
import type { EditorThemesList, Result } from '../../../shared/ipc-contract'
import { DEFAULT_EDITOR_THEME_NAME } from '../../../shared/editorThemeTokens'
import { ensureThemesDirectory, listThemes } from '../../themes/store'
import { themesDir } from '../../themes/path'
import { loadSettings, updateSettings } from '../../settings'
import { ctx, ok, err, sanitizeError, isAuthorizedRenderer } from './context'

/**
 * Spec 036 theme channels (contracts/preload.md): `themes:list` reads the
 * themes folder fresh on every call (FR-012) and silently repairs a stored
 * selection that no longer resolves (FR-013). The directory is derived in
 * main (Principle II); the request carries no arguments; rejections are data,
 * never dialogs (constitution IV).
 */

/** Pure FR-013 rule: the repair target when the stored selection matches no
 *  discovered theme, or null when it resolves and nothing must be written. */
export function unresolvedSelectionRepair(
  themes: { name: string }[],
  storedSelection: string
): string | null {
  if (themes.some((theme) => theme.name === storedSelection)) return null
  return DEFAULT_EDITOR_THEME_NAME
}

function resolveEditorThemes(): EditorThemesList {
  const dir = themesDir()
  ensureThemesDirectory(dir)
  const outcome = listThemes(dir)
  const storedSelection = loadSettings().editorTheme
  const repaired = unresolvedSelectionRepair(outcome.themes, storedSelection)
  if (repaired !== null) {
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

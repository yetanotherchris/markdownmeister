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

/** Pure FR-013 rule: null when the stored selection resolves verbatim; the
 *  delivered stem when only its CASE differs — normalised once here so the
 *  renderer's exact-name resolution agrees with main's and a case-collision
 *  winner cannot re-repair the same setting on every read (review finding
 *  2026-08-23); otherwise the default theme. */
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
  // An identical repair target means nothing changed: rewriting would arm a
  // pointless debounced settings write on every startup preload and dialog
  // open (review finding 2026-08-23).
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

import { app, ipcMain, shell } from 'electron'
import type { BuildInfo, Result } from '../../../shared/ipc-contract'
import { REPOSITORY_URL, currentBuildInfo } from '../../buildInfo'
import { ctx, err, isAuthorizedRenderer, ok } from './context'

/**
 * Spec 037 channels (contracts/preload.md): `build:getInfo` serves the
 * read-only About trio; `build:openRepository` hands the constant repository
 * URL to the OS default browser exactly once per activation. Both validate
 * the approved renderer FIRST; neither accepts arguments — there is
 * deliberately nothing to validate beyond authorization (FR-004).
 */
export function registerBuildHandlers(window: Electron.BrowserWindow, _ctx: typeof ctx): void {
  ipcMain.handle('build:getInfo', (event): Result<BuildInfo> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    return ok(currentBuildInfo(app.getVersion(), app.isPackaged))
  })

  ipcMain.handle('build:openRepository', async (event): Promise<Result<null>> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      await shell.openExternal(REPOSITORY_URL)
      return ok(null)
    } catch {
      return err('IO', 'Could not open the repository URL')
    }
  })
}

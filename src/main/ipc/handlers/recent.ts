import { ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { saveRecentItems, normalizeRecentItems } from '../../recentItems'
import { recentItemsConfigPath } from '../../recentItemsPath'
import { reportRecentItemsWarning, notifyRecentItemsOk } from '../../recentItemsWarning'
import type { Result, OpenedFile, RecentItem } from '../../../shared/ipc-contract'
import {
  ctx, ok, err, ensureString, validateShape, sanitizeError, toAppError,
  isRecentEntry, recordRecent, removeRecent, canonicalPath, openFileFromPath, isAuthorizedRenderer
} from './context'


export function registerRecentHandlers(window: Electron.BrowserWindow, _ctx: typeof ctx): void {
  ipcMain.handle('recent:openFile', (event, args: unknown): Result<OpenedFile> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateShape(args, ['path'])
      ensureString((args as { path: unknown }).path, 'path')
      const requestedPath = (args as { path: string }).path

      if (!isRecentEntry(requestedPath, 'file')) {
        return err('OUTSIDE_WORKSPACE', 'Path is not a recorded recent file')
      }

      try {
        const opened = openFileFromPath(requestedPath)
        recordRecent(
          canonicalPath(opened.path ? path.resolve(ctx.workspaceRoot!, opened.path) : requestedPath),
          'file',
          opened.name
        )
        return ok(opened)
      } catch (e: unknown) {
        removeRecent(requestedPath, 'file')
        const appErr = toAppError(e)
        return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
      }
    } catch (e: unknown) {
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })

  ipcMain.handle('recent:list', (event): Result<RecentItem[]> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    const configPath = recentItemsConfigPath()
    try {
      const dirStat = fs.statSync(path.dirname(configPath))
      if (!dirStat.isDirectory()) throw new Error('config parent is not a directory')
      return ok(normalizeRecentItems(JSON.parse(fs.readFileSync(configPath, 'utf-8'))))
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return ok([])
      return err('IO', 'Recent Items could not be loaded')
    }
  })

  ipcMain.handle('recent:clear', (event): Result<null> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      saveRecentItems(recentItemsConfigPath(), [])
      notifyRecentItemsOk()
    } catch (e: unknown) {
      reportRecentItemsWarning(e, 'clear')
    }
    return ok(null)
  })
}

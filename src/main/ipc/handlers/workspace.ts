import { ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { readDir } from '../../fs/read'
import { WorkspaceState } from '../../workspace'
import type {
  Result,
  WorkspaceInfo,
  DirEntry,
  WatchEvent,
  DocumentChangeEvent
} from '../../../shared/ipc-contract'
import {
  ctx,
  ok,
  err,
  ensureString,
  validateShape,
  sanitizeError,
  toAppError,
  withWorkspace,
  isRecentEntry,
  recordRecent,
  removeRecent,
  isAuthorizedRenderer
} from './context'


export function registerWorkspaceHandlers(window: Electron.BrowserWindow, _ctx: typeof ctx): void {


  ipcMain.handle(
    'workspace:prepareFolderOpen',
    async (event, args: unknown): Promise<Result<WorkspaceInfo | null>> => {
      if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
      let requestedPath: string | null = null
      let isRecentRequest = false
      try {
        if (ctx.pendingFolderOpen) {
          return err('IO', 'A folder open is already in progress')
        }
        if (args !== undefined && args !== null) {
          validateShape(args, ['path'])
          ensureString((args as { path: unknown }).path, 'path')
          requestedPath = (args as { path: string }).path
          isRecentRequest = true
          if (!isRecentEntry(requestedPath, 'folder')) {
            return err('OUTSIDE_WORKSPACE', 'Path is not a recorded recent folder')
          }
        } else {
          const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
          })
          if (result.canceled || result.filePaths.length === 0) {
            return ok(null)
          }
          requestedPath = result.filePaths[0]
        }

        const realRootPath = fs.realpathSync(requestedPath)
        return prepareFolderFromRealPath(realRootPath)
      } catch (e: unknown) {
        ctx.pendingFolderOpen = null
        if (isRecentRequest && requestedPath !== null) {
          removeRecent(requestedPath, 'folder')
        }
        const appErr = toAppError(e)
        return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
      }
    }
  )

  ipcMain.handle('workspace:commitFolderOpen', (event): Result<WorkspaceInfo> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    const pending = ctx.pendingFolderOpen
    if (!pending) {
      return err('NO_WORKSPACE', 'No folder open is pending')
    }

    try {
      const real = fs.realpathSync(pending.root)
      if (real !== pending.root) {
        throw Object.assign(new Error('Workspace folder changed while opening'), {
          code: 'OUTSIDE_WORKSPACE' as const
        })
      }
      const stat = fs.statSync(real)
      if (!stat.isDirectory()) {
        throw Object.assign(new Error('Target is not a directory'), { code: 'NOT_FOUND' as const })
      }
      if (stat.dev !== pending.identity.dev || stat.ino !== pending.identity.ino) {
        throw Object.assign(new Error('Workspace folder changed while opening'), {
          code: 'OUTSIDE_WORKSPACE' as const
        })
      }
    } catch (e: unknown) {
      ctx.pendingFolderOpen = null
      removeRecent(pending.root, 'folder')
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }

    let candidate: WorkspaceState | null = null
    try {
      candidate = new WorkspaceState(
        (e: WatchEvent) => window.webContents.send('workspace:changed', e),
        (e: DocumentChangeEvent) => window.webContents.send('document:externallyChanged', e)
      )
      candidate.open(pending.root)

      ctx.workspaceState?.close()
      ctx.workspaceState = candidate
      candidate = null
      const root = pending.root
      const name = pending.name
      ctx.workspaceRoot = root
      ctx.pendingFolderOpen = null

      recordRecent(root, 'folder', name)
      return ok({ path: root, name, entries: pending.entries })
    } catch (e: unknown) {
      candidate?.close()
      ctx.pendingFolderOpen = null
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })

  ipcMain.handle('workspace:cancelFolderOpen', (event): Result<null> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    ctx.pendingFolderOpen = null
    return ok(null)
  })

  ipcMain.handle('workspace:readDir', (event, args: unknown): Result<DirEntry[]> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateShape(args, ['path'])
      ensureString((args as { path: unknown }).path, 'path')
      return withWorkspace(() => {
        const entries = readDir(ctx.workspaceRoot!, (args as { path: string }).path)
        ctx.workspaceState?.watchDir((args as { path: string }).path)
        return entries
      })
    } catch (e: unknown) {
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })
}


function prepareFolderFromRealPath(realRootPath: string): Result<WorkspaceInfo> {
  const stat = fs.statSync(realRootPath)
  if (!stat.isDirectory()) {
    throw Object.assign(new Error('Target is not a directory'), { code: 'NOT_FOUND' as const })
  }
  const entries = readDir(realRootPath, '.')
  const name = path.basename(realRootPath) || realRootPath
  ctx.pendingFolderOpen = {
    root: realRootPath,
    name,
    entries,
    identity: { dev: stat.dev, ino: stat.ino }
  }
  return ok({ path: realRootPath, name, entries })
}


export function prepareFolderFromOsPath(absolutePath: string): Result<WorkspaceInfo | null> {
  if (ctx.pendingFolderOpen) {
    return err('IO', 'A folder open is already in progress')
  }
  try {
    return prepareFolderFromRealPath(absolutePath)
  } catch (e: unknown) {
    const appErr = toAppError(e)
    return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
  }
}

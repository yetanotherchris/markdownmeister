import { ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { resolveWithinRoot, resolveFile, resolveDirectory } from '../../fs/paths'
import { readFile, describeEntry } from '../../fs/read'
import { writeFile } from '../../fs/write'
import { atomicWrite } from '../../fs/atomicWrite'
import { mkdir, createFile, moveEntry, trashEntry } from '../../fs/mutate'
import type {
  Result,
  OpenedFile,
  WriteReceipt,
  DirEntry,
  TrashReceipt,
  EntryInfo,
  EntryKind
} from '../../../shared/ipc-contract'
import {
  ctx,
  ok,
  err,
  ensureString,
  validateKind,
  validateShape,
  sanitizeError,
  toAppError,
  withWorkspace,
  resolveAbsolutePath,
  recordRecent,
  canonicalPath,
  openFileFromPath,
  isAuthorizedRenderer
} from './context'


export function registerFileHandlers(window: Electron.BrowserWindow, _ctx: typeof ctx): void {
  ipcMain.handle('file:openDialog', async (event): Promise<Result<OpenedFile | null>> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
      })

      if (result.canceled || result.filePaths.length === 0) {
        return ok(null)
      }

      const opened = openFileFromPath(result.filePaths[0])
      recordRecent(
        canonicalPath(
          opened.path ? path.resolve(ctx.workspaceRoot!, opened.path) : result.filePaths[0]
        ),
        'file',
        opened.name
      )
      return ok(opened)
    } catch (e: unknown) {
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })

  ipcMain.handle('file:read', (event, args: unknown): Result<OpenedFile> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateShape(args, ['path'])
      ensureString((args as { path: unknown }).path, 'path')
      return withWorkspace(() => {
        const opened = readFile(ctx.workspaceRoot!, (args as { path: string }).path)
        const parent = (args as { path: string }).path.includes('/')
          ? (args as { path: string }).path.split('/').slice(0, -1).join('/')
          : '.'
        ctx.workspaceState?.watchDir(parent)
        return opened
      })
    } catch (e: unknown) {
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })

  ipcMain.handle('file:write', (event, args: unknown): Result<WriteReceipt> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateShape(args, ['path', 'content'])
      ensureString((args as { path: unknown }).path, 'path')
      ensureString((args as { content: unknown }).content, 'content')

      if (!ctx.workspaceRoot) return err('NO_WORKSPACE', 'No workspace is open')

      const resolved = resolveWithinRoot(ctx.workspaceRoot, (args as { path: string }).path)
      ctx.workspaceState?.suppressWatch(resolved.resolved)

      const receipt = writeFile(
        ctx.workspaceRoot,
        (args as { path: string }).path,
        (args as { content: string }).content
      )
      return ok(receipt)
    } catch (e: unknown) {
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })

  ipcMain.handle(
    'file:saveDialog',
    async (event, args: unknown): Promise<Result<OpenedFile | null>> => {
      if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
      try {
        validateShape(args, ['suggestedName', 'content'])
        const { suggestedName, content } = args as { suggestedName: unknown; content: unknown }
        ensureString(suggestedName, 'suggestedName')
        ensureString(content, 'content')

        const result = await dialog.showSaveDialog({
          defaultPath: suggestedName,
          filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
        })

        if (result.canceled || !result.filePath) {
          return ok(null)
        }

        atomicWrite(result.filePath, content)
        const stat = fs.statSync(result.filePath)

        let relPath: string | null = null
        if (ctx.workspaceRoot) {
          relPath = resolveAbsolutePath(ctx.workspaceRoot, result.filePath)
        }

        return ok({
          path: relPath,
          name: path.basename(result.filePath),
          content,
          mtimeMs: stat.mtimeMs,
          size: stat.size
        })
      } catch (e: unknown) {
        return err('IO', sanitizeError(e, ctx.workspaceRoot))
      }
    }
  )

  // ---- entry:* channels (create/move/trash/describe) ----

  ipcMain.handle('entry:create', (event, args: unknown): Result<DirEntry> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateShape(args, ['parentPath', 'name', 'kind'])
      const { parentPath, name, kind } = args as { parentPath: string; name: string; kind: unknown }
      ensureString(parentPath, 'parentPath')
      ensureString(name, 'name')
      validateKind(kind)

      if (
        name.length === 0 ||
        name.includes('/') ||
        name.includes('\\') ||
        name === '..' ||
        name === '.'
      ) {
        return err('IO', 'Invalid entry name')
      }

      return withWorkspace(() => {
        const entry =
          kind === 'directory'
            ? mkdir(ctx.workspaceRoot!, parentPath, name)
            : createFile(ctx.workspaceRoot!, parentPath, name)
        const resolved = resolveWithinRoot(ctx.workspaceRoot!, entry.path)
        ctx.workspaceState?.suppressWatch(resolved.resolved)
        return entry
      })
    } catch (e: unknown) {
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })

  ipcMain.handle('entry:move', (event, args: unknown): Result<DirEntry> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateShape(args, ['fromPath', 'toPath'])
      const { fromPath, toPath } = args as { fromPath: string; toPath: string }
      ensureString(fromPath, 'fromPath')
      ensureString(toPath, 'toPath')
      return withWorkspace(() => {
        const fromResolved = resolveWithinRoot(ctx.workspaceRoot!, fromPath)
        const toResolved = resolveWithinRoot(ctx.workspaceRoot!, toPath)
        ctx.workspaceState?.suppressWatch(fromResolved.resolved)
        ctx.workspaceState?.suppressWatch(toResolved.resolved)
        ctx.workspaceState?.suppressWatch(path.resolve(ctx.workspaceRoot!, toPath))
        return moveEntry(ctx.workspaceRoot!, fromPath, toPath)
      })
    } catch (e: unknown) {
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })

  ipcMain.handle('entry:trash', async (event, args: unknown): Promise<Result<TrashReceipt>> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateShape(args, ['path'], ['path', 'permanent'])
      const { path: p, permanent } = args as { path: string; permanent?: unknown }
      ensureString(p, 'path')

      if (permanent !== undefined && typeof permanent !== 'boolean') {
        return err('IO', 'permanent must be a boolean')
      }

      if (!ctx.workspaceRoot) return err('NO_WORKSPACE', 'No workspace is open')
      const resolved = resolveWithinRoot(ctx.workspaceRoot, p)
      ctx.workspaceState?.suppressWatch(resolved.resolved)
      const receipt = await trashEntry(ctx.workspaceRoot, p, permanent)
      return ok(receipt)
    } catch (e: unknown) {
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })

  ipcMain.handle('entry:describe', (event, args: unknown): Result<EntryInfo> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateShape(args, ['path'])
      const { path: p } = args as { path: string }
      ensureString(p, 'path')
      return withWorkspace(() => describeEntry(ctx.workspaceRoot!, p))
    } catch (e: unknown) {
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })

  ipcMain.handle('entry:reveal', async (event, args: unknown): Promise<Result<null>> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateShape(args, ['path', 'kind'])
      const { path: p, kind } = args as { path: string; kind: EntryKind }
      ensureString(p, 'path')
      validateKind(kind)
      const resolved = withWorkspace(() => {
        if (kind === 'file') {
          return resolveFile(ctx.workspaceRoot!, p).resolved
        }
        return resolveDirectory(ctx.workspaceRoot!, p).resolved
      })
      if (!resolved.ok) return resolved
      if (kind === 'file') {
        shell.showItemInFolder(resolved.value)
        return ok(null)
      }
      const openError = await shell.openPath(resolved.value)
      if (openError) {
        throw Object.assign(new Error(openError), { code: 'IO' as const })
      }
      return ok(null)
    } catch (e: unknown) {
      const appErr = toAppError(e)
      return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
    }
  })
}

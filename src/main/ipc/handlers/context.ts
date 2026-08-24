import * as path from 'path'
import * as fs from 'fs'
import { resolveWithinRoot } from '../../fs/paths'
import { readFile } from '../../fs/read'
import {
  loadRecentItems,
  saveRecentItems,
  recordRecentItem,
  removeRecentItem
} from '../../recentItems'
import { recentItemsConfigPath } from '../../recentItemsPath'
import { reportRecentItemsWarning, notifyRecentItemsOk } from '../../recentItemsWarning'
import { scrubAbsolutePaths } from '../../scrubPaths'
import type { WorkspaceState } from '../../workspace'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import type {
  Result,
  DirEntry,
  OpenedFile,
  ErrorCode,
  EntryKind,
  RecentKind
} from '../../../shared/ipc-contract'

export interface PendingFolderOpen {
  root: string
  name: string
  entries: DirEntry[]
  identity: { dev: number; ino: number }
}

export const ctx = {
  workspaceState: null as WorkspaceState | null,
  workspaceRoot: null as string | null,
  allowClose: false,
  quitRequestPending: false,
  approvedRendererUrl: null as string | null,
  pendingFolderOpen: null as PendingFolderOpen | null
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function err(
  code: ErrorCode,
  message: string
): { ok: false; code: ErrorCode; message: string } {
  return { ok: false, code, message }
}

export function isAuthorizedRenderer(event: IpcMainInvokeEvent, window: BrowserWindow): boolean {
  if (event.sender !== window.webContents || !ctx.approvedRendererUrl) return false
  const senderUrl = event.senderFrame?.url
  if (!senderUrl) return false
  if (ctx.approvedRendererUrl.startsWith('file:')) return senderUrl === ctx.approvedRendererUrl
  try {
    return new URL(senderUrl).origin === new URL(ctx.approvedRendererUrl).origin
  } catch {
    return false
  }
}

export function sanitizeError(e: unknown, workspaceRootPath: string | null): string {
  if (!(e instanceof Error)) return 'Unknown error'
  let msg = e.message
  if (workspaceRootPath) {
    msg = msg.replace(
      new RegExp(workspaceRootPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      '<workspace>'
    )
  }
  return scrubAbsolutePaths(msg)
}

export function toAppError(e: unknown): { code: ErrorCode; message: string } {
  if (!(e instanceof Error)) return { code: 'IO', message: 'Unknown error' }
  const errno = (e as NodeJS.ErrnoException).code
  if (errno === 'ENOENT') return { code: 'NOT_FOUND', message: 'File or directory not found' }
  if (errno === 'EACCES' || errno === 'EPERM')
    return { code: 'PERMISSION', message: 'Permission denied' }
  if (errno === 'EEXIST') return { code: 'CONFLICT', message: 'Already exists' }
  const appCode = (e as { code?: ErrorCode }).code
  if (appCode && ERROR_CODES.has(appCode)) return { code: appCode, message: e.message }
  return { code: 'IO', message: e.message }
}

const ERROR_CODES = new Set<ErrorCode>([
  'OUTSIDE_WORKSPACE',
  'NOT_FOUND',
  'CONFLICT',
  'PERMISSION',
  'LOCKED',
  'TOO_LARGE',
  'NOT_TEXT',
  'TRASH_UNAVAILABLE',
  'NO_WORKSPACE',
  'IO'
])

export function ensureString(val: unknown, name: string): asserts val is string {
  if (typeof val !== 'string') {
    throw Object.assign(new Error(`${name} must be a string`), { code: 'IO' as ErrorCode })
  }
}

export function validateKind(val: unknown): asserts val is EntryKind {
  if (val !== 'file' && val !== 'directory') {
    throw Object.assign(new Error('kind must be "file" or "directory"'), {
      code: 'IO' as ErrorCode
    })
  }
}

export function withWorkspace<T>(fn: () => T): Result<T> {
  if (!ctx.workspaceRoot) {
    return err('NO_WORKSPACE', 'No workspace is open')
  }
  try {
    return ok(fn())
  } catch (e: unknown) {
    const appErr = toAppError(e)
    return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
  }
}

export function resolveAbsolutePath(root: string, absolutePath: string): string | null {
  try {
    const realFile = fs.realpathSync(absolutePath)
    const relative = path.relative(root, realFile)
    const segments = relative.split(path.sep)
    if (!relative || segments[0] === '..' || path.isAbsolute(relative)) {
      return null
    }
    return relative.split(path.sep).join('/')
  } catch {
    return null
  }
}

export function validateShape(
  obj: unknown,
  requiredKeys: string[],
  allowedKeys = requiredKeys
): void {
  if (!obj || typeof obj !== 'object') {
    throw Object.assign(new Error('Invalid IPC request: expected an object'), {
      code: 'IO' as ErrorCode
    })
  }
  for (const key of requiredKeys) {
    if (!(key in (obj as Record<string, unknown>))) {
      throw Object.assign(new Error(`Missing required field: ${key}`), { code: 'IO' as ErrorCode })
    }
  }
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.includes(key)) {
      throw Object.assign(new Error(`Unexpected field: ${key}`), { code: 'IO' as ErrorCode })
    }
  }
}

export function isRecentEntry(path_: string, kind: RecentKind): boolean {
  return loadRecentItems(recentItemsConfigPath()).some((i) => i.path === path_ && i.kind === kind)
}

export function recordRecent(path_: string, kind: RecentKind, name: string): void {
  const configPath = recentItemsConfigPath()
  const items = loadRecentItems(configPath)
  try {
    saveRecentItems(
      configPath,
      recordRecentItem(items, {
        path: path_,
        kind,
        name,
        lastOpenedAt: Date.now()
      })
    )
    notifyRecentItemsOk()
  } catch (e: unknown) {
    reportRecentItemsWarning(e, 'save')
  }
}

export function removeRecent(path_: string, kind: RecentKind): void {
  const configPath = recentItemsConfigPath()
  const items = loadRecentItems(configPath)
  try {
    saveRecentItems(configPath, removeRecentItem(items, path_, kind))
    notifyRecentItemsOk()
  } catch (e: unknown) {
    reportRecentItemsWarning(e, 'save')
  }
}

export function canonicalPath(p: string): string {
  try {
    return fs.realpathSync(p)
  } catch {
    return path.resolve(p)
  }
}

export function openFileFromPath(filePath: string): OpenedFile {
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) {
    throw Object.assign(new Error('Target is not a file'), { code: 'NOT_TEXT' as ErrorCode })
  }

  const canonical = canonicalPath(filePath)

  if (ctx.workspaceRoot) {
    const relativePath = resolveAbsolutePath(ctx.workspaceRoot, filePath)
    if (relativePath) {
      const opened = readFile(ctx.workspaceRoot, relativePath)
      const parent = relativePath.includes('/')
        ? relativePath.split('/').slice(0, -1).join('/')
        : '.'
      ctx.workspaceState?.watchDir(parent)
      return { ...opened, canonicalPath: canonical }
    }
  }

  const buffer = fs.readFileSync(filePath)

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    throw Object.assign(new Error('File is not valid UTF-8 text'), {
      code: 'NOT_TEXT' as ErrorCode
    })
  }

  return {
    path: null,
    name: path.basename(filePath),
    content: buffer.toString('utf-8'),
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    canonicalPath: canonical
  }
}

/** Path resolution helper re-exported for the handler modules. */
export { resolveWithinRoot }

/** Directory-entry type re-exported for the handler modules. */
export type { DirEntry }

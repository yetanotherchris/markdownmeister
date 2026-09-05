import { ipcMain } from 'electron'
import { searchContents } from '../../fs/search'
import type { Result, SearchContentResult } from '../../../shared/ipc-contract'
import {
  ctx,
  ok,
  err,
  ensureString,
  validateShape,
  sanitizeError,
  toAppError,
  isAuthorizedRenderer
} from './context'

const MAX_TERM_LENGTH = 200

export function registerSearchHandlers(window: Electron.BrowserWindow, _ctx: typeof ctx): void {
  ipcMain.handle(
    'workspace:searchContents',
    async (event, args: unknown): Promise<Result<SearchContentResult[]>> => {
      if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
      try {
        validateShape(args, ['term'])
        ensureString((args as { term: unknown }).term, 'term')
        const term = (args as { term: string }).term
        if (term.length > MAX_TERM_LENGTH) {
          return err('IO', 'Search term is too long')
        }
        if (!ctx.workspaceRoot) {
          return err('NO_WORKSPACE', 'No workspace is open')
        }
        // The term is a plain search string and is never used as a path; the
        // scan walks from the validated workspace root and never follows
        // symlinks, so no user input can escape the workspace.
        const matches = await searchContents(ctx.workspaceRoot, term)
        return ok(matches)
      } catch (e: unknown) {
        const appErr = toAppError(e)
        return err(appErr.code, sanitizeError(e, ctx.workspaceRoot))
      }
    }
  )
}

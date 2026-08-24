import { BrowserWindow, ipcMain } from 'electron'
import type { Result } from '../../../shared/ipc-contract'
import { err, ok, ctx, isAuthorizedRenderer, validateShape } from './context'

export function registerAppHandlers(window: BrowserWindow, _ctx: typeof ctx): void {
  setupWindowCloseHandler(window)

  ipcMain.handle('app:requestQuit', (event): Result<null> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    window.close()
    return ok(null)
  })

  ipcMain.handle('quit:respond', (event, args: unknown): Result<null> => {
    if (!isAuthorizedRenderer(event, window)) return err('IO', 'Unauthorized renderer')
    try {
      validateShape(args, ['decision'])
    } catch {
      return err('IO', 'Invalid quit response')
    }
    const decision = (args as { decision: unknown }).decision
    if (decision !== 'quit' && decision !== 'cancel') {
      return err('IO', 'Invalid quit decision')
    }
    if (!ctx.quitRequestPending) {
      return err('IO', 'No quit request is pending')
    }
    ctx.quitRequestPending = false
    if (decision === 'quit') tryCloseWindow(window)
    return ok(null)
  })
}

function tryCloseWindow(window: BrowserWindow): void {
  ctx.allowClose = true
  window.close()
}

function setupWindowCloseHandler(window: BrowserWindow): void {
  window.on('close', (e) => {
    if (ctx.allowClose) return
    ctx.quitRequestPending = true
    e.preventDefault()
    window.webContents.send('app:quitRequested')
  })
}

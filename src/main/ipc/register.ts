import { BrowserWindow, ipcMain } from 'electron'
import { ctx } from './handlers/context'
import { registerAppHandlers } from './handlers/app'
import { registerFileHandlers } from './handlers/files'
import { registerWorkspaceHandlers } from './handlers/workspace'
import { registerDialogHandlers } from './handlers/dialogs'
import { registerSettingsHandlers } from './handlers/settings'
import { registerThemesHandlers } from './handlers/themes'
import { registerRecentHandlers } from './handlers/recent'
import { registerSpellcheckHandlers } from './handlers/spellcheck'
import { registerBuildHandlers } from './handlers/build'
import { registerSearchHandlers } from './handlers/search'

export function registerIpcHandlers(window: BrowserWindow, approvedRendererUrl: string): void {
  // Electron keeps handlers process-wide while macOS can recreate windows.
  // Remove the previous registrations before binding the current window so no
  // command closes over a destroyed BrowserWindow.
  for (const channel of [
    'app:requestQuit',
    'quit:respond',
    'file:openDialog',
    'file:read',
    'file:write',
    'file:saveDialog',
    'entry:create',
    'entry:move',
    'entry:trash',
    'entry:describe',
    'entry:reveal',
    'workspace:prepareFolderOpen',
    'workspace:commitFolderOpen',
    'workspace:cancelFolderOpen',
    'workspace:readDir',
    'workspace:searchContents',
    'dialog:show',
    'settings:get',
    'settings:update',
    'themes:list',
    'recent:list',
    'recent:clear',
    'recent:openFile',
    'spellcheck:getWords',
    'spellcheck:addWord',
    'build:getInfo',
    'build:openRepository'
  ]) {
    ipcMain.removeHandler(channel)
  }
  ctx.allowClose = false
  ctx.quitRequestPending = false
  ctx.approvedRendererUrl = approvedRendererUrl
  // app first, it owns the window-close handler and the allowClose flag.
  registerAppHandlers(window, ctx)
  registerFileHandlers(window, ctx)
  registerWorkspaceHandlers(window, ctx)
  registerSearchHandlers(window, ctx)
  registerDialogHandlers(window, ctx)
  registerSettingsHandlers(window, ctx)
  registerThemesHandlers(window, ctx)
  registerRecentHandlers(window, ctx)
  registerSpellcheckHandlers(window, ctx)
  registerBuildHandlers(window, ctx)
}

import { BrowserWindow } from 'electron'
import { scrubAbsolutePaths } from './scrubPaths'


export function reportRecentItemsWarning(e: unknown, action: 'save' | 'clear' = 'save'): void {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!w || w.isDestroyed()) return
  const msg = e instanceof Error ? e.message : 'Unknown error'
  const scrubbed = scrubAbsolutePaths(msg)
  w.webContents.send('recentItems:warning', {
    message: `Recent Items could not be ${action === 'save' ? 'saved' : 'cleared'}: ${scrubbed}`
  })
}

/** A recent-items persistence write succeeded, the renderer clears its
 *  previous warning note so it does not linger after the cause has resolved. */
export function notifyRecentItemsOk(): void {
  const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!w || w.isDestroyed()) return
  w.webContents.send('recentItems:ok')
}

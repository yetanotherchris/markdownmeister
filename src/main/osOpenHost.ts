import { app, BrowserWindow, ipcMain } from 'electron'
import { classifyOsTarget, extractTargetFromArgv } from './osOpen'
import { openFileFromPath, sanitizeError, recordRecent, ctx } from './ipc/handlers/context'
import { prepareFolderFromOsPath } from './ipc/handlers/workspace'



type PendingOpen =
  | { kind: 'file'; absPath: string }
  | { kind: 'folder'; absPath: string }
  | { kind: 'failed'; message: string }

let currentWindow: BrowserWindow | null = null
let rendererReady = false
let draining = false
const queue: PendingOpen[] = []

function enqueueTarget(rawPath: unknown): void {
  const classified = classifyOsTarget(rawPath)
  if (!classified.ok) {
    queue.push({ kind: 'failed', message: classified.message })
  } else {
    queue.push(classified.target)
  }
  drain()
}

function drain(): void {
  if (!rendererReady || !currentWindow || draining) return
  draining = true
  try {
    while (queue.length > 0) {
      const item = queue.shift() as PendingOpen
      if (item.kind === 'failed') {
        currentWindow.webContents.send('os:openFailed', { message: item.message })
        continue
      }
      if (item.kind === 'file') {
        try {
          const opened = openFileFromPath(item.absPath)
          recordRecent(opened.canonicalPath ?? item.absPath, 'file', opened.name)
          currentWindow.webContents.send('os:fileOpen', opened)
        } catch (e: unknown) {
          currentWindow.webContents.send('os:openFailed', {
            message: sanitizeError(e, ctx.workspaceRoot)
          })
        }
        continue
      }
      const prepared = prepareFolderFromOsPath(item.absPath)
      if (!prepared.ok) {
        currentWindow.webContents.send('os:openFailed', { message: prepared.message })
      } else if (prepared.value) {
        currentWindow.webContents.send('os:folderOpen', prepared.value)
      }
    }
  } finally {
    draining = false
  }
}

function focusPrimaryWindow(): void {
  const win = currentWindow
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}


export function initOsOpenHost(): boolean {
  const singleInstanceEnabled = process.env.MM_SINGLE_INSTANCE !== '0'
  if (singleInstanceEnabled) {
    const gotLock = app.requestSingleInstanceLock()
    if (!gotLock) {
      app.quit()
      return false
    }
    app.on('second-instance', (_event, argv) => {
      focusPrimaryWindow()
      const target = extractTargetFromArgv(argv)
      if (target) enqueueTarget(target)
    })
  }

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    enqueueTarget(filePath)
  })

  ipcMain.on('os:ready', (event) => {
    if (!currentWindow || event.sender !== currentWindow.webContents) return
    rendererReady = true
    drain()
  })

  // First-launch open (Windows argv; also macOS CLI): the OS selected a file
  // or folder before the app ran at all.
  const firstLaunchTarget = extractTargetFromArgv(process.argv)
  if (firstLaunchTarget) enqueueTarget(firstLaunchTarget)
  return true
}

/** Bind the live window (called after `createWindow`; on macOS re-created
 *  windows re-bind). A fresh window has no renderer listeners yet, so the drain
 *  is disarmed until that renderer sends `os:ready`. */
export function setOsOpenWindow(window: BrowserWindow): void {
  currentWindow = window
  rendererReady = false
  drain()
}


export function clearOsOpenWindow(): void {
  currentWindow = null
  rendererReady = false
}

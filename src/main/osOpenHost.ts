import { app, BrowserWindow, ipcMain } from 'electron'
import { classifyOsTarget, extractTargetFromArgv } from './osOpen'
import { openFileFromPath, sanitizeError, recordRecent, ctx } from './ipc/handlers/context'
import { prepareFolderFromOsPath } from './ipc/handlers/workspace'

/**
 * Spec 006 OS-open host (Electron wiring only, the classification rules live
 * in the pure `osOpen.ts` module).
 *
 * Windows passes the selected item as an `argv` positional (first launch and
 * `second-instance`); macOS delivers it via the `open-file` event, which can
 * fire BEFORE `ready`. Every path is classified in main (Principle II), then
 * routed:
 *
 * - file    → `openFileFromPath` → `os:fileOpen` (existing single-file open)
 * - folder  → `prepareFolderFromOsPath` → `os:folderOpen` (existing confirm→commit)
 * - failure → `os:openFailed` with a scrubbed message (FR-011, session unchanged)
 *
 * Requests that arrive before the renderer is live are queued and drained when
 * it signals `os:ready`. A burst is serialized (FR-014: one item per invocation).
 */

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
          // Mirror the File → Open dialog (spec 004 FR-002): a successfully
          // opened file is a recent file. Best-effort (FR-011).
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

/** Called once before `app.whenReady()` (research R7/R1). Returns `false` when
 *  the single-instance lock is held elsewhere and this process must exit. */
export function initOsOpenHost(): boolean {
  const singleInstanceEnabled = process.env.MM_SINGLE_INSTANCE !== '0'
  if (singleInstanceEnabled) {
    const gotLock = app.requestSingleInstanceLock()
    if (!gotLock) {
      // Another instance holds the lock, its `second-instance` handler will
      // receive our argv (FR-008). Quit immediately.
      app.quit()
      return false
    }
    app.on('second-instance', (_event, argv) => {
      focusPrimaryWindow()
      const target = extractTargetFromArgv(argv)
      if (target) enqueueTarget(target)
    })
  }

  // macOS Finder opens can fire before `ready` (research R1), register early.
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    enqueueTarget(filePath)
  })

  // Gated like every IPC entry point (review finding 2026-08-09): only the
  // bound window's own renderer may arm the drain, so a compromised page cannot
  // force early drains (dropped opens / a stuck pending-folder slot).
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

/** Clear the bound window (called when the window closes). macOS keeps the
 *  process alive after the last window closes, so a later OS open must not
 *  target a destroyed webContents (review finding 2026-08-09). */
export function clearOsOpenWindow(): void {
  currentWindow = null
  rendererReady = false
}

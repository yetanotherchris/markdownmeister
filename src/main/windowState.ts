import { screen } from 'electron'
import type { BrowserWindow } from 'electron'
import { recentItemsConfigPath } from './recentItemsPath'
import {
  loadWindowStateFile,
  snapshotToState,
  writeWindowStateFile
} from './windowStateFile'
import type { WindowState } from './windowStateFile'
import { resolveLaunchState } from './windowStateFit'
import type { Rect } from './windowStateFit'



function windowStatePath(): string {
  return recentItemsConfigPath()
}

function workAreas(): Rect[] {
  return screen.getAllDisplays().map((d) => d.workArea)
}


export function loadWindowState(): WindowState | null {
  return loadWindowStateFile(windowStatePath())
}

/** Launch bounds + maximized flag, clamped to the available displays. */
export function resolveLaunchBounds(): { bounds: Rect; isMaximized: boolean } {
  return resolveLaunchState(loadWindowState(), workAreas())
}


let pendingState: WindowState | null = null

let writeTimer: ReturnType<typeof setTimeout> | null = null

function writeState(state: WindowState): void {
  try {
    writeWindowStateFile(windowStatePath(), state)
  } catch {
  }
}

/**
 * Debounced persist (SC-002: within 1 s of a change completing). The window
 * emits many move/resize events per drag; a write per event would thrash the
 * disk and risk overlapping atomic writes.
 */
function scheduleWrite(state: WindowState): void {
  pendingState = state
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    if (pendingState) {
      const toWrite = pendingState
      pendingState = null
      writeState(toWrite)
    }
  }, 500)
}


export function flushWindowState(): void {
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  if (pendingState) {
    const state = pendingState
    pendingState = null
    writeState(state)
  }
}


function capture(win: BrowserWindow): void {
  const state = snapshotToState({
    bounds: win.getNormalBounds(),
    isMaximized: win.isMaximized(),
    isMinimized: win.isMinimized()
  })
  if (state) scheduleWrite(state)
}


export function trackWindowState(win: BrowserWindow): void {
  win.on('move', () => capture(win))
  win.on('resize', () => capture(win))
  win.on('maximize', () => capture(win))
  win.on('unmaximize', () => capture(win))
  win.on('close', () => flushWindowState())
}

import type { WindowState } from './windowStateFile'



export interface Rect {
  x: number
  y: number
  width: number
  height: number
}


export const DEFAULT_WINDOW = { width: 1200, height: 800 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function displayContainsCenter(display: Rect, bounds: Rect): boolean {
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  return cx >= display.x && cx <= display.x + display.width &&
    cy >= display.y && cy <= display.y + display.height
}


export function fitWindowToDisplays(bounds: Rect, displays: Rect[]): Rect {
  // Skip zero-area work-areas (a disabled display can still be listed): fitting
  // to one would produce a degenerate 0×0 window.
  const usable = displays.filter((d) => d.width > 0 && d.height > 0)
  if (usable.length === 0) return bounds
  const target = usable.find((d) => displayContainsCenter(d, bounds)) ?? usable[0]
  const width = Math.min(bounds.width, target.width)
  const height = Math.min(bounds.height, target.height)
  const x = clamp(bounds.x, target.x, target.x + target.width - width)
  const y = clamp(bounds.y, target.y, target.y + target.height - height)
  return { x, y, width, height }
}


export function centerIn(display: Rect): Rect {
  const width = Math.min(DEFAULT_WINDOW.width, display.width)
  const height = Math.min(DEFAULT_WINDOW.height, display.height)
  return {
    x: display.x + Math.round((display.width - width) / 2),
    y: display.y + Math.round((display.height - height) / 2),
    width,
    height
  }
}

/** Resolve the launch bounds + maximized flag from the saved state. */
export function resolveLaunchState(
  saved: WindowState | null,
  displays: Rect[]
): { bounds: Rect; isMaximized: boolean } {
  const usable = displays.filter((d) => d.width > 0 && d.height > 0)
  if (!saved) {
    const primary = usable[0]
    return {
      bounds: primary ? centerIn(primary) : { x: 0, y: 0, ...DEFAULT_WINDOW },
      isMaximized: false
    }
  }
  if (usable.length === 0) {
    return { bounds: { x: 0, y: 0, ...DEFAULT_WINDOW }, isMaximized: saved.isMaximized }
  }
  return { bounds: fitWindowToDisplays(saved, usable), isMaximized: saved.isMaximized }
}

import * as fs from 'fs'
import * as path from 'path'
import { readConfigFile } from './settingsFile'
import { atomicWrite } from './fs/atomicWrite'



export interface WindowState {
  x: number
  y: number
  width: number
  height: number
  isMaximized: boolean
}


export interface WindowSnapshot {
  bounds: { x: number; y: number; width: number; height: number }
  isMaximized: boolean
  isMinimized: boolean
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function validateWindowState(raw: unknown): WindowState | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Record<string, unknown>
  const x = isFiniteNumber(parsed.x) ? parsed.x : null
  const y = isFiniteNumber(parsed.y) ? parsed.y : null
  const width = isFiniteNumber(parsed.width) && parsed.width > 0 ? parsed.width : null
  const height = isFiniteNumber(parsed.height) && parsed.height > 0 ? parsed.height : null
  if (x === null || y === null || width === null || height === null) return null
  return {
    x,
    y,
    width,
    height,
    isMaximized: typeof parsed.isMaximized === 'boolean' ? parsed.isMaximized : false
  }
}

export function loadWindowStateFile(filePath: string): WindowState | null {
  return validateWindowState(readConfigFile(filePath).windowState)
}


export function snapshotToState(snapshot: WindowSnapshot): WindowState | null {
  if (snapshot.isMinimized) return null
  const { x, y, width, height } = snapshot.bounds
  return { x, y, width, height, isMaximized: snapshot.isMaximized }
}


export function writeWindowStateFile(filePath: string, state: WindowState): void {
  const current = readConfigFile(filePath)
  const updated = { ...current, windowState: state }
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  atomicWrite(filePath, JSON.stringify(updated, null, 2), 0o600)
}

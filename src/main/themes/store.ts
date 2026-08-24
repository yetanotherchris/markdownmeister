import * as fs from 'fs'
import * as path from 'path'
import type { EditorColors } from '../../shared/ipc-contract'
import {
  DEFAULT_EDITOR_THEME_FILES,
  DEFAULT_EDITOR_THEME_STEMS
} from '../../shared/editorThemeTokens'
import { atomicWrite } from '../fs/atomicWrite'
import { MAX_THEME_FILE_BYTES, parseThemeFile, themeStemOf } from './validate'



/** A theme delivered to the renderer (contracts/preload.md). */
export interface DiscoveredTheme {
  name: string
  typeface: string
  light: EditorColors
  dark: EditorColors
}

export interface DiscoveryOutcome {
  themes: DiscoveredTheme[]

  invalidNames: string[]
}

function themeFilePath(dir: string, stem: string): string {
  return path.join(dir, `${stem}.json`)
}


export function ensureThemesDirectory(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}


export function seedMissingDefaultThemes(dir: string): void {
  for (const stem of DEFAULT_EDITOR_THEME_STEMS) {
    const filePath = themeFilePath(dir, stem)
    if (fs.existsSync(filePath)) continue
    const contents = JSON.stringify(DEFAULT_EDITOR_THEME_FILES[stem], null, 2)
    atomicWrite(filePath, `${contents}\n`)
  }
}

/** Code-unit ordering so listing order is deterministic on every machine. */
function byName(a: { name: string }, b: { name: string }): number {
  if (a.name < b.name) return -1
  if (a.name > b.name) return 1
  return 0
}


export function resolveCaseCollisions(
  candidates: {
    fileName: string
    stem: string
  }[]
): { winners: { fileName: string; stem: string }[]; losers: string[] } {
  const winners: { fileName: string; stem: string }[] = []
  const losers: string[] = []
  const seen = new Map<string, { fileName: string; stem: string }>()
  for (const candidate of [...candidates].sort(byFileName)) {
    const key = candidate.stem.toLowerCase()
    const existing = seen.get(key)
    if (existing === undefined) {
      seen.set(key, candidate)
      winners.push(candidate)
    } else {
      losers.push(candidate.fileName)
    }
  }
  return { winners, losers }
}

/** Discover every valid theme directly inside `dir` (plan D4, data-model
 *  §Validation rules). Per-file failures exclude the file and are reported in
 *  `invalidNames`; a failing directory read throws to the caller. */
export function listThemes(dir: string): DiscoveryOutcome {
  const dirents = fs.readdirSync(dir, { withFileTypes: true })
  const invalidNames: string[] = []
  const candidates: { fileName: string; stem: string }[] = []
  for (const entry of dirents) {
    if (!entry.isFile()) {
      if (entry.isSymbolicLink() && entry.name.toLowerCase().endsWith('.json')) {
        invalidNames.push(entry.name)
      }
      continue
    }
    const stem = themeStemOf(entry.name)
    if (stem === null) continue
    candidates.push({ fileName: entry.name, stem })
  }

  const { winners, losers } = resolveCaseCollisions(candidates)
  invalidNames.push(...losers)

  const themes: DiscoveredTheme[] = []
  for (const winner of winners.values()) {
    const filePath = path.join(dir, winner.fileName)
    if (!readableRegularFile(filePath)) {
      invalidNames.push(winner.fileName)
      continue
    }
    let text: string
    try {
      text = fs.readFileSync(filePath, 'utf-8')
    } catch {
      invalidNames.push(winner.fileName)
      continue
    }
    const parsed = parseThemeFile(text)
    if (!parsed.ok) {
      invalidNames.push(winner.fileName)
      continue
    }
    themes.push({ name: winner.stem, ...parsed.theme })
  }

  return { themes: themes.sort(byName), invalidNames }
}

function byFileName(a: { fileName: string }, b: { fileName: string }): number {
  if (a.fileName < b.fileName) return -1
  if (a.fileName > b.fileName) return 1
  return 0
}

function readableRegularFile(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath)
    return stats.isFile() && stats.size <= MAX_THEME_FILE_BYTES
  } catch {
    return false
  }
}

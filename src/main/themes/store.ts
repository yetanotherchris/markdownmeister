import * as fs from 'fs'
import * as path from 'path'
import type { EditorColors } from '../../shared/ipc-contract'
import {
  DEFAULT_EDITOR_THEME_FILES,
  DEFAULT_EDITOR_THEME_STEMS
} from '../../shared/editorThemeTokens'
import { atomicWrite } from '../fs/atomicWrite'
import { MAX_THEME_FILE_BYTES, parseThemeFile, themeStemOf } from './validate'

/**
 * Spec 036 (plan D3/D4): the themes-directory lifecycle, ensure it exists,
 * seed ONLY missing default files (never rewrite an existing file, FR-007),
 * and discover/validate every candidate. All functions take the directory
 * explicitly so the module stays electron-free and unit-testable; callers
 * resolve it via themes/path.ts.
 */

/** A theme delivered to the renderer (contracts/preload.md). */
export interface DiscoveredTheme {
  name: string
  typeface: string
  light: EditorColors
  dark: EditorColors
}

export interface DiscoveryOutcome {
  themes: DiscoveredTheme[]
  /** Quiet indications only (FR-010): rejected file names, malformed
   *  content, oversized, unreadable, case-collision losers, and links that
   *  were not followed. Never surfaced modally. */
  invalidNames: string[]
}

function themeFilePath(dir: string, stem: string): string {
  return path.join(dir, `${stem}.json`)
}

/** Create the themes folder when missing; never fails silently (the caller
 *  decides policy). Idempotent. */
export function ensureThemesDirectory(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

/** Seed any MISSING default theme file with its embedded contents verbatim
 *  (plan D3). An existing file is never read, compared, or rewritten. */
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

/** Case-insensitive duplicate stems collapse deterministically (research E9):
 *  sort candidates ascending by file name (code-unit order), keep the first
 *  entry per lowercased stem as the winner, and report every later duplicate
 *  as a loser. Pure so the rule is testable on case-insensitive filesystems,
 *  where both files cannot exist at once. */
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
    // Only regular files qualify, symlinks/reparse points are never followed
    // (FR-011); a link named *.json is reported quietly, plain subdirectories
    // and non-JSON entries are invisible per spec Assumptions.
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

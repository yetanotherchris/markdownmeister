import * as fs from 'fs'
import * as path from 'path'
import { atomicWrite } from './fs/atomicWrite'


export function loadSpellcheckWords(filePath: string): string[] {
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return []
  }
  if (!raw || typeof raw !== 'object') return []
  const arr = (raw as { spellcheckDictionary?: unknown }).spellcheckDictionary
  if (!Array.isArray(arr)) return []
  return arr.filter((w): w is string => typeof w === 'string' && w.length > 0)
}


export function addSpellcheckWord(filePath: string, word: string): string[] {
  const normalized = word.trim().toLowerCase()
  let existing: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (parsed && typeof parsed === 'object') existing = parsed as Record<string, unknown>
  } catch {
    // Missing or corrupt config, start fresh.
  }
  const current = Array.isArray(existing.spellcheckDictionary) ? existing.spellcheckDictionary : []
  const next = normalized && !current.includes(normalized) ? [...current, normalized] : current
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  atomicWrite(filePath, JSON.stringify({ ...existing, spellcheckDictionary: next }, null, 2), 0o600)
  return next
}

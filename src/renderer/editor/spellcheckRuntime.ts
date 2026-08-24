import type NSpell from 'nspell'
import type { SpellcheckLanguage } from '../../shared/ipc-contract'
import { getChecker } from '../domain/spellcheck'


export interface SpellcheckRuntime {
  enabled: boolean
  language: SpellcheckLanguage | null
  customWords: Set<string>
  version: number
  checker: NSpell
}

export const spellcheckRuntime: SpellcheckRuntime = {
  enabled: true,
  language: null,
  customWords: new Set(),
  version: 0,
  checker: getChecker(null)
}


const listeners = new Set<() => void>()

/** Subscribe to runtime changes; returns an unsubscribe function. */
export function onSpellcheckRuntimeChange(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

/** Apply a settings/custom-word change and notify every editor to re-check. */
export function updateSpellcheckRuntime(
  patch: Partial<Pick<SpellcheckRuntime, 'enabled' | 'language' | 'customWords'>>
): void {
  if (patch.enabled !== undefined) spellcheckRuntime.enabled = patch.enabled
  if (patch.language !== undefined) {
    spellcheckRuntime.language = patch.language
    spellcheckRuntime.checker = getChecker(patch.language)
  }
  if (patch.customWords !== undefined) spellcheckRuntime.customWords = patch.customWords
  spellcheckRuntime.version += 1
  for (const callback of listeners) callback()
}

import { session } from 'electron'
import type { SpellcheckLanguage } from '../shared/ipc-contract'

/**
 * The language list the OS/Electron chose before the app overrode it. Captured
 * lazily on the first apply so the "System default" setting can restore it
 * after a user has picked an explicit language.
 */
let systemLanguages: string[] | null = null


export function applySpellcheckSetting(enabled: boolean, language: SpellcheckLanguage | null): void {
  const sess = session.defaultSession
  if (systemLanguages === null) {
    systemLanguages = sess.getSpellCheckerLanguages()
  }
  sess.setSpellCheckerLanguages(language ? [language] : systemLanguages)
  sess.setSpellCheckerEnabled(enabled)
}

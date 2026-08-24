import nspell from 'nspell'
import type NSpell from 'nspell'
import type { SpellcheckLanguage } from '../../shared/ipc-contract'
import enGbAff from '../assets/dictionaries/en-gb.aff?raw'
import enGbDic from '../assets/dictionaries/en-gb.dic?raw'
import enUsAff from '../assets/dictionaries/en-us.aff?raw'
import enUsDic from '../assets/dictionaries/en-us.dic?raw'
import supplementalWordsRaw from '../assets/dictionaries/supplemental-words.txt?raw'



export interface Misspelling {
  /** Start offset in the checked text (0-based). */
  start: number
  /** End offset (exclusive). */
  end: number
  /** The word as it appears in the text. */
  word: string
}

const DICTIONARIES: Record<SpellcheckLanguage, NSpell> = {
  'en-GB': nspell(enGbAff, enGbDic),
  'en-US': nspell(enUsAff, enUsDic)
}


export const SUPPLEMENTAL_WORDS: ReadonlySet<string> = new Set(
  supplementalWordsRaw
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((word) => word.length > 0)
)

/** Map the persisted setting (`null` = system default) to a concrete language. */
export function resolveLanguage(language: SpellcheckLanguage | null): SpellcheckLanguage {
  if (language) return language
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  return nav.toLowerCase().startsWith('en-us') ? 'en-US' : 'en-GB'
}


export function getChecker(language: SpellcheckLanguage | null): NSpell {
  return DICTIONARIES[resolveLanguage(language)]
}


const WORD_RE = /[\p{L}'’]+/gu


export function findMisspellings(
  text: string,
  checker: NSpell,
  customWords: ReadonlySet<string>
): Misspelling[] {
  const result: Misspelling[] = []
  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0]
    const start = match.index as number
    if (start > 0 && /\d/.test(text[start - 1])) continue
    const lower = word.toLowerCase()
    if (customWords.has(lower) || SUPPLEMENTAL_WORDS.has(lower)) continue
    if (checker.correct(word)) continue
    result.push({ start, end: start + word.length, word })
  }
  return result
}

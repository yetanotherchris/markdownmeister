

export type SpellcheckMenuAction =
  | {
      kind: 'suggestion'
      /** The menu label: the suggestion text. */
      label: string
      /** The flagged word (from the context-menu params). */
      word: string
      /** The correction to apply. */
      suggestion: string
    }
  | {
      kind: 'add-to-dictionary'
      /** The menu label: `Add "<word>" to Dictionary`. */
      label: string
      /** The flagged word (from the context-menu params). */
      word: string
    }


export const MAX_SUGGESTIONS = 5


export function spellcheckMenuActions(params: {
  misspelledWord: string
  dictionarySuggestions: string[]
}): SpellcheckMenuAction[] {
  const { misspelledWord, dictionarySuggestions } = params
  if (!misspelledWord) return []

  const suggestions = [...new Set(dictionarySuggestions)].filter((s) => s.length > 0)

  const actions: SpellcheckMenuAction[] = suggestions
    .slice(0, MAX_SUGGESTIONS)
    .map((suggestion) => ({
      kind: 'suggestion' as const,
      label: suggestion,
      word: misspelledWord,
      suggestion
    }))

  actions.push({
    kind: 'add-to-dictionary',
    label: `Add "${misspelledWord}" to Dictionary`,
    word: misspelledWord
  })

  return actions
}

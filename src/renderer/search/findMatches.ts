export interface TextRun {
  /** The run's text. Runs inside one block are adjacent in the document. */
  text: string
  /** Document position of the run's first character. */
  from: number
}

/** One searchable block: the concatenated text of a single text block
 *  (paragraph, heading, table cell, one side of a hard break). */
export interface SearchBlock {
  runs: TextRun[]
}

export interface SearchMatch {
  from: number
  to: number
}

/** Joins concatenated block texts in the plugin's haystack. It cannot occur
 *  in document text or in a typeable query, so a match can never span the
 *  gap between two blocks. */
const SEPARATOR = '\u0000'

/** Case-folds for search while preserving UTF-16 length, so folded offsets
 *  still map onto the original text. `String.prototype.toLowerCase` can
 *  expand a character (U+0130 folds to two units); such characters keep
 *  their original casing and simply do not match case-insensitively. */
export function foldCase(text: string): string {
  const lowered = text.toLowerCase()
  if (lowered.length === text.length) return lowered
  let out = ''
  for (const ch of text) {
    const folded = ch.toLowerCase()
    out += folded.length === ch.length ? folded : ch
  }
  return out
}

/** Document position of the character at `offset` in the block's
 *  concatenated text, or null when the offset is the end boundary. */
function positionAt(runs: TextRun[], offset: number): number | null {
  let base = 0
  for (const run of runs) {
    if (offset < base + run.text.length) return run.from + (offset - base)
    base += run.text.length
  }
  return null
}

/** Finds every case-insensitive literal occurrence of `query` in `blocks`.
 *  Matches within a block may span inline formatting boundaries; matches
 *  never span block boundaries. Empty and whitespace-only queries match
 *  nothing. Pure: it never throws and never mutates its inputs. */
export function findMatches(query: string, blocks: SearchBlock[]): SearchMatch[] {
  if (query.trim() === '' || query.includes(SEPARATOR)) return []
  const needle = foldCase(query)
  const matches: SearchMatch[] = []

  for (const block of blocks) {
    const haystack = foldCase(block.runs.map((run) => run.text).join(''))
    const total = haystack.length
    let at = haystack.indexOf(needle)
    while (at !== -1) {
      const end = at + needle.length
      const from = positionAt(block.runs, at)
      const to = end < total ? positionAt(block.runs, end) : endOfBlock(block.runs)
      if (from !== null && to !== null) matches.push({ from, to })
      at = haystack.indexOf(needle, at + 1)
    }
  }
  return matches
}

function endOfBlock(runs: TextRun[]): number | null {
  const last = runs[runs.length - 1]
  return last ? last.from + last.text.length : null
}

import { describe, it, expect } from 'vitest'
import { findMatches, foldCase, type SearchBlock } from '../../../src/renderer/search/findMatches'

function block(...runs: Array<{ text: string; from: number }>): SearchBlock {
  return { runs }
}

function text(from: number, text: string): { text: string; from: number } {
  return { text, from }
}

describe('findMatches (spec 055 FR-002/010/011)', () => {
  it('finds literal matches case-insensitively and reports document positions', () => {
    const blocks = [block(text(10, 'Hello World'), text(23, 'hello again'))]
    expect(findMatches('hello', blocks)).toEqual([
      { from: 10, to: 15 },
      { from: 23, to: 28 }
    ])
  })

  it('matches a phrase crossing inline formatting boundaries inside one block', () => {
    // "bold " ends the first run, "end" starts the next (mark boundary).
    const blocks = [block(text(5, 'to the bold '), text(18, 'end of it'))]
    expect(findMatches('bold end', blocks)).toEqual([{ from: 12, to: 21 }])
  })

  it('never matches across block boundaries', () => {
    const blocks = [block(text(0, 'heading in')), block(text(12, 'time flies'))]
    expect(findMatches('in time', blocks)).toEqual([])
  })

  it('matches punctuation and symbols literally', () => {
    const blocks = [block(text(0, 'a (b) [c] *d* e'))]
    expect(findMatches('(b) [c]', blocks)).toEqual([{ from: 2, to: 9 }])
    expect(findMatches('*d*', blocks)).toEqual([{ from: 10, to: 13 }])
    expect(findMatches('*d**', blocks)).toEqual([])
  })

  it('does not treat the query as a pattern', () => {
    const blocks = [block(text(0, 'aaa aaa')), block(text(9, 'a1b a*b aXb'))]
    expect(findMatches('a.b', blocks)).toEqual([])
    expect(findMatches('a*', blocks)).toEqual([{ from: 13, to: 15 }])
  })

  it('returns nothing for empty and whitespace-only queries', () => {
    const blocks = [block(text(0, 'words here'))]
    expect(findMatches('', blocks)).toEqual([])
    expect(findMatches('   ', blocks)).toEqual([])
    expect(findMatches('\t\n', blocks)).toEqual([])
  })

  it('ignores queries containing the block separator sentinel', () => {
    const blocks = [block(text(0, 'one')), block(text(5, 'two'))]
    expect(findMatches('e\u0000t', blocks)).toEqual([])
  })

  it('finds repeated and overlapping matches', () => {
    expect(findMatches('aa', [block(text(0, 'aaa'))])).toEqual([
      { from: 0, to: 2 },
      { from: 1, to: 3 }
    ])
    expect(findMatches('aba', [block(text(0, 'abababa'))])).toEqual([
      { from: 0, to: 3 },
      { from: 2, to: 5 },
      { from: 4, to: 7 }
    ])
  })

  it('returns matches in document order across blocks', () => {
    const blocks = [block(text(3, 'x hit x')), block(text(20, 'HIT')), block(text(30, 'h i t'))]
    expect(findMatches('hit', blocks).map((m) => m.from)).toEqual([5, 20])
  })

  it('maps positions through multi-run blocks so spans cross run boundaries', () => {
    // Three runs in one block; the query starts in the first and ends in the last.
    const blocks = [block(text(0, 'pre'), text(3, '·'), text(4, 'post'))]
    expect(findMatches('pre·post', blocks)).toEqual([{ from: 0, to: 8 }])
  })

  it('round-trips offsets: the matched text reconstructs the query case-insensitively', () => {
    const blocks = [
      block(text(0, 'The '), text(4, 'Quick'), text(9, ' Brown'), text(15, ' FOX')),
      block(text(30, 'brown bread'))
    ]
    const matches = findMatches('brown fox', blocks)
    expect(matches.length).toBeGreaterThan(0)
    for (const match of matches) {
      const stitched = blocks
        .flatMap((b) => b.runs.map((r) => ({ ...r, to: r.from + r.text.length })))
        .filter((r) => r.to > match.from && r.from < match.to)
        .map((r) => r.text.slice(Math.max(0, match.from - r.from), match.to - r.from))
        .join('')
      expect(stitched.toLowerCase()).toBe('brown fox')
    }
  })

  it('handles astral characters without shifting positions', () => {
    const blocks = [block(text(0, 'a𝐀b A𝐀B'))]
    expect(findMatches('a𝐀b', blocks)).toEqual([
      { from: 0, to: 4 },
      { from: 5, to: 9 }
    ])
  })

  it('never throws on degenerate inputs', () => {
    expect(() => findMatches('x', [])).not.toThrow()
    expect(() => findMatches('x', [{ runs: [] }])).not.toThrow()
    expect(() => findMatches('x', [block(text(0, ''))])).not.toThrow()
    expect(findMatches('x', [{ runs: [] }])).toEqual([])
  })

  it('searches a 10,000-line document well inside the imperceptibility budget (FR-012)', () => {
    const paragraph = 'The quick brown fox jumps over the lazy dog near the river bank. '
    const runs: Array<{ text: string; from: number }> = []
    let pos = 0
    const blocks: SearchBlock[] = []
    for (let i = 0; i < 10_000; i++) {
      runs.push(text(pos, `${paragraph} line ${i}`))
      pos += paragraph.length + ` line ${i}`.length
      if (runs.length === 4) {
        blocks.push({ runs: [...runs] })
        runs.length = 0
      }
    }
    if (runs.length) blocks.push({ runs })

    const started = performance.now()
    const matches = findMatches('quick brown', blocks)
    const elapsed = performance.now() - started
    expect(matches.length).toBe(10_000)
    expect(elapsed).toBeLessThan(100)
  })
})

describe('foldCase (spec 055 FR-010)', () => {
  it('folds ASCII case without changing length', () => {
    expect(foldCase('Hello WORLD 123')).toBe('hello world 123')
  })

  it('preserves length for characters whose lowercase expands', () => {
    // U+0130 (İ) lowercases to two code units in JS; the fold must keep one.
    const folded = foldCase('\u0130x')
    expect(folded.length).toBe(2)
  })
})

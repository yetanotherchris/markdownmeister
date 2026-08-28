import { describe, it, expect } from 'vitest'
import {
  buildBlockTable,
  topLevelBlockIndex,
  planSourceSeed,
  planVisualRestore,
  planReturnRestore
} from '../../../src/renderer/domain/caretSync'

const FRONTMATTER_DOC = [
  '---',
  'title: sample',
  '---',
  '',
  '# Heading',
  '',
  'First paragraph line one',
  'continued line two.',
  '',
  '- item one',
  '- item two',
  '',
  '> quote text',
  '',
  '```js',
  'const a = 1',
  '```',
  ''
].join('\n')

const FRONTMATTER_LENGTH = '---\ntitle: sample\n---\n'.length

describe('buildBlockTable', () => {
  it('spans one entry per top-level block with frontmatter length carried separately', () => {
    const table = buildBlockTable(FRONTMATTER_DOC)
    expect(table).not.toBeNull()
    expect(table!.frontmatterLength).toBe(FRONTMATTER_LENGTH)
    expect(table!.blocks).toHaveLength(5)
  })

  it('reports body-relative character offsets for each block', () => {
    const table = buildBlockTable(FRONTMATTER_DOC)!
    const body = FRONTMATTER_DOC.slice(FRONTMATTER_LENGTH)
    const headings = body.indexOf('# Heading')
    const list = body.indexOf('- item one')
    const code = body.indexOf('```js')
    expect(table.blocks[0].startOffset).toBe(headings)
    expect(table.blocks[2].startOffset).toBe(list)
    expect(table.blocks[4].startOffset).toBe(code)
    expect(table.blocks[4].endOffset).toBe(body.indexOf('```', code + 3) + 3)
  })

  it('maps a document without frontmatter to frontmatterLength zero', () => {
    const table = buildBlockTable('# Solo\n\ntext')
    expect(table).not.toBeNull()
    expect(table!.frontmatterLength).toBe(0)
    expect(table!.blocks).toHaveLength(2)
  })

  it('returns an empty block list for a frontmatter-only document', () => {
    const table = buildBlockTable('---\ntitle: x\n---\n')
    expect(table).not.toBeNull()
    expect(table!.blocks).toHaveLength(0)
  })

  it('treats an unterminated frontmatter fence as body text', () => {
    const table = buildBlockTable('---\nnot frontmatter\n')
    expect(table).not.toBeNull()
    expect(table!.frontmatterLength).toBe(0)
  })
})

describe('topLevelBlockIndex', () => {
  const sizes = [5, 7, 3]

  it('places the caret inside a block by cumulative size', () => {
    expect(topLevelBlockIndex(sizes, 0)).toBe(0)
    expect(topLevelBlockIndex(sizes, 4)).toBe(0)
    expect(topLevelBlockIndex(sizes, 6)).toBe(1)
    expect(topLevelBlockIndex(sizes, 12)).toBe(2)
  })

  it('assigns a boundary offset to the block that starts there', () => {
    expect(topLevelBlockIndex(sizes, 5)).toBe(1)
    expect(topLevelBlockIndex(sizes, 12)).toBe(2)
  })

  it('clamps an offset past the document end to the last block', () => {
    expect(topLevelBlockIndex(sizes, 100)).toBe(2)
  })

  it('returns null when there are no blocks', () => {
    expect(topLevelBlockIndex([], 0)).toBeNull()
  })
})

describe('planSourceSeed', () => {
  const sizesFor = (count: number) => Array.from({ length: count }, () => 10)

  it('seeds the source caret at the first line of the caret block', () => {
    const table = buildBlockTable(FRONTMATTER_DOC)!
    const paragraphStart = FRONTMATTER_LENGTH + table.blocks[1].startOffset
    // The caret offset is a ProseMirror position, unrelated to text offsets;
    // the sizes only decide which block index it lands in.
    const seed = planSourceSeed({
      displayedText: FRONTMATTER_DOC,
      childSizes: [10, 200, 10, 10, 10],
      caretOffset: 50
    })
    expect(seed).toEqual({
      anchor: paragraphStart,
      head: paragraphStart,
      reveal: true,
      textLength: FRONTMATTER_DOC.length
    })
  })

  it('places a caret at the document start on the first body block, past the frontmatter', () => {
    const seed = planSourceSeed({
      displayedText: FRONTMATTER_DOC,
      childSizes: sizesFor(5),
      caretOffset: 0
    })
    expect(seed).not.toBeNull()
    expect(FRONTMATTER_DOC.slice(seed!.anchor)).toMatch(/^# Heading/)
    expect(seed!.anchor).toBeGreaterThanOrEqual(FRONTMATTER_LENGTH)
  })

  it('returns null when the visual child count does not correlate', () => {
    expect(
      planSourceSeed({ displayedText: FRONTMATTER_DOC, childSizes: sizesFor(3), caretOffset: 0 })
    ).toBeNull()
  })

  it('returns null when the visual document has no blocks', () => {
    expect(
      planSourceSeed({ displayedText: FRONTMATTER_DOC, childSizes: [], caretOffset: 0 })
    ).toBeNull()
  })

  it('returns null for a body with no blocks rather than entering the frontmatter', () => {
    expect(
      planSourceSeed({
        displayedText: '---\ntitle: x\n---\n',
        childSizes: [4],
        caretOffset: 0
      })
    ).toBeNull()
  })
})

describe('planVisualRestore', () => {
  const restoreFor = (offset: number) =>
    planVisualRestore({ displayedText: FRONTMATTER_DOC, caretOffset: offset })

  const blockStart = (index: number) =>
    FRONTMATTER_LENGTH + buildBlockTable(FRONTMATTER_DOC)!.blocks[index].startOffset

  it('maps a frontmatter caret to the start of the body', () => {
    expect(restoreFor(0)).toEqual({ blockIndex: 0, blockCount: 5 })
    expect(restoreFor(FRONTMATTER_LENGTH - 1)).toEqual({ blockIndex: 0, blockCount: 5 })
  })

  it('maps a caret inside a block to that block', () => {
    expect(restoreFor(blockStart(1) + 5)).toEqual({ blockIndex: 1, blockCount: 5 })
    expect(restoreFor(blockStart(4) + 2)).toEqual({ blockIndex: 4, blockCount: 5 })
  })

  it('maps a caret on a blank separator line to the nearer block, ties to the following', () => {
    const table = buildBlockTable(FRONTMATTER_DOC)!
    const listEnd = FRONTMATTER_LENGTH + table.blocks[2].endOffset
    const quoteStart = FRONTMATTER_LENGTH + table.blocks[3].startOffset
    expect(quoteStart - listEnd).toBe(2)
    expect(restoreFor(listEnd + 1)).toEqual({ blockIndex: 3, blockCount: 5 })
    expect(restoreFor(listEnd)).toEqual({ blockIndex: 2, blockCount: 5 })
  })

  it('maps a caret in trailing blank lines to the last block', () => {
    expect(restoreFor(FRONTMATTER_DOC.length)).toEqual({ blockIndex: 4, blockCount: 5 })
  })

  it('returns null when the body has no blocks', () => {
    expect(planVisualRestore({ displayedText: '---\ntitle: x\n---\n', caretOffset: 0 })).toBeNull()
    expect(planVisualRestore({ displayedText: '', caretOffset: 0 })).toBeNull()
  })
})

describe('planReturnRestore', () => {
  const base = {
    displayedText: FRONTMATTER_DOC,
    finalAnchor: 40,
    finalHead: 40
  }
  const seed = { anchor: 40, head: 40, reveal: true, textLength: FRONTMATTER_DOC.length }

  it('restores exactly when the source caret is untouched and nothing was edited', () => {
    expect(planReturnRestore({ ...base, seed, edited: false })).toBeNull()
    expect(planReturnRestore({ ...base, seed: null, edited: false })).toBeNull()
  })

  it('maps when the source caret moved, even without an edit', () => {
    const plan = planReturnRestore({ ...base, seed, edited: false, finalHead: 60 })
    expect(plan).toEqual({ blockIndex: 1, blockCount: 5 })
  })

  it('maps when the source session edited, even with an unchanged caret', () => {
    const plan = planReturnRestore({ ...base, seed, edited: true })
    expect(plan).toEqual({ blockIndex: 1, blockCount: 5 })
  })

  it('maps when a source session without a seed edited the document', () => {
    const plan = planReturnRestore({ ...base, seed: null, edited: true })
    expect(plan).toEqual({ blockIndex: 1, blockCount: 5 })
  })

  it('clamps a caret offset outside the text instead of failing', () => {
    const plan = planReturnRestore({
      ...base,
      seed,
      edited: false,
      finalHead: FRONTMATTER_DOC.length + 500
    })
    expect(plan).toEqual({ blockIndex: 4, blockCount: 5 })
  })

  it('degrades to null when the displayed text has no mappable blocks', () => {
    expect(
      planReturnRestore({
        displayedText: '---\ntitle: x\n---\n',
        seed,
        edited: true,
        finalAnchor: 0,
        finalHead: 0
      })
    ).toBeNull()
  })
})

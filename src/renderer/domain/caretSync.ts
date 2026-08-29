import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { splitFrontmatter } from './frontmatter'

/** Body-relative character span of one top-level content block. */
export interface BlockSpan {
  startOffset: number
  endOffset: number
}

/** The correspondence between the displayed source text and its top-level
 *  content blocks, derived at switch time and never persisted. The
 *  frontmatter is excluded from the parse and carried as a length so body
 *  offsets shift into displayed-text offsets by one addition. */
export interface BlockTable {
  frontmatterLength: number
  blocks: BlockSpan[]
}

/** A caret seed for the source view: the mapped offsets plus whether the
 *  destination should reveal the caret instead of applying a stored scroll.
 *  `textLength` is the displayed text's length at entry; the return path
 *  compares it against the current length to tell a source edit from the
 *  editor's own normalization of unchanged bytes. */
export interface SourceSeed {
  anchor: number
  head: number
  reveal: boolean
  textLength: number
}

/** A mapped visual-side restore: which top-level block of the visual
 *  document should receive the caret, and how many blocks the correlated
 *  parse produced for the count check at restore time. */
export interface VisualRestorePlan {
  blockIndex: number
  blockCount: number
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

/** CodeMirror normalizes CR line endings when the source view creates its
 *  document, so every character offset the mapping exchanges with the editor
 *  lives in LF-normalized space; mdast positions would otherwise count the
 *  CR bytes and drift one character per line. */
export function normalizeCaretText(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

export function buildBlockTable(displayedText: string): BlockTable | null {
  const { frontmatter, body } = splitFrontmatter(normalizeCaretText(displayedText))
  let root: ReturnType<typeof parser.parse>
  try {
    root = parser.parse(body)
  } catch {
    return null
  }
  const blocks: BlockSpan[] = []
  for (const child of root.children) {
    const position = child.position
    if (!position || position.start.offset === undefined || position.end.offset === undefined) {
      return null
    }
    blocks.push({ startOffset: position.start.offset, endOffset: position.end.offset })
  }
  return { frontmatterLength: frontmatter.length, blocks }
}

/** The index of the top-level block containing a ProseMirror caret offset,
 *  from the document's top-level child sizes. A boundary offset belongs to
 *  the block that starts there; an offset past the end resolves to the last
 *  block. Returns null when the document has no blocks. */
export function topLevelBlockIndex(childSizes: number[], caretOffset: number): number | null {
  if (childSizes.length === 0 || caretOffset < 0) return null
  let index = 0
  let start = 0
  for (let i = 0; i < childSizes.length; i++) {
    if (start > caretOffset) break
    index = i
    start += childSizes[i]
  }
  return index
}

/** Seed the source caret from the visual caret. The origin caret resolves to
 *  a top-level block index in the visual document; the same index in the
 *  parsed displayed text gives the line to open on. Milkdown keeps a trailing
 *  empty paragraph after a document whose last block is a list, table, code
 *  block, or quote; remark-parse does not produce it, so when the caller
 *  reports that artifact and the counts differ by exactly it, the trailing
 *  child is dropped to bring the two structures into step. Any other
 *  mismatch means the structures cannot be correlated, and the seed is
 *  refused so the caller falls back to the stored context. */
export function planSourceSeed(params: {
  displayedText: string
  childSizes: number[]
  caretOffset: number
  trailingEmptyParagraph?: boolean
}): SourceSeed | null {
  const { displayedText, childSizes, caretOffset, trailingEmptyParagraph = false } = params
  const table = buildBlockTable(displayedText)
  if (!table) return null
  const effectiveSizes =
    trailingEmptyParagraph && childSizes.length === table.blocks.length + 1
      ? childSizes.slice(0, -1)
      : childSizes
  if (table.blocks.length !== effectiveSizes.length) return null
  const index = topLevelBlockIndex(effectiveSizes, caretOffset)
  if (index === null) return null
  const anchor = Math.min(
    table.frontmatterLength + table.blocks[index].startOffset,
    displayedText.length
  )
  return {
    anchor,
    head: anchor,
    reveal: true,
    textLength: normalizeCaretText(displayedText).length
  }
}

/** Map a displayed-text caret offset back to a visual-side content block.
 *  Frontmatter and leading positions clamp to the first block, trailing
 *  positions to the last, and a blank separator line to the nearer block
 *  with ties going to the block that follows. Returns null when there is
 *  nothing to map to. */
export function planVisualRestore(params: {
  displayedText: string
  caretOffset: number
}): VisualRestorePlan | null {
  const { caretOffset } = params
  const text = normalizeCaretText(params.displayedText)
  const table = buildBlockTable(text)
  if (!table || table.blocks.length === 0) return null
  const { blocks } = table
  const offset = Math.min(Math.max(caretOffset, 0), text.length) - table.frontmatterLength
  if (offset <= blocks[0].startOffset) return { blockIndex: 0, blockCount: blocks.length }
  const last = blocks.length - 1
  if (offset >= blocks[last].endOffset) return { blockIndex: last, blockCount: blocks.length }
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]
    if (offset <= block.endOffset) return { blockIndex: index, blockCount: blocks.length }
    const next = blocks[index + 1]
    if (offset < next.startOffset) {
      const before = offset - block.endOffset
      const after = next.startOffset - offset
      return { blockIndex: after <= before ? index + 1 : index, blockCount: blocks.length }
    }
  }
  return { blockIndex: last, blockCount: blocks.length }
}

/** Decide the visual-side restore on the return path. An untouched source
 *  caret (selection identical to the entry seed) with no edit restores
 *  exactly, so a null plan here means the caller keeps today's stored
 *  context behaviour. A moved caret or an edited source session maps the
 *  final caret position through the displayed text instead. */
export function planReturnRestore(params: {
  seed: SourceSeed | null
  finalAnchor: number
  finalHead: number
  edited: boolean
  displayedText: string
}): VisualRestorePlan | null {
  const { seed, finalAnchor, finalHead, edited, displayedText } = params
  if (!edited) {
    if (!seed) return null
    if (seed.anchor === finalAnchor && seed.head === finalHead) return null
  }
  return planVisualRestore({ displayedText, caretOffset: finalHead })
}

import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { gfmStrikethroughFromMarkdown, gfmStrikethroughToMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmTable } from 'micromark-extension-gfm-table'
import { gfmTableFromMarkdown, gfmTableToMarkdown } from 'mdast-util-gfm-table'
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item'
import { gfmTaskListItemFromMarkdown, gfmTaskListItemToMarkdown } from 'mdast-util-gfm-task-list-item'
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal'
import { gfmAutolinkLiteralFromMarkdown, gfmAutolinkLiteralToMarkdown } from 'mdast-util-gfm-autolink-literal'
import { gfmFootnote } from 'micromark-extension-gfm-footnote'
import { gfmFootnoteFromMarkdown, gfmFootnoteToMarkdown } from 'mdast-util-gfm-footnote'
import { math } from 'micromark-extension-math'
import { mathFromMarkdown, mathToMarkdown } from 'mdast-util-math'
import { visit } from 'unist-util-visit'
import type { Node } from 'unist'

/**
 * Spec 030 (research R1/R2): the six configurable markdown syntax options are
 * PARSING/SERIALIZATION concerns, not Milkdown `CrepeFeature`s. `remark-gfm`
 * exposes no per-syntax off-switch, so a single custom remark plugin composes
 * the *individual* GFM/math extensions conditionally through `this.data()` —
 * a disabled syntax's tokenizer is simply never registered, so its delimiters
 * stay literal text (FR-014). Footnote is not one of the six options and stays
 * enabled always. Hard breaks reuse Milkdown's `hardbreak` node: a small
 * transform flips single-newline `break` nodes to `isInline:false` (research
 * R2). The schema is never touched, so the undo stack stays valid (R3).
 */

export interface MarkdownSyntaxOptions {
  hardBreaks: boolean
  strikethrough: boolean
  tables: boolean
  taskLists: boolean
  math: boolean
  autolink: boolean
}

/** FR-013: hard breaks off (CommonMark soft breaks), the five syntaxes on. */
export const DEFAULT_MARKDOWN_SYNTAX_OPTIONS: MarkdownSyntaxOptions = {
  hardBreaks: false,
  strikethrough: true,
  tables: true,
  taskLists: true,
  math: true,
  autolink: true
}

/** The remark-processor `data()` buckets our composer pushes extensions into. */
interface SyntaxData {
  micromarkExtensions?: unknown[]
  fromMarkdownExtensions?: unknown[]
  toMarkdownExtensions?: unknown[]
}

interface BreakNode {
  type: string
  data?: { isInline?: boolean }
}

/**
 * A unified plugin that registers only the enabled syntax extensions. Applied
 * via `processor.use(markdownSyntaxRemark(options))`; returns a hard-break
 * transformer when `hardBreaks` is on (runs after the stock `remarkLineBreak`,
 * which is registered by the commonmark preset before this composer).
 */
export function markdownSyntaxRemark(options: MarkdownSyntaxOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function remarkSyntax(this: any): ((tree: Node) => void) | void {
    const data = this.data() as SyntaxData
    const micromarkExtensions = data.micromarkExtensions ?? (data.micromarkExtensions = [])
    const fromMarkdownExtensions = data.fromMarkdownExtensions ?? (data.fromMarkdownExtensions = [])
    const toMarkdownExtensions = data.toMarkdownExtensions ?? (data.toMarkdownExtensions = [])

    if (options.strikethrough) {
      micromarkExtensions.push(gfmStrikethrough())
      fromMarkdownExtensions.push(gfmStrikethroughFromMarkdown())
      toMarkdownExtensions.push(gfmStrikethroughToMarkdown())
    }
    if (options.tables) {
      micromarkExtensions.push(gfmTable())
      fromMarkdownExtensions.push(gfmTableFromMarkdown())
      toMarkdownExtensions.push(gfmTableToMarkdown())
    }
    if (options.taskLists) {
      micromarkExtensions.push(gfmTaskListItem())
      fromMarkdownExtensions.push(gfmTaskListItemFromMarkdown())
      toMarkdownExtensions.push(gfmTaskListItemToMarkdown())
    }
    if (options.autolink) {
      micromarkExtensions.push(gfmAutolinkLiteral())
      fromMarkdownExtensions.push(gfmAutolinkLiteralFromMarkdown())
      toMarkdownExtensions.push(gfmAutolinkLiteralToMarkdown())
    }
    // Footnote is out of scope (not one of the six options) and always enabled.
    micromarkExtensions.push(gfmFootnote())
    fromMarkdownExtensions.push(gfmFootnoteFromMarkdown())
    toMarkdownExtensions.push(gfmFootnoteToMarkdown())
    if (options.math) {
      micromarkExtensions.push(math())
      fromMarkdownExtensions.push(mathFromMarkdown())
      toMarkdownExtensions.push(mathToMarkdown())
    }

    if (!options.hardBreaks) return undefined

    // research R2: flip single-newline breaks (created by the stock
    // remarkLineBreak as `isInline:true`) to hard breaks (`isInline:false`).
    return (tree: Node) => {
      visit(tree, 'break', (node) => {
        const breakNode = node as BreakNode
        breakNode.data = { ...(breakNode.data ?? {}), isInline: false }
      })
    }
  }
}

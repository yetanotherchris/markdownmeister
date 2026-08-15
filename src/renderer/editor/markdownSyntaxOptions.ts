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
import type { Processor } from 'unified'
import type { Node } from 'unist'
import { MARKDOWN_SYNTAX_DEFAULTS } from '../../shared/markdownSyntaxDefaults'

/**
 * Spec 030 (research R1/R2): the six configurable markdown syntax options are
 * PARSING/SERIALIZATION concerns, not Milkdown `CrepeFeature`s. `remark-gfm`
 * exposes no per-syntax off-switch, so a single custom remark plugin composes
 * the *individual* GFM/math extensions conditionally through `this.data()`.
 * Footnote is not one of the six options and stays enabled always. Hard breaks
 * reuse Milkdown's `hardbreak` node: a small transform flips single-newline
 * `break` nodes to `isInline:false` (research R2). The schema is never touched,
 * so the undo stack stays valid (R3).
 *
 * Serialization (the `*ToMarkdown` extensions) is ALWAYS enabled for every
 * syntax. A disabled syntax's TOKENIZER (micromark) and `*FromMarkdown`
 * extension are not registered, so its delimiters stay literal text (FR-014) —
 * but a node/mark of that syntax may still exist in the document (created
 * before the toggle, or pasted). Serializing such a doc requires the matching
 * `*ToMarkdown` extension, otherwise `remark-stringify` throws
 * "Cannot handle unknown node" and the save fails. Gating only the parse side
 * keeps that guarantee (2026-08-15 review fix).
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
export const DEFAULT_MARKDOWN_SYNTAX_OPTIONS: MarkdownSyntaxOptions = { ...MARKDOWN_SYNTAX_DEFAULTS }

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
 * A unified plugin that composes the syntax extensions. The `*ToMarkdown`
 * extensions are always registered (a disabled syntax's nodes may still exist
 * in the doc and must serialize); the tokenizer (`micromarkExtensions`) and
 * `*FromMarkdown` extensions are registered only when the option is on, so a
 * disabled syntax's delimiters stay literal text (FR-014). Applied via
 * `processor.use(markdownSyntaxRemark(options))`; returns a hard-break
 * transformer when `hardBreaks` is on (runs after the stock `remarkLineBreak`,
 * which is registered by the commonmark preset before this composer).
 */
export function markdownSyntaxRemark(options: MarkdownSyntaxOptions) {
  return function remarkSyntax(this: Processor): ((tree: Node) => void) | void {
    const data = this.data() as SyntaxData
    const micromarkExtensions = data.micromarkExtensions ?? (data.micromarkExtensions = [])
    const fromMarkdownExtensions = data.fromMarkdownExtensions ?? (data.fromMarkdownExtensions = [])
    const toMarkdownExtensions = data.toMarkdownExtensions ?? (data.toMarkdownExtensions = [])

    // Serialization is always enabled so a doc holding a disabled syntax's
    // node/mark still serializes (the save path must never throw).
    toMarkdownExtensions.push(
      gfmStrikethroughToMarkdown(),
      gfmTableToMarkdown(),
      gfmTaskListItemToMarkdown(),
      gfmAutolinkLiteralToMarkdown(),
      gfmFootnoteToMarkdown(),
      mathToMarkdown()
    )
    if (options.strikethrough) {
      micromarkExtensions.push(gfmStrikethrough())
      fromMarkdownExtensions.push(gfmStrikethroughFromMarkdown())
    }
    if (options.tables) {
      micromarkExtensions.push(gfmTable())
      fromMarkdownExtensions.push(gfmTableFromMarkdown())
    }
    if (options.taskLists) {
      micromarkExtensions.push(gfmTaskListItem())
      fromMarkdownExtensions.push(gfmTaskListItemFromMarkdown())
    }
    if (options.autolink) {
      micromarkExtensions.push(gfmAutolinkLiteral())
      fromMarkdownExtensions.push(gfmAutolinkLiteralFromMarkdown())
    }
    // Footnote is out of scope (not one of the six options) and always enabled.
    micromarkExtensions.push(gfmFootnote())
    fromMarkdownExtensions.push(gfmFootnoteFromMarkdown())
    if (options.math) {
      micromarkExtensions.push(math())
      fromMarkdownExtensions.push(mathFromMarkdown())
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

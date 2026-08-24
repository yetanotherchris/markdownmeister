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



export interface MarkdownSyntaxOptions {
  hardBreaks: boolean
  strikethrough: boolean
  tables: boolean
  taskLists: boolean
  math: boolean
  autolink: boolean
}


export const DEFAULT_MARKDOWN_SYNTAX_OPTIONS: MarkdownSyntaxOptions = { ...MARKDOWN_SYNTAX_DEFAULTS }


export function markdownSyntaxOptionsEqual(
  a: MarkdownSyntaxOptions,
  b: MarkdownSyntaxOptions
): boolean {
  return (
    a.hardBreaks === b.hardBreaks &&
    a.strikethrough === b.strikethrough &&
    a.tables === b.tables &&
    a.taskLists === b.taskLists &&
    a.math === b.math &&
    a.autolink === b.autolink
  )
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


export function markdownSyntaxRemark(options: MarkdownSyntaxOptions) {
  return function remarkSyntax(this: Processor): ((tree: Node) => void) | void {
    const data = this.data() as SyntaxData
    const micromarkExtensions = data.micromarkExtensions ?? (data.micromarkExtensions = [])
    const fromMarkdownExtensions = data.fromMarkdownExtensions ?? (data.fromMarkdownExtensions = [])
    const toMarkdownExtensions = data.toMarkdownExtensions ?? (data.toMarkdownExtensions = [])

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
    micromarkExtensions.push(gfmFootnote())
    fromMarkdownExtensions.push(gfmFootnoteFromMarkdown())
    if (options.math) {
      micromarkExtensions.push(math())
      fromMarkdownExtensions.push(mathFromMarkdown())
    }

    if (!options.hardBreaks) return undefined

    return (tree: Node) => {
      visit(tree, 'break', (node) => {
        const breakNode = node as BreakNode
        breakNode.data = { ...(breakNode.data ?? {}), isInline: false }
      })
    }
  }
}

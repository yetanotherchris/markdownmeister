import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import remarkGFM from 'remark-gfm'
import remarkMath from 'remark-math'
import {
  editorViewCtx,
  parserCtx,
  remarkCtx,
  remarkPluginsCtx,
  remarkStringifyOptionsCtx,
  schemaCtx,
  serializerCtx
} from '@milkdown/kit/core'
import { ParserState, SerializerState } from '@milkdown/kit/transformer'
import { replaceAll } from '@milkdown/kit/utils'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { Ctx } from '@milkdown/kit/ctx'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Crepe } from '@milkdown/crepe'
import type { InstancePool } from './instancePool'
import {
  markdownSyntaxRemark,
  markdownSyntaxOptionsEqual,
  DEFAULT_MARKDOWN_SYNTAX_OPTIONS,
  type MarkdownSyntaxOptions
} from './markdownSyntaxOptions'
import { setMarkdownSyntaxGateOptions } from './markdownSyntaxInputRules'
import { recordParse } from './openPerformance'



/** Suppress the re-parse emission (mirrors the source-view lock in CrepeHost). */
let suppressUntil = 0

export function isReconfigureSuppressed(): boolean {
  return Date.now() < suppressUntil
}

interface CursorSnapshot {
  offset: number
  scrollTop: number
}

function scrollElement(view: EditorView): HTMLElement | null {
  const el = view.dom.closest('.editor-host') ?? view.dom.parentElement
  return el instanceof HTMLElement ? el : null
}

function captureCursor(view: EditorView): CursorSnapshot {
  return {
    offset: view.state.selection.anchor,
    scrollTop: scrollElement(view)?.scrollTop ?? 0
  }
}

function restoreCursor(view: EditorView, snapshot: CursorSnapshot): void {
  const pos = Math.min(snapshot.offset, view.state.doc.content.size)
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
  if (snapshot.scrollTop > 0) {
    const el = scrollElement(view)
    if (el) el.scrollTop = snapshot.scrollTop
  }
}


const EXCLUDED_REMARK_PLUGINS = new Set(['remarkGfm', 'remarkMath'])

function isExcludedRemarkPlugin(plugin: unknown): boolean {
  return plugin === remarkGFM || plugin === remarkMath || (typeof plugin === 'function' && EXCLUDED_REMARK_PLUGINS.has(plugin.name))
}

function buildRemarkProcessor(ctx: Ctx, options: MarkdownSyntaxOptions) {
  const processor = unified().use(remarkParse).use(remarkStringify, ctx.get(remarkStringifyOptionsCtx))
  for (const p of ctx.get(remarkPluginsCtx)) {
    if (isExcludedRemarkPlugin(p.plugin)) continue
    processor.use(p.plugin, p.options)
  }
  return processor.use(markdownSyntaxRemark(options))
}


const appliedOptions = new WeakMap<Crepe, MarkdownSyntaxOptions>()


export function reconfigureEditor(
  editor: Crepe,
  options: MarkdownSyntaxOptions,
  params: { sourceMarkdown?: string; suppressEmission?: boolean } = {}
): void {
  const { sourceMarkdown, suppressEmission = true } = params
  setMarkdownSyntaxGateOptions(options)
  if (markdownSyntaxOptionsEqual(appliedOptions.get(editor) ?? DEFAULT_MARKDOWN_SYNTAX_OPTIONS, options)) {
    return
  }
  // Capture BEFORE the serializer swap so a `~~x~~` still serializes to `~~x~~`.
  // `sourceMarkdown` is the raw on-disk/initial content for the CREATE path,
  // where `getMarkdown()` would already have emitted an autolink URL as
  // `<url>` (the default link handler renders url === text as a bare angle-
  // bracketed link), which a re-parse could not undo.
  const markdown = sourceMarkdown ?? editor.getMarkdown()
  const view = editor.editor.action((ctx) => ctx.get(editorViewCtx))
  const cursor = captureCursor(view)

  editor.editor.action((ctx) => {
    const schema = ctx.get(schemaCtx)
    const remark = buildRemarkProcessor(ctx, options)
    ctx.set(remarkCtx, remark)
    ctx.set(parserCtx, ParserState.create(schema, remark))
    ctx.set(serializerCtx, SerializerState.create(schema, remark))
  })

  if (suppressEmission) suppressUntil = Date.now() + 300
  recordParse()
  editor.editor.action(replaceAll(markdown))

  restoreCursor(view, cursor)
  appliedOptions.set(editor, options)
}


export function reconfigureAll(pool: InstancePool, options: MarkdownSyntaxOptions): void {
  pool.forEach((editor) => reconfigureEditor(editor, options, { suppressEmission: true }))
}


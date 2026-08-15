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
import { markdownSyntaxRemark, type MarkdownSyntaxOptions } from './markdownSyntaxOptions'

/**
 * Spec 030 (research R3/R6): runtime reconfiguration of every live editor's
 * remark pipeline. A settings toggle rebuilds each editor's `remarkCtx` +
 * parser/serializer slices in place (the schema is untouched, so the undo stack
 * stays valid), captures `getMarkdown()` BEFORE the serializer swap so disabled
 * syntax still serializes its delimiters correctly, then re-parses via
 * Milkdown's `replaceAll` (an ordinary, undoable transaction). The re-parse's
 * `markdownUpdated` emission is suppressed for a short window so the store's
 * content/baseline/dirty and any in-flight save's revision guard are untouched.
 */

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
  return (view.dom.closest('.editor-host') ?? view.dom.parentElement) as HTMLElement | null
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

/**
 * Build the remark processor for `options`: the stock base (remark-parse +
 * remark-stringify with Milkdown's stringify options) plus every registered
 * remark plugin EXCEPT `remark-gfm` and `remark-math` (which our conditional
 * composer subsumes — research R1), then the composer itself. The footnote
 * syntax (bundled inside remark-gfm) is re-added unconditionally by the
 * composer. The latex feature's math-block transform stays (it is a no-op when
 * no math node exists).
 */
function buildRemarkProcessor(ctx: Ctx, options: MarkdownSyntaxOptions) {
  const processor = unified().use(remarkParse).use(remarkStringify, ctx.get(remarkStringifyOptionsCtx))
  for (const p of ctx.get(remarkPluginsCtx)) {
    if (p.plugin === remarkGFM || p.plugin === remarkMath) continue
    processor.use(p.plugin, p.options)
  }
  return processor.use(markdownSyntaxRemark(options))
}

/** Reconfigure a single live editor in place (research R3). */
export function reconfigureEditor(
  editor: Crepe,
  options: MarkdownSyntaxOptions,
  sourceMarkdown?: string,
  suppressEmission = true
): void {
  // Capture BEFORE the serializer swap so a `~~x~~` still serializes to `~~x~~`.
  // `sourceMarkdown` is the raw on-disk/initial content for the CREATE path,
  // where `getMarkdown()` would already have normalized an autolink into
  // `[url](url)` (explicit link syntax) that the new parser could not undo.
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

  // The re-parse fires markdownUpdated (200 ms debounce); on a RUNTIME toggle
  // drop that emission so the store's dirty state / revision guard are
  // untouched (research R3). The CREATE path does not suppress — no user edit
  // can race a just-mounted editor, and suppressing would swallow the first
  // real edit's emission (and thus its dirty flag).
  if (suppressEmission) suppressUntil = Date.now() + 300
  editor.editor.action(replaceAll(markdown))

  restoreCursor(view, cursor)
}

/** Reconfigure every live editor in the pool (multi-tab sync, FR-010). */
export function reconfigureAll(pool: InstancePool, options: MarkdownSyntaxOptions): void {
  pool.forEach((editor) => reconfigureEditor(editor, options, undefined, true))
}


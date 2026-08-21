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

/**
 * Build the remark processor for `options`: the stock base (remark-parse +
 * remark-stringify with Milkdown's stringify options) plus every registered
 * remark plugin EXCEPT `remark-gfm` and `remark-math` (which our conditional
 * composer subsumes — research R1), then the composer itself. The footnote
 * syntax (bundled inside remark-gfm) is re-added unconditionally by the
 * composer. The latex feature's math-block transform stays (it is a no-op when
 * no math node exists).
 *
 * The gfm/math exclusion matches by reference OR by the plugin function's
 * stable `.name`, so it still filters correctly if npm ever resolves two
 * copies of remark-gfm/remark-math (the composer and the ctx would then hold
 * different function identities for the same plugin).
 */
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

/**
 * Spec 033 (research R1, contract C1): the syntax options whose parser/
 * serializer pipeline was actually applied to each editor. Absence means the
 * editor was freshly constructed against Crepe's stock pipeline, i.e.
 * effectively the defaults. Lives and dies with each editor instance
 * (WeakMap semantics), so no explicit cleanup.
 */
const appliedOptions = new WeakMap<Crepe, MarkdownSyntaxOptions>()

/** Reconfigure a single live editor in place (research R3).
 *
 *  Spec 033 skip guard (contract C1): the gate-options update always runs, but
 *  when the requested options equal the options already applied to THIS editor,
 *  the parser/serializer swap and the `replaceAll` re-parse are skipped — a
 *  freshly mounted editor is always considered "at defaults", so the create
 *  path with unchanged settings performs no second full parse and no
 *  mount-time undoable transaction. An off→on toggle round-trip still
 *  reapplies: the comparison is against per-editor applied options, never
 *  bare defaults. */
export function reconfigureEditor(
  editor: Crepe,
  options: MarkdownSyntaxOptions,
  params: { sourceMarkdown?: string; suppressEmission?: boolean } = {}
): void {
  const { sourceMarkdown, suppressEmission = true } = params
  // Point the input-rule gate at the same options so typing a disabled syntax
  // never auto-formats (research R4, contract "Input-rule gate"). Unconditional:
  // gating must reflect requested options even when the pipeline skip fires.
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

  // The re-parse fires markdownUpdated (200 ms debounce); on a RUNTIME toggle
  // drop that emission so the store's dirty state / revision guard are
  // untouched (research R3). The CREATE path does not suppress — no user edit
  // can race a just-mounted editor, and suppressing would swallow the first
  // real edit's emission (and thus its dirty flag).
  if (suppressEmission) suppressUntil = Date.now() + 300
  recordParse()
  editor.editor.action(replaceAll(markdown))

  restoreCursor(view, cursor)
  appliedOptions.set(editor, options)
}

/** Reconfigure every live editor in the pool (multi-tab sync, FR-010). */
export function reconfigureAll(pool: InstancePool, options: MarkdownSyntaxOptions): void {
  pool.forEach((editor) => reconfigureEditor(editor, options, { suppressEmission: true }))
}


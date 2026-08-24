import { inputRulesCtx, SchemaReady } from '@milkdown/kit/core'
import { InputRule } from '@milkdown/kit/prose/inputrules'
import type { EditorState, Transaction } from '@milkdown/kit/prose/state'
import type { Ctx, MilkdownPlugin } from '@milkdown/kit/ctx'
import { DEFAULT_MARKDOWN_SYNTAX_OPTIONS, type MarkdownSyntaxOptions } from './markdownSyntaxOptions'

/**
 * Spec 030 (research R4): the syntax-producing ProseMirror `InputRule`s
 * (`~~`, `| col |`, `- [ ]`, `$...$`, `$$...$$`) fire independently of the
 * remark parser, so gating parsing alone would still let typing `~~x~~` wrap a
 * strike mark when strikethrough is disabled. This module replaces each gated
 * rule's handler with a flag-checking wrapper that consults the shared runtime
 * options at INVOKE time, so a settings toggle takes effect on every live
 * editor without re-registering any rule (FR-014, US1 S3).
 *
 * The rules are identified by the regex they were built with (their
 * `match.source`), which is the stable shape Milkdown uses for these rules and
 * what the undo/redo behaviour keys off, see the `$inputRule` composables in
 * `@milkdown/preset-gfm` and the Crepe latex feature. Non-gated rules pass
 * through untouched.
 */

type InputRuleHandler = (
  state: EditorState,
  match: RegExpMatchArray,
  start: number,
  end: number
) => Transaction | null

/**
 * The prosemirror `InputRule` class only declares `inCode`/`inCodeMark`
 * publicly; `match`/`handler`/`undoable` are assigned at construction but not
 * part of the declared shape. The gate needs them, so it types rules through
 * this view of the same object.
 */
type GatedInputRule = InputRule & {
  match: RegExp
  handler: InputRuleHandler
  undoable: boolean
}

/** Which option gates which rule, keyed by the rule's `match.source`. */
const GATED_RULES: ReadonlyArray<{ source: string; option: keyof MarkdownSyntaxOptions }> = [
  { source: /(?<![\w:/])(~{1,2})(.+?)\1(?!\w|\/)/.source, option: 'strikethrough' },
  { source: /^\|(?<col>\d+)[xX](?<row>\d+)\|\s$/.source, option: 'tables' },
  { source: /^\[(?<checked>\s|x)\]\s$/.source, option: 'taskLists' },
  { source: /(?:\$)([^$]+)(?:\$)$/.source, option: 'math' },
  { source: /^\$\$[\s\n]$/.source, option: 'math' }
]

/** Shared runtime options consulted by the wrappers at invoke time (R4). */
let currentOptions: MarkdownSyntaxOptions = { ...DEFAULT_MARKDOWN_SYNTAX_OPTIONS }

/** Point the gate at the current runtime options (called by every reconfigure). */
export function setMarkdownSyntaxGateOptions(options: MarkdownSyntaxOptions): void {
  currentOptions = options
}

function gateKeyFor(rule: GatedInputRule): keyof MarkdownSyntaxOptions | undefined {
  return GATED_RULES.find((gated) => gated.source === rule.match.source)?.option
}

/**
 * Wrap one rule. The handler is mutated in place so the `$inputRule` cleanup
 * (which filters by object identity) still sees the same rule; `customInputRules`
 * reads `rule.handler` per keystroke, so the wrap is picked up immediately.
 */
export function wrapGatedRule(rule: InputRule): InputRule {
  const gated = rule as GatedInputRule
  const option = gateKeyFor(gated)
  if (!option) return rule
  const original = gated.handler
  gated.handler = (state, match, start, end) => {
    if (!currentOptions[option]) return null
    return original(state, match, start, end)
  }
  return rule
}

/**
 * The gate plugin, registered via `crepe.editor.use(...)`. It awaits
 * `SchemaReady` and wraps every rule already pushed into `inputRulesCtx` by the
 * `$inputRule` composables. Registered after those composables (CrepeHost adds
 * it last), its SchemaReady continuation runs after their pushes and before
 * `editorState` reads the slice, so the wrapped list is what reaches
 * ProseMirror's `customInputRules` plugin.
 */
export const markdownSyntaxInputRuleGate: MilkdownPlugin = (ctx: Ctx) => async () => {
  await ctx.wait(SchemaReady)
  ctx.update(inputRulesCtx, (rules) => rules.map(wrapGatedRule))
}

import { describe, it, expect } from 'vitest'
import { InputRule } from '@milkdown/kit/prose/inputrules'
import {
  wrapGatedRule,
  setMarkdownSyntaxGateOptions
} from '../../src/renderer/editor/markdownSyntaxInputRules'
import { DEFAULT_MARKDOWN_SYNTAX_OPTIONS } from '../../src/renderer/editor/markdownSyntaxOptions'

/**
 * Spec 030: the syntax-producing
 * ProseMirror input rules consult `MarkdownSyntaxOptions`; a rule for a
 * disabled syntax returns `null` and does nothing, while enabled syntaxes
 * behave exactly as today.
 */

const GATED_SOURCES = {
  strikethrough: /(?<![\w:/])(~{1,2})(.+?)\1(?!\w|\/)/,
  table: /^\|(?<col>\d+)[xX](?<row>\d+)\|\s$/,
  taskList: /^\[(?<checked>\s|x)\]\s$/,
  mathInline: /(?:\$)([^$]+)(?:\$)$/,
  mathBlock: /^\$\$[\s\n]$/
}

const EMPTY_MATCH = { 0: '', index: 0, input: '', groups: undefined } as unknown as RegExpMatchArray

type WrappedHandler = {
  handler: (s: unknown, m: RegExpMatchArray, a: number, b: number) => unknown
}

function handlerOf(rule: InputRule): WrappedHandler['handler'] {
  return (rule as unknown as WrappedHandler).handler
}

describe('markdownSyntaxInputRuleGate (spec 030 input-rule gate)', () => {
  it('is imported', () => {
    expect(wrapGatedRule).toBeTypeOf('function')
    expect(setMarkdownSyntaxGateOptions).toBeTypeOf('function')
  })

  it('leaves non-gated rules untouched', () => {
    const rule = new InputRule(/^#> $/, () => null)
    expect(wrapGatedRule(rule)).toBe(rule)
  })

  it.each([
    ['strikethrough', GATED_SOURCES.strikethrough, 'strikethrough'],
    ['table', GATED_SOURCES.table, 'tables'],
    ['task list', GATED_SOURCES.taskList, 'taskLists'],
    ['inline math', GATED_SOURCES.mathInline, 'math'],
    ['block math', GATED_SOURCES.mathBlock, 'math']
  ])('%s rule wraps and respects its option', (_name, source, optionKey) => {
    const option = optionKey as keyof typeof DEFAULT_MARKDOWN_SYNTAX_OPTIONS

    // Disabled: handler must return null (no transaction) so the input does
    // nothing (FR-014).
    setMarkdownSyntaxGateOptions({ ...DEFAULT_MARKDOWN_SYNTAX_OPTIONS, [option]: false })
    expect(handlerOf(wrapGatedRule(new InputRule(source, () => null)))(undefined, EMPTY_MATCH, 0, 0)).toBeNull()

    // Enabled: the original handler runs and its return value passes through.
    setMarkdownSyntaxGateOptions({ ...DEFAULT_MARKDOWN_SYNTAX_OPTIONS, [option]: true })
    const stub = { tr: true }
    const enabled = wrapGatedRule(
      new InputRule(source, () => stub as never)
    ) as unknown as WrappedHandler
    expect(enabled.handler(undefined, EMPTY_MATCH, 0, 0)).toBe(stub)
  })

  it('disables exactly one option at a time', () => {
    // tables is off but strikethrough is still on → handler runs (returns the
    // original handler's result, which is null here), not the disabled path.
    setMarkdownSyntaxGateOptions({ ...DEFAULT_MARKDOWN_SYNTAX_OPTIONS, tables: false })
    const wrapped = wrapGatedRule(new InputRule(GATED_SOURCES.strikethrough, () => null))
    expect(handlerOf(wrapped)(undefined, EMPTY_MATCH, 0, 0)).toBeNull()
  })
})

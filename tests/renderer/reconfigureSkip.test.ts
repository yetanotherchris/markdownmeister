import { describe, it, expect, beforeEach } from 'vitest'
import type { Crepe } from '@milkdown/crepe'
import {
  reconfigureEditor,
  isReconfigureSuppressed
} from '../../src/renderer/editor/markdownSyntaxRuntime'
import {
  DEFAULT_MARKDOWN_SYNTAX_OPTIONS,
  type MarkdownSyntaxOptions
} from '../../src/renderer/editor/markdownSyntaxOptions'
import { resetOpenPerformanceCounters } from '../../src/renderer/editor/openPerformance'

/**
 * Spec 033 (contract C1): the reconfigure skip guard. A stub whose
 * `editor.action` throws if the skip path attempts a swap. The e2e suite covers
 * the complete reconfiguration path.
 */

const ALL_OFF: MarkdownSyntaxOptions = {
  hardBreaks: false,
  strikethrough: false,
  tables: false,
  taskLists: false,
  math: false,
  autolink: false
}

/** An editor whose action always throws: any attempted parser/serializer swap
 *  or replaceAll fails loudly, so a silent return proves the skip fired. */
function throwingEditor(): Crepe {
  return {
    getMarkdown: () => {
      throw new Error('getMarkdown must not be called on the skip path')
    },
    editor: {
      action: () => {
        throw new Error('editor.action must not run on the skip path')
      }
    }
  } as unknown as Crepe
}

describe('reconfigureEditor skip guard (spec 033, contract C1)', () => {
  beforeEach(() => {
    resetOpenPerformanceCounters()
  })

  it('a freshly mounted editor with default options skips entirely (no parse #2)', () => {
    const editor = throwingEditor()
    expect(() =>
      reconfigureEditor(editor, { ...DEFAULT_MARKDOWN_SYNTAX_OPTIONS }, { sourceMarkdown: '# x\n' })
    ).not.toThrow()
  })

  it('a freshly mounted editor with non-default options attempts the swap', () => {
    const editor = throwingEditor()
    // suppressEmission:false keeps the module-level suppression window clean
    // for the next assertion.
    expect(() =>
      reconfigureEditor(editor, { ...ALL_OFF }, { sourceMarkdown: '# x\n', suppressEmission: false })
    ).toThrow(/editor\.action/)
  })

  it('the gate-options update runs even when the skip fires', () => {
    // setMarkdownSyntaxGateOptions is module-global state with no direct
    // getter; its observable effect is covered by the input-rule suites. Here
    // we only assert the skip itself is silent about suppression, the skip
    // path must not touch the emission-suppression window either.
    const editor = throwingEditor()
    reconfigureEditor(editor, { ...DEFAULT_MARKDOWN_SYNTAX_OPTIONS })
    expect(isReconfigureSuppressed()).toBe(false)
  })
})

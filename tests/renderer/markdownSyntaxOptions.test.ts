import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { visit } from 'unist-util-visit'
import {
  markdownSyntaxRemark,
  markdownSyntaxOptionsEqual,
  DEFAULT_MARKDOWN_SYNTAX_OPTIONS,
  type MarkdownSyntaxOptions
} from '../../src/renderer/editor/markdownSyntaxOptions'

/**
 * Spec 030 (contract §Verification): the options→extension-composition matrix.
 * Build a remark processor with ONLY our composer and parse representative
 * markdown; an enabled syntax produces its mdast node, a disabled one stays
 * literal text. Footnote (not one of the six options) is always enabled.
 */

function parse(text: string, options: MarkdownSyntaxOptions): MdNode {
  const processor = unified().use(remarkParse).use(remarkStringify).use(markdownSyntaxRemark(options))
  // Milkdown runs `remark.runSync(remark.parse(md), md)`, the transformer stage
  // (where the hard-break flip lives) is `.run()`, not `.parse()`.
  return processor.runSync(processor.parse(text)) as unknown as MdNode
}

interface MdNode {
  type: string
  children?: MdNode[]
  checked?: boolean
  data?: { isInline?: boolean }
  [key: string]: unknown
}

function nodeTypes(tree: MdNode): string[] {
  const types: string[] = []
  const walk = (n: MdNode) => {
    types.push(n.type)
    n.children?.forEach(walk)
  }
  walk(tree)
  return types
}

const ALL_ON: MarkdownSyntaxOptions = { ...DEFAULT_MARKDOWN_SYNTAX_OPTIONS }
const ALL_OFF: MarkdownSyntaxOptions = {
  hardBreaks: false,
  strikethrough: false,
  tables: false,
  taskLists: false,
  math: false,
  autolink: false
}

describe('markdownSyntaxOptionsEqual (spec 033, contract C1)', () => {
  it('is true for two identical option sets', () => {
    expect(markdownSyntaxOptionsEqual(ALL_ON, { ...ALL_ON })).toBe(true)
    expect(markdownSyntaxOptionsEqual(ALL_OFF, { ...ALL_OFF })).toBe(true)
  })

  it('is false when any single field differs', () => {
    for (const field of Object.keys(ALL_ON) as Array<keyof MarkdownSyntaxOptions>) {
      const flipped = { ...ALL_ON, [field]: !ALL_ON[field] }
      expect(markdownSyntaxOptionsEqual(ALL_ON, flipped)).toBe(false)
    }
  })

  it('the off→on round-trip trap: options equal to the defaults still compare equal — the guard must therefore track per-editor applied options, not compare against defaults alone', () => {
    // A user who toggles a syntax off then back on produces options equal to
    // DEFAULTS. Equality itself cannot distinguish "stock pipeline" from
    // "swapped-with-defaults pipeline", which is exactly why the runtime
    // records applied options per editor (research R1 correctness trap).
    const toggledOffThenOn: MarkdownSyntaxOptions = { ...DEFAULT_MARKDOWN_SYNTAX_OPTIONS }
    expect(markdownSyntaxOptionsEqual(DEFAULT_MARKDOWN_SYNTAX_OPTIONS, toggledOffThenOn)).toBe(true)
    expect(markdownSyntaxOptionsEqual(ALL_OFF, DEFAULT_MARKDOWN_SYNTAX_OPTIONS)).toBe(false)
  })
})

describe('markdownSyntaxRemark (spec 030 options→extension matrix)', () => {
  it('strikethrough: enabled parses a delete node, disabled keeps ~~ literal', () => {
    expect(nodeTypes(parse('~~x~~', ALL_ON))).toContain('delete')
    expect(nodeTypes(parse('~~x~~', ALL_OFF))).not.toContain('delete')
  })

  it('tables: enabled parses a table node, disabled keeps pipe lines literal', () => {
    expect(nodeTypes(parse('| a |\n| - |', ALL_ON))).toContain('table')
    expect(nodeTypes(parse('| a |\n| - |', ALL_OFF))).not.toContain('table')
  })

  it('task lists: enabled parses a listItem with checked, disabled is a plain list', () => {
    const on = parse('- [x] done', ALL_ON)
    expect(nodeTypes(on)).toContain('listItem')
    const listItem = on.children?.[0]?.children?.[0] as MdNode
    expect(listItem.checked).toBe(true)

    const off = parse('- [x] done', ALL_OFF)
    expect(nodeTypes(off)).toContain('listItem')
    const offItem = off.children?.[0]?.children?.[0] as MdNode
    expect(offItem.checked ?? null).toBeFalsy()
  })

  it('math: enabled parses inlineMath, disabled keeps $ literal', () => {
    expect(nodeTypes(parse('$x$', ALL_ON))).toContain('inlineMath')
    expect(nodeTypes(parse('$x$', ALL_OFF))).not.toContain('inlineMath')
  })

  it('autolink: enabled links a bare URL, disabled keeps it plain text', () => {
    expect(nodeTypes(parse('https://example.com', ALL_ON))).toContain('link')
    expect(nodeTypes(parse('https://example.com', ALL_OFF))).not.toContain('link')
  })

  it('footnote is always enabled regardless of the other options', () => {
    const text = 'a[^1]\n\n[^1]: note'
    expect(nodeTypes(parse(text, ALL_ON))).toContain('footnoteDefinition')
    expect(nodeTypes(parse(text, ALL_OFF))).toContain('footnoteDefinition')
  })

  it('hard breaks: on flips soft break nodes to isInline:false, off keeps isInline:true', () => {
    // The commonmark preset registers `remarkLineBreak`, which splits single
    // newlines into `break` nodes with `isInline:true` (soft). Our composer
    // runs after it and flips them to `isInline:false` when hardBreaks is on.
    // Replicate that upstream plugin here (research R2).
    const softBreaks = () => (tree: MdNode) => {
      visit(tree, 'text', (node, index, parent) => {
        const text = node as MdNode & { value: string }
        if (!text.value || typeof text.value !== 'string') return
        const parts = text.value.split(/\n/)
        if (parts.length === 1) return
        const result: MdNode[] = []
        parts.forEach((part, i) => {
          if (i > 0) result.push({ type: 'break', data: { isInline: true } })
          if (part) result.push({ type: 'text', value: part })
        })
        ;(parent as { children: MdNode[] }).children.splice(index as number, 1, ...result)
      })
    }

    const on = unified()
      .use(remarkParse)
      .use(remarkStringify)
      .use(softBreaks)
      .use(markdownSyntaxRemark({ ...ALL_OFF, hardBreaks: true }))
    const onTree = on.runSync(on.parse('a\nb')) as unknown as MdNode
    const onBreaks = onTree.children?.[0]?.children?.filter((c) => c.type === 'break') ?? []
    expect(onBreaks.length).toBeGreaterThan(0)
    expect(onBreaks[0].data?.isInline).toBe(false)

    const off = unified()
      .use(remarkParse)
      .use(remarkStringify)
      .use(softBreaks)
      .use(markdownSyntaxRemark(ALL_OFF))
    const offTree = off.runSync(off.parse('a\nb')) as unknown as MdNode
    const offBreaks = offTree.children?.[0]?.children?.filter((c) => c.type === 'break') ?? []
    expect(offBreaks.length).toBeGreaterThan(0)
    expect(offBreaks[0].data?.isInline).toBe(true)
  })

  describe('serialization stays enabled for disabled syntax (2026-08-15 review fix)', () => {
    function stringify(text: string, options: MarkdownSyntaxOptions): string {
      // Parse the doc with ALL syntaxes enabled so it actually CONTAINS the
      // node/mark of the syntax under test, then serialize with the given
      // options. Before the fix, serializing a table/strikethrough node while
      // the matching option was off threw "Cannot handle unknown node", which
      // made saves fail on a doc that held a now-disabled syntax (review Major).
      const parse = unified().use(remarkParse).use(markdownSyntaxRemark(ALL_ON))
      const tree = parse.runSync(parse.parse(text)) as unknown as MdNode
      const serialize = unified().use(remarkStringify).use(markdownSyntaxRemark(options))
      return serialize.stringify(tree as Parameters<typeof serialize.stringify>[0])
    }

    it('strikethrough node serializes even when the option is off', () => {
      expect(() => stringify('~~x~~', ALL_OFF)).not.toThrow()
      expect(stringify('~~x~~', ALL_OFF)).toContain('~~x~~')
    })

    it('table node serializes even when the option is off', () => {
      expect(() => stringify('| a |\n| - |', ALL_OFF)).not.toThrow()
      expect(stringify('| a |\n| - |', ALL_OFF)).toContain('|')
    })

    it('task list serializes even when the option is off', () => {
      expect(() => stringify('- [x] done', ALL_OFF)).not.toThrow()
      expect(stringify('- [x] done', ALL_OFF)).toContain('[x]')
    })

    it('math node serializes even when the option is off', () => {
      expect(() => stringify('$x$', ALL_OFF)).not.toThrow()
      expect(stringify('$x$', ALL_OFF)).toContain('$x$')
    })
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import {
  planSwitchCapture,
  type SwitchCapture,
  MarkdownAccessor,
  DocRefAccessor
} from '../../../src/renderer/domain/dirty'
import {
  resetOpenPerformanceCounters,
  getOpenPerformanceCounters
} from '../../../src/renderer/editor/openPerformance'
import type { DocumentState } from '../../../src/renderer/state/documents'

function makeDoc(patch: Partial<DocumentState> = {}): DocumentState {
  return {
    id: 'doc-1',
    path: 'a.md',
    title: 'a.md',
    baseline: '# Hi',
    editorBaseline: '# Hi\n',
    content: '# Hi\n',
    frontmatter: '',
    dirty: false,
    diskBytes: null,
    editorState: 'live',
    cursorOffset: 0,
    scrollTop: 0,
    sourceSelectionAnchor: 0,
    sourceSelectionHead: 0,
    sourceScrollTop: 0,
    lastActiveAt: 0,
    externalState: 'clean',
    contentVersion: 0,
    view: 'formatted',
    ...patch
  }
}

function accessor(value: string | null): { fn: MarkdownAccessor; set: (v: string | null) => void } {
  let current = value
  return {
    fn: () => current,
    set: (v: string | null) => {
      current = v
    }
  }
}

function identity(
  live: unknown,
  baseline: unknown
): {
  getLiveDoc: DocRefAccessor
  getBaselineDoc: DocRefAccessor
} {
  return { getLiveDoc: () => live, getBaselineDoc: () => baseline }
}

function contentOf(capture: SwitchCapture): string | null {
  return capture.kind === 'captured' ? capture.content : null
}

describe('planSwitchCapture (spec 044 D1)', () => {
  beforeEach(() => {
    resetOpenPerformanceCounters()
  })

  it('captures nothing for an evicted document and never serialises', () => {
    const a = accessor('# edited\n')
    expect(planSwitchCapture(makeDoc({ editorState: 'evicted' }), a.fn)).toEqual({
      kind: 'unchanged'
    })
    expect(getOpenPerformanceCounters().outgoingSerializations).toBe(0)
  })

  it('captures nothing for a document already in source view', () => {
    const a = accessor('# stale pre-source bytes\n')
    expect(planSwitchCapture(makeDoc({ view: 'source' }), a.fn)).toEqual({ kind: 'unchanged' })
  })

  it('takes the identity fast path with zero serialisations when the live doc matches the baseline', () => {
    const a = accessor('# Hi\n')
    const docRef = { marker: true }
    const { getLiveDoc, getBaselineDoc } = identity(docRef, docRef)
    expect(planSwitchCapture(makeDoc(), a.fn, getLiveDoc, getBaselineDoc)).toEqual({
      kind: 'unchanged'
    })
    expect(getOpenPerformanceCounters().outgoingSerializations).toBe(0)
  })

  it('captures the live bytes when they drift from the store even though the dirty flag is unset', () => {
    const a = accessor('# Hi\n\nRACE-TYPED-044')
    const capture = planSwitchCapture(
      makeDoc({ dirty: false, editorBaseline: '# Stale parse\n' }),
      a.fn
    )
    expect(contentOf(capture)).toBe('# Hi\n\nRACE-TYPED-044')
    expect(getOpenPerformanceCounters().outgoingSerializations).toBe(1)
  })

  it('is unchanged when the live serialization already equals the stored content', () => {
    const a = accessor('# Hi\n')
    expect(planSwitchCapture(makeDoc(), a.fn)).toEqual({ kind: 'unchanged' })
  })

  it('tolerates the editor single trailing newline so pristine files keep their exact bytes', () => {
    const a = accessor('# Hi')
    expect(planSwitchCapture(makeDoc({ content: '# Hi\n' }), a.fn)).toEqual({ kind: 'unchanged' })
    expect(getOpenPerformanceCounters().outgoingSerializations).toBe(0)
  })

  it('is unchanged when no editor is mounted to read from', () => {
    const a = accessor(null)
    expect(planSwitchCapture(makeDoc(), a.fn)).toEqual({ kind: 'unchanged' })
  })

  it('falls back to the byte comparison when the identity accessors are absent', () => {
    const a = accessor('# drifted\n')
    expect(contentOf(planSwitchCapture(makeDoc(), a.fn))).toBe('# drifted\n')
  })
})

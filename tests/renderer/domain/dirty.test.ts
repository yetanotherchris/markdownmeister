import { describe, it, expect, beforeEach } from 'vitest'
import {
  getLiveContent,
  isDirtyLive,
  getContentToSave,
  shouldFlushLive,
  MarkdownAccessor,
  DocRefAccessor
} from '../../../src/renderer/domain/dirty'
import { resetOpenPerformanceCounters, getOpenPerformanceCounters } from '../../../src/renderer/editor/openPerformance'
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
    lastActiveAt: 0,
    externalState: 'clean',
    contentVersion: 0,
    view: 'formatted',
    ...patch
  }
}

/** A markdown accessor whose value is set per-test. */
function accessor(value: string | null): { fn: MarkdownAccessor; set: (v: string | null) => void } {
  let current = value
  return {
    fn: () => current,
    set: (v: string | null) => { current = v }
  }
}

describe('getLiveContent', () => {
  it('returns the live markdown for a live editor', () => {
    const a = accessor('# edited\n')
    expect(getLiveContent(makeDoc(), a.fn)).toBe('# edited\n')
  })

  it('returns null for an evicted document', () => {
    const a = accessor('# edited\n')
    expect(getLiveContent(makeDoc({ editorState: 'evicted' }), a.fn)).toBeNull()
  })

  it('returns the live markdown even for a source-view document (the editor is still mounted and live)', () => {
    const a = accessor('# edited\n')
    expect(getLiveContent(makeDoc({ view: 'source' }), a.fn)).toBe('# edited\n')
  })
})

describe('isDirtyLive', () => {
  it('is dirty when the reducer flag is set', () => {
    const a = accessor('# Hi\n')
    expect(isDirtyLive(makeDoc({ dirty: true }), a.fn)).toBe(true)
  })

  it('is clean when the editor baseline matches the live serialization', () => {
    const a = accessor('# Hi\n')
    expect(isDirtyLive(makeDoc(), a.fn)).toBe(false)
  })

  it('is dirty when the live serialization drifts from the baseline', () => {
    const a = accessor('# Changed\n')
    expect(isDirtyLive(makeDoc(), a.fn)).toBe(true)
  })

  it('tolerates the editor single trailing newline (markdownSame)', () => {
    const a = accessor('# Hi')
    expect(isDirtyLive(makeDoc({ editorBaseline: '# Hi' }), a.fn)).toBe(false)
  })

  it('is clean when no editor is live', () => {
    const a = accessor('# Changed\n')
    expect(isDirtyLive(makeDoc({ editorState: 'evicted' }), a.fn)).toBe(false)
  })

  it('is clean for a source-view document regardless of the editor', () => {
    const a = accessor('# Changed\n')
    expect(isDirtyLive(makeDoc({ view: 'source' }), a.fn)).toBe(false)
  })
})

describe('isDirtyLive — doc-identity fast path (spec 033, contract C2)', () => {
  beforeEach(() => {
    resetOpenPerformanceCounters()
  })

  /** Identity accessors over a fixed pair of references. */
  function identity(live: unknown, baseline: unknown): {
    getLiveDoc: DocRefAccessor
    getBaselineDoc: DocRefAccessor
  } {
    return { getLiveDoc: () => live, getBaselineDoc: () => baseline }
  }

  it('returns clean with zero serialization when the live doc is reference-identical to the recorded baseline', () => {
    const a = accessor('# Hi\n')
    const docRef = { marker: true }
    expect(isDirtyLive(makeDoc(), a.fn, identity(docRef, docRef).getLiveDoc, identity(docRef, docRef).getBaselineDoc)).toBe(false)
    // The whole point of the fast path: the accessor was never consulted.
    expect(getOpenPerformanceCounters().outgoingSerializations).toBe(0)
  })

  it('falls back to the exact comparison when the references differ (an edit occurred)', () => {
    const a = accessor('# edited\n')
    expect(isDirtyLive(makeDoc(), a.fn, () => ({ v: 2 }), () => ({ v: 1 }))).toBe(true)
    expect(getOpenPerformanceCounters().outgoingSerializations).toBe(1)
  })

  it('falls back when the baseline record is missing even though the live reference exists', () => {
    const a = accessor('# Hi\n')
    expect(isDirtyLive(makeDoc(), a.fn, () => ({ v: 1 }), () => null)).toBe(false)
    expect(getOpenPerformanceCounters().outgoingSerializations).toBe(1)
  })

  it('the dirty flag still wins before the fast path can run', () => {
    const a = accessor('# Hi\n')
    const docRef = { marker: true }
    expect(isDirtyLive(makeDoc({ dirty: true }), a.fn, () => docRef, () => docRef)).toBe(true)
    expect(getOpenPerformanceCounters().outgoingSerializations).toBe(0)
  })

  it('decoration-only activity (same reference) cannot false-positive', () => {
    const a = accessor('# Hi\n')
    const docRef = { marker: true }
    expect(isDirtyLive(makeDoc(), a.fn, () => docRef, () => docRef)).toBe(false)
  })

  it('absent accessors preserve the exact-comparison behaviour', () => {
    const a = accessor('# Changed\n')
    expect(isDirtyLive(makeDoc(), a.fn)).toBe(true)
    expect(getOpenPerformanceCounters().outgoingSerializations).toBe(1)
  })
})

describe('getContentToSave', () => {
  it('writes the raw store content for a source-view document', () => {
    const a = accessor('# ignored\n')
    expect(getContentToSave(makeDoc({ view: 'source', content: '# raw\n' }), a.fn)).toBe('# raw\n')
  })

  it('writes the stored raw bytes for a clean formatted document (no-edit round trip)', () => {
    const a = accessor('# Hi\n')
    expect(getContentToSave(makeDoc({ content: '# Hi\n' }), a.fn)).toBe('# Hi\n')
  })

  it('writes the live serialization for a dirty formatted document', () => {
    const a = accessor('# edited\n')
    expect(getContentToSave(makeDoc(), a.fn)).toBe('# edited\n')
  })

  it('falls back to stored content when the live editor is gone', () => {
    const a = accessor(null)
    expect(getContentToSave(makeDoc({ editorState: 'evicted' }), a.fn)).toBe('# Hi\n')
  })
})

describe('shouldFlushLive', () => {
  it('never flushes a source-view document', () => {
    const a = accessor('# edited\n')
    expect(shouldFlushLive(makeDoc({ view: 'source', dirty: true }), a.fn)).toBe(false)
  })

  it('never flushes when the live text equals the stored content', () => {
    const a = accessor('# Hi\n')
    expect(shouldFlushLive(makeDoc({ dirty: true }), a.fn)).toBe(false)
  })

  it('never flushes a pristine document even when the serialization differs', () => {
    const a = accessor('# differs by normalization\n')
    expect(shouldFlushLive(makeDoc({ dirty: false }), a.fn)).toBe(false)
  })

  it('flushes only when the document is known dirty and the live text drifts', () => {
    const a = accessor('# edited\n')
    expect(shouldFlushLive(makeDoc({ dirty: true }), a.fn)).toBe(true)
  })

  it('does not flush when no editor is live', () => {
    const a = accessor(null)
    expect(shouldFlushLive(makeDoc({ dirty: true, editorState: 'evicted' }), a.fn)).toBe(false)
  })
})

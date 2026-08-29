import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Crepe } from '@milkdown/crepe'
import { useSourceViewToggle } from '../../src/renderer/hooks/useSourceViewToggle'
import { instancePool } from '../../src/renderer/editor/instancePool'
import type {
  DocumentsAction,
  EditingSession,
  DocumentState
} from '../../src/renderer/state/documents'

/**
 * Spec 052: the switch-time glue between the pure mapping module and the
 * store. The pure functions are pinned in caretSync.test.ts; these tests pin
 * which dispatches the hook issues for mapped, fallback, untouched, moved,
 * normalization-only, and edited switches.
 */

const DISPLAYED = '# Heading\n\nFirst paragraph line.\n\nSecond paragraph line.\n'

function makeDoc(patch: Partial<DocumentState> = {}): DocumentState {
  return {
    id: 'doc-1',
    panelId: 'doc-1',
    path: 'a.md',
    title: 'a.md',
    baseline: DISPLAYED,
    editorBaseline: DISPLAYED,
    content: DISPLAYED,
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
    revision: 0,
    view: 'formatted',
    ...patch
  }
}

/** A stub editor exposing the selection geometry the mapping correlates on:
 *  top-level child sizes and the caret's ProseMirror offset. Every child is
 *  typed as a paragraph, mirroring the real predicate so only a size-2 last
 *  child flags the trailing empty paragraph. */
function stubEditorFor(childSizes: number[], caretOffset: number): Crepe {
  const children = childSizes.map((size) => ({
    nodeSize: size,
    type: { name: 'paragraph' }
  }))
  return {
    destroy: () => {},
    editor: {
      action: () => ({
        state: {
          doc: {
            forEach: (fn: (child: { nodeSize: number; type: { name: string } }) => void) =>
              children.forEach((child) => fn(child)),
            lastChild: children[children.length - 1] ?? null
          },
          selection: { anchor: caretOffset }
        }
      })
    }
  } as unknown as Crepe
}

let root: Root | null = null
const container = document.createElement('div')

beforeEach(() => {
  document.body.appendChild(container)
})

afterEach(() => {
  root?.unmount()
  root = null
  container.remove()
  instancePool.destroyAll()
})

function makeHarness(opts: { doc: DocumentState; displayed: string | null; live: string | null }) {
  const dispatched: DocumentsAction[] = []
  let api!: ReturnType<typeof useSourceViewToggle>
  const session = {
    flushLiveContent: () => {},
    captureContentForSwitch: () => opts.displayed,
    getLiveContent: () => opts.live,
    isDirtyLive: () => false,
    handleActivate: () => {},
    handleNew: () => {},
    openFileFromExplorer: () => {}
  }

  function Harness() {
    api = useSourceViewToggle({
      dispatch: (action) => dispatched.push(action),
      sessionRef: {
        current: {
          documents: [opts.doc],
          activeId: opts.doc.id,
          untitledCounter: 0
        } satisfies EditingSession
      },
      session: session as unknown as Parameters<typeof useSourceViewToggle>[0]['session'],
      enforcePoolCap: () => {}
    })
    return null
  }

  root = createRoot(container)
  act(() => root!.render(<Harness />))
  return { api, dispatched }
}

describe('useSourceViewToggle caret sync (spec 052)', () => {
  it('seeds the mapped line start and reveals it when geometry correlates', () => {
    const doc = makeDoc()
    instancePool.register(doc.id, stubEditorFor([10, 200, 10], 15))
    const { api, dispatched } = makeHarness({ doc, displayed: DISPLAYED, live: null })

    act(() => api.handleShowSource(doc.id))

    const seedAction = dispatched.find((a) => a.type === 'SEED_SOURCE_CONTEXT')
    const paragraphStart = DISPLAYED.indexOf('First paragraph line.')
    expect(seedAction?.payload).toEqual({
      id: doc.id,
      scrollTop: 0,
      seed: {
        anchor: paragraphStart,
        head: paragraphStart,
        reveal: true,
        textLength: DISPLAYED.length
      }
    })
    expect(dispatched.find((a) => a.type === 'SET_VIEW')?.payload).toEqual({
      id: doc.id,
      view: 'source'
    })
  })

  it('seeds the stored context when the child counts do not correlate', () => {
    const doc = makeDoc({ sourceSelectionAnchor: 4, sourceSelectionHead: 6 })
    instancePool.register(doc.id, stubEditorFor([10, 10], 5))
    const { api, dispatched } = makeHarness({ doc, displayed: DISPLAYED, live: null })

    act(() => api.handleShowSource(doc.id))

    const seedAction = dispatched.find((a) => a.type === 'SEED_SOURCE_CONTEXT')
    expect(seedAction?.payload?.seed).toEqual({
      anchor: 4,
      head: 6,
      reveal: false,
      textLength: DISPLAYED.length
    })
  })

  it('seeds the mapped line start when a trailing empty paragraph is reported', () => {
    const doc = makeDoc()
    // The visual document carries Milkdown's trailing empty paragraph (size 2)
    // after its last block, so its child count is one more than the parsed
    // text's block count; the artifact is dropped and the mapping engages.
    instancePool.register(doc.id, stubEditorFor([10, 200, 10, 2], 15))
    const { api, dispatched } = makeHarness({ doc, displayed: DISPLAYED, live: null })

    act(() => api.handleShowSource(doc.id))

    const seedAction = dispatched.find((a) => a.type === 'SEED_SOURCE_CONTEXT')
    const paragraphStart = DISPLAYED.indexOf('First paragraph line.')
    expect(seedAction?.payload?.seed).toEqual({
      anchor: paragraphStart,
      head: paragraphStart,
      reveal: true,
      textLength: DISPLAYED.length
    })
  })

  it('falls back when a reported trailing paragraph does not align the counts', () => {
    const doc = makeDoc()
    instancePool.register(doc.id, stubEditorFor([10, 200, 10, 2, 2], 15))
    const { api, dispatched } = makeHarness({ doc, displayed: DISPLAYED, live: null })

    act(() => api.handleShowSource(doc.id))

    const seedAction = dispatched.find((a) => a.type === 'SEED_SOURCE_CONTEXT')
    expect(seedAction?.payload?.seed.reveal).toBe(false)
  })

  it('dispatches no prime on an untouched, unedited return', () => {
    const doc = makeDoc({
      sourceSeed: { anchor: 2, head: 2, reveal: true, textLength: DISPLAYED.length },
      sourceSelectionAnchor: 2,
      sourceSelectionHead: 2
    })
    const { api, dispatched } = makeHarness({ doc, displayed: null, live: DISPLAYED })

    act(() => api.handleReturnToFormatted(doc.id))

    expect(dispatched.find((a) => a.type === 'PRIME_VISUAL_CARET')).toBeUndefined()
    expect(dispatched.find((a) => a.type === 'REFRESH_FROM_SOURCE')).toBeUndefined()
    expect(dispatched.find((a) => a.type === 'SET_VIEW')?.payload).toEqual({
      id: doc.id,
      view: 'formatted'
    })
  })

  it('primes the mapped block when the source caret moved', () => {
    const secondBlock = DISPLAYED.indexOf('Second paragraph line.')
    const doc = makeDoc({
      sourceSeed: { anchor: 2, head: 2, reveal: true, textLength: DISPLAYED.length },
      sourceSelectionAnchor: secondBlock,
      sourceSelectionHead: secondBlock
    })
    const { api, dispatched } = makeHarness({ doc, displayed: null, live: DISPLAYED })

    act(() => api.handleReturnToFormatted(doc.id))

    expect(dispatched.find((a) => a.type === 'PRIME_VISUAL_CARET')?.payload).toEqual({
      id: doc.id,
      blockIndex: 2,
      blockCount: 3
    })
    expect(dispatched.find((a) => a.type === 'REFRESH_FROM_SOURCE')).toBeUndefined()
  })

  it('refreshes on editor normalization but does not treat it as an edit', () => {
    const doc = makeDoc({
      sourceSeed: { anchor: 2, head: 2, reveal: false, textLength: DISPLAYED.length },
      sourceSelectionAnchor: 2,
      sourceSelectionHead: 2
    })
    // The stale editor serialization differs from the stored bytes, yet the
    // displayed text length is unchanged: normalization, not a source edit.
    const { api, dispatched } = makeHarness({ doc, displayed: null, live: '# Different\n' })

    act(() => api.handleReturnToFormatted(doc.id))

    expect(dispatched.find((a) => a.type === 'PRIME_VISUAL_CARET')).toBeUndefined()
    expect(dispatched.find((a) => a.type === 'REFRESH_FROM_SOURCE')?.payload).toEqual({
      id: doc.id,
      content: DISPLAYED
    })
  })

  it('primes and refreshes when the source session edited the text', () => {
    const doc = makeDoc({
      sourceSeed: { anchor: 2, head: 2, reveal: false, textLength: DISPLAYED.length },
      sourceSelectionAnchor: 2,
      sourceSelectionHead: DISPLAYED.indexOf('Second paragraph line.')
    })
    const { api, dispatched } = makeHarness({ doc, displayed: null, live: '# Different\n' })

    act(() => api.handleReturnToFormatted(doc.id))

    expect(dispatched.find((a) => a.type === 'PRIME_VISUAL_CARET')?.payload).toEqual({
      id: doc.id,
      blockIndex: 2,
      blockCount: 3
    })
    expect(dispatched.find((a) => a.type === 'REFRESH_FROM_SOURCE')).toBeDefined()
  })
})

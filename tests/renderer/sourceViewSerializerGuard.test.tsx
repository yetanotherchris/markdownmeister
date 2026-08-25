import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Crepe } from '@milkdown/crepe'
import { useDocumentSession } from '../../src/renderer/hooks/useDocumentSession'
import { useSourceViewToggle } from '../../src/renderer/hooks/useSourceViewToggle'
import { instancePool } from '../../src/renderer/editor/instancePool'
import type {
  DocumentsAction,
  EditingSession,
  DocumentState
} from '../../src/renderer/state/documents'

/**
 * A document whose live serialisation throws (a node the active processor
 * cannot express) must never abort a view switch: the flush path keeps the
 * stored bytes, the capture path skips the update, and the return path still
 * dispatches REFRESH_FROM_SOURCE with the stored bytes before handing the tab
 * back to formatted editing.
 */

function makeDoc(patch: Partial<DocumentState> = {}): DocumentState {
  return {
    id: 'doc-1',
    panelId: 'doc-1',
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
    revision: 0,
    view: 'formatted',
    ...patch
  }
}

function makeSession(doc: DocumentState): EditingSession {
  return { documents: [doc], activeId: doc.id, untitledCounter: 0 }
}

/** Stub editor whose getMarkdown always throws, like an unserialisable node. */
function throwingEditor(): Crepe {
  return {
    getMarkdown: () => {
      throw new Error('Cannot serialize node of unknown kind')
    },
    destroy: () => {}
  } as unknown as Crepe
}

let root: Root | null = null
const container = document.createElement('div')

beforeEach(() => {
  document.body.appendChild(container)
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  container.remove()
  instancePool.destroyAll()
})

interface Exposed {
  session: ReturnType<typeof useDocumentSession>
  toggle: ReturnType<typeof useSourceViewToggle>
}

function mountHarness(session: EditingSession): Exposed & { dispatched: DocumentsAction[] } {
  const dispatched: DocumentsAction[] = []
  const dispatch = (action: DocumentsAction) => {
    dispatched.push(action)
  }
  const exposed = {} as Exposed

  function Harness() {
    const sessionApi = useDocumentSession({
      dispatch,
      sessionRef: { current: session },
      dialog: {
        dialogInFlightRef: { current: false },
        releaseDialogSurface: () => {},
        pendingErrorRef: { current: null },
        pendingExternalPromptRef: { current: null },
        handleExternalChangeRef: { current: null },
        showOperationErrorRef: { current: null },
        showOperationError: () => {}
      } as unknown as Parameters<typeof useDocumentSession>[0]['dialog'],
      enforcePoolCap: () => {}
    })
    exposed.session = sessionApi
    exposed.toggle = useSourceViewToggle({
      dispatch,
      sessionRef: { current: session },
      session: sessionApi,
      enforcePoolCap: () => {}
    })
    return null
  }

  root = createRoot(container)
  act(() => root!.render(<Harness />))
  return Object.assign(exposed, { dispatched })
}

describe('view switching survives a throwing serializer', () => {
  it('returning to formatted editing refreshes from the stored bytes', async () => {
    const doc = makeDoc({
      content: '# Body kept in the store\n',
      frontmatter: '---\ntitle: t\n---\n',
      view: 'source'
    })
    // The hook reads pre-switch state through its own ref copy.
    const session = makeSession({ ...doc })
    instancePool.register(doc.id, throwingEditor())
    const harness = mountHarness(session)

    await act(async () => {
      harness.toggle.handleReturnToFormatted(doc.id)
    })

    const refresh = harness.dispatched.find((action) => action.type === 'REFRESH_FROM_SOURCE')
    expect(refresh).toBeDefined()
    expect(refresh!.payload).toEqual({
      id: doc.id,
      content: '---\ntitle: t\n---\n# Body kept in the store\n'
    })
    expect(harness.dispatched.some((action) => action.type === 'SET_VIEW')).toBe(true)
  })

  it('flushing live content keeps the stored bytes instead of propagating', async () => {
    const doc = makeDoc({ dirty: true })
    const session = makeSession(doc)
    instancePool.register(doc.id, throwingEditor())
    const harness = mountHarness(session)

    await act(async () => {
      harness.session.flushLiveContent()
    })

    expect(harness.dispatched).toHaveLength(0)
  })

  it('entering the source view completes on the stored bytes', async () => {
    const doc = makeDoc({ dirty: true })
    const session = makeSession(doc)
    instancePool.register(doc.id, throwingEditor())
    const harness = mountHarness(session)

    await act(async () => {
      harness.toggle.handleShowSource(doc.id)
    })

    expect(harness.dispatched.some((action) => action.type === 'SET_VIEW')).toBe(true)
    expect(harness.dispatched.every((action) => action.type !== 'UPDATE_CONTENT')).toBe(true)
  })
})

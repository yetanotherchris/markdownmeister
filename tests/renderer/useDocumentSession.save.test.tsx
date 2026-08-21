import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Crepe } from '@milkdown/crepe'
import { useDocumentSession } from '../../src/renderer/hooks/useDocumentSession'
import { instancePool } from '../../src/renderer/editor/instancePool'
import type { DocumentsAction, EditingSession, DocumentState } from '../../src/renderer/state/documents'

/**
 * Spec 033 (contract C2): SAVE_SUCCESS moves `editorBaseline` without a
 * remount, so the recorded document identity must be cleared at both save
 * dispatch sites — otherwise the dirty fast path could prove cleanliness
 * against a baseline that no longer exists (Principle III hazard).
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

/** Stub editor whose only used surfaces are getMarkdown() and destroy(). */
function stubEditor(): Crepe {
  return { getMarkdown: () => '# Hi\n', destroy: () => {} } as unknown as Crepe
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

describe('useDocumentSession save clears the recorded identity (spec 033)', () => {
  it('SAVE_SUCCESS drops the baseline-doc identity for the saved document', async () => {
    const doc = makeDoc()
    const session = makeSession(doc)
    const dispatched: DocumentsAction[] = []
    let api!: ReturnType<typeof useDocumentSession>

    function Harness() {
      api = useDocumentSession({
        dispatch: (action) => dispatched.push(action),
        sessionRef: { current: session },
        // Only the two members the save path touches are real; the rest of the
        // DialogQueue surface is unreachable in this scenario.
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
      return null
    }

    root = createRoot(container)
    act(() => root!.render(<Harness />))

    // The editor is live and its identity was captured at baseline.
    instancePool.register(doc.id, stubEditor())
    instancePool.setBaselineDoc(doc.id, { marker: 'captured' })
    expect(instancePool.getBaselineDoc(doc.id)).toBeDefined()

    window.api = {
      writeFile: () => Promise.resolve({ ok: true, value: undefined })
    } as unknown as typeof window.api

    let result: string | undefined
    await act(async () => {
      result = await api.saveDocument(doc)
    })

    expect(result).toBe('saved')
    expect(dispatched.some((a) => a.type === 'SAVE_SUCCESS')).toBe(true)
    // The identity is gone (the entry remains, its recorded reference is
    // cleared): the fast path can no longer prove cleanliness against the
    // pre-save baseline.
    expect(instancePool.getBaselineDoc(doc.id)).toBeNull()
  })
})
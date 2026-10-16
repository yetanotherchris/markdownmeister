import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Crepe } from '@milkdown/crepe'
import { useDocumentSession } from '../../src/renderer/hooks/useDocumentSession'
import { instancePool } from '../../src/renderer/editor/instancePool'
import type {
  DocumentsAction,
  EditingSession,
  DocumentState
} from '../../src/renderer/state/documents'

/**
 * Spec 033 (contract C2): SAVE_SUCCESS moves `editorBaseline` without a
 * remount, so the recorded document identity must be cleared at both save
 * dispatch sites, otherwise the dirty fast path could prove cleanliness
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

function dialogStub() {
  return {
    dialogInFlightRef: { current: false },
    releaseDialogSurface: () => {},
    pendingErrorRef: { current: null },
    pendingExternalPromptRef: { current: null },
    handleExternalChangeRef: { current: null },
    showOperationErrorRef: { current: null },
    showOperationError: () => {}
  } as unknown as Parameters<typeof useDocumentSession>[0]['dialog']
}

describe('useDocumentSession save of an opened file (spec 069)', () => {
  it('writes a canonical path through writeOpenedFile and does not open the dialog', async () => {
    const doc = makeDoc({ path: null, canonicalPath: 'C:/outside/a.md', title: 'a.md' })
    const session = makeSession(doc)
    const dispatched: DocumentsAction[] = []
    let api!: ReturnType<typeof useDocumentSession>
    const writeOpenedFile = vi.fn(() =>
      Promise.resolve({ ok: true as const, value: { mtimeMs: 1, size: 1 } })
    )
    const writeFile = vi.fn()
    const saveFileDialog = vi.fn()
    window.api = { writeOpenedFile, writeFile, saveFileDialog } as unknown as typeof window.api

    function Harness() {
      api = useDocumentSession({
        dispatch: (action) => dispatched.push(action),
        sessionRef: { current: session },
        dialog: dialogStub(),
        enforcePoolCap: () => {}
      })
      return null
    }

    root = createRoot(container)
    act(() => root!.render(<Harness />))

    let result: string | undefined
    await act(async () => {
      result = await api.saveDocument(doc)
    })

    expect(result).toBe('saved')
    expect(writeOpenedFile).toHaveBeenCalledWith('C:/outside/a.md', '# Hi\n')
    expect(writeFile).not.toHaveBeenCalled()
    expect(saveFileDialog).not.toHaveBeenCalled()
    const success = dispatched.find((a) => a.type === 'SAVE_SUCCESS')
    expect(success).toMatchObject({
      type: 'SAVE_SUCCESS',
      payload: { path: null, canonicalPath: 'C:/outside/a.md' }
    })
  })

  it('still writes a workspace path through writeFile', async () => {
    const doc = makeDoc({ path: 'notes/a.md', canonicalPath: 'C:/folder/notes/a.md' })
    const session = makeSession(doc)
    let api!: ReturnType<typeof useDocumentSession>
    const writeFile = vi.fn(() =>
      Promise.resolve({ ok: true as const, value: { mtimeMs: 1, size: 1 } })
    )
    const writeOpenedFile = vi.fn()
    window.api = { writeFile, writeOpenedFile } as unknown as typeof window.api

    function Harness() {
      api = useDocumentSession({
        dispatch: () => {},
        sessionRef: { current: session },
        dialog: dialogStub(),
        enforcePoolCap: () => {}
      })
      return null
    }

    root = createRoot(container)
    act(() => root!.render(<Harness />))
    await act(async () => {
      await api.saveDocument(doc)
    })

    expect(writeFile).toHaveBeenCalledWith('notes/a.md', '# Hi\n')
    expect(writeOpenedFile).not.toHaveBeenCalled()
  })

  it('keeps a failed opened-file write unsaved and does not open the dialog', async () => {
    const doc = makeDoc({ path: null, canonicalPath: 'C:/outside/a.md', dirty: true })
    const session = makeSession(doc)
    const dispatched: DocumentsAction[] = []
    let api!: ReturnType<typeof useDocumentSession>
    const saveFileDialog = vi.fn()
    window.api = {
      writeOpenedFile: () =>
        Promise.resolve({ ok: false as const, code: 'LOCKED' as const, message: 'locked' }),
      saveFileDialog
    } as unknown as typeof window.api

    function Harness() {
      api = useDocumentSession({
        dispatch: (action) => dispatched.push(action),
        sessionRef: { current: session },
        dialog: dialogStub(),
        enforcePoolCap: () => {}
      })
      return null
    }

    root = createRoot(container)
    act(() => root!.render(<Harness />))
    let result: string | undefined
    await act(async () => {
      result = await api.saveDocument(doc)
    })

    expect(result).toBe('failed')
    expect(saveFileDialog).not.toHaveBeenCalled()
    expect(dispatched).toEqual([{ type: 'SAVE_FAILED', payload: { id: doc.id } }])
  })

  it('Save As outside the folder clears the relative path and stores the chosen canonical path', async () => {
    const doc = makeDoc({ path: 'notes/a.md', canonicalPath: 'C:/folder/notes/a.md' })
    const session = makeSession(doc)
    const dispatched: DocumentsAction[] = []
    let api!: ReturnType<typeof useDocumentSession>
    const writeOpenedFile = vi.fn()
    window.api = {
      writeOpenedFile,
      saveFileDialog: () =>
        Promise.resolve({
          ok: true as const,
          value: {
            path: null,
            name: 'b.md',
            content: '# Hi\n',
            mtimeMs: 2,
            size: 4,
            canonicalPath: 'C:/elsewhere/b.md'
          }
        })
    } as unknown as typeof window.api

    function Harness() {
      api = useDocumentSession({
        dispatch: (action) => dispatched.push(action),
        sessionRef: { current: session },
        dialog: dialogStub(),
        enforcePoolCap: () => {}
      })
      return null
    }

    root = createRoot(container)
    act(() => root!.render(<Harness />))
    await act(async () => {
      await api.saveDocument(doc, true)
    })

    expect(writeOpenedFile).not.toHaveBeenCalled()
    expect(dispatched).toContainEqual({
      type: 'SAVE_SUCCESS',
      payload: {
        id: doc.id,
        path: null,
        canonicalPath: 'C:/elsewhere/b.md',
        name: 'b.md',
        content: '# Hi\n',
        revision: 0
      }
    })
  })

  it('a cancelled Save As leaves the association unchanged', async () => {
    const doc = makeDoc({ path: null, canonicalPath: 'C:/outside/a.md' })
    const session = makeSession(doc)
    const dispatched: DocumentsAction[] = []
    let api!: ReturnType<typeof useDocumentSession>
    const writeOpenedFile = vi.fn()
    window.api = {
      writeOpenedFile,
      saveFileDialog: () => Promise.resolve({ ok: true as const, value: null })
    } as unknown as typeof window.api

    function Harness() {
      api = useDocumentSession({
        dispatch: (action) => dispatched.push(action),
        sessionRef: { current: session },
        dialog: dialogStub(),
        enforcePoolCap: () => {}
      })
      return null
    }

    root = createRoot(container)
    act(() => root!.render(<Harness />))
    let result: string | undefined
    await act(async () => {
      result = await api.saveDocument(doc, true)
    })

    expect(result).toBe('cancelled')
    expect(writeOpenedFile).not.toHaveBeenCalled()
    expect(dispatched).toEqual([])
  })

  it('close Save of an opened file writes in place', async () => {
    const doc = makeDoc({ path: null, canonicalPath: 'C:/outside/a.md', dirty: true })
    const session = makeSession(doc)
    const dispatched: DocumentsAction[] = []
    let api!: ReturnType<typeof useDocumentSession>
    const writeOpenedFile = vi.fn(() =>
      Promise.resolve({ ok: true as const, value: { mtimeMs: 1, size: 1 } })
    )
    const saveFileDialog = vi.fn()
    window.api = {
      writeOpenedFile,
      saveFileDialog,
      showConfirmation: () => Promise.resolve({ ok: true as const, value: 'save' as const })
    } as unknown as typeof window.api

    function Harness() {
      api = useDocumentSession({
        dispatch: (action) => dispatched.push(action),
        sessionRef: { current: session },
        dialog: dialogStub(),
        enforcePoolCap: () => {}
      })
      return null
    }

    root = createRoot(container)
    act(() => root!.render(<Harness />))
    await act(async () => {
      await api.handleCloseRequest(doc.id)
    })

    expect(writeOpenedFile).toHaveBeenCalledWith('C:/outside/a.md', '# Hi\n')
    expect(saveFileDialog).not.toHaveBeenCalled()
    expect(dispatched.some((action) => action.type === 'CLOSE')).toBe(true)
  })

  it('quit Save of an opened file writes in place', async () => {
    const doc = makeDoc({ path: null, canonicalPath: 'C:/outside/a.md', dirty: true })
    const session = makeSession(doc)
    let api!: ReturnType<typeof useDocumentSession>
    const writeOpenedFile = vi.fn(() =>
      Promise.resolve({ ok: true as const, value: { mtimeMs: 1, size: 1 } })
    )
    const saveFileDialog = vi.fn()
    const confirmQuit = vi.fn()
    window.api = {
      writeOpenedFile,
      saveFileDialog,
      confirmQuit,
      showConfirmation: () => Promise.resolve({ ok: true as const, value: 'save-all' as const })
    } as unknown as typeof window.api

    function Harness() {
      api = useDocumentSession({
        dispatch: () => {},
        sessionRef: { current: session },
        dialog: dialogStub(),
        enforcePoolCap: () => {}
      })
      return null
    }

    root = createRoot(container)
    act(() => root!.render(<Harness />))
    await act(async () => {
      await api.handleQuitRequest()
    })

    expect(writeOpenedFile).toHaveBeenCalledWith('C:/outside/a.md', '# Hi\n')
    expect(saveFileDialog).not.toHaveBeenCalled()
    expect(confirmQuit).toHaveBeenCalledWith('quit')
  })

  it('a forced save still opens the dialog for an opened file', async () => {
    const doc = makeDoc({ path: null, canonicalPath: 'C:/outside/a.md', dirty: true })
    const session = makeSession(doc)
    let api!: ReturnType<typeof useDocumentSession>
    const writeOpenedFile = vi.fn()
    const saveFileDialog = vi.fn(() => Promise.resolve({ ok: true as const, value: null }))
    window.api = { writeOpenedFile, saveFileDialog } as unknown as typeof window.api

    function Harness() {
      api = useDocumentSession({
        dispatch: () => {},
        sessionRef: { current: session },
        dialog: dialogStub(),
        enforcePoolCap: () => {}
      })
      return null
    }

    root = createRoot(container)
    act(() => root!.render(<Harness />))
    let result: string | undefined
    await act(async () => {
      result = await api.saveDocument(doc, true)
    })

    expect(result).toBe('cancelled')
    expect(writeOpenedFile).not.toHaveBeenCalled()
    expect(saveFileDialog).toHaveBeenCalledWith('a.md', '# Hi\n')
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useWorkspaceTree } from '../../src/renderer/hooks/useWorkspaceTree'
import type { TreeNode } from '../../src/renderer/state/workspace'
import type { EditingSession } from '../../src/renderer/state/documents'
import type { OpenedFile } from '../../src/shared/ipc-contract'

/**
 * Spec 058: a confirmed creation commit from the explorer opens the just-named
 * file in a new active tab (FR-001). These tests pin the hook boundary: when a
 * creation placeholder is confirmed, openFileFromExplorer is called with the
 * final path and explicit-new forced; cancellation, failed naming, folder
 * creation, and ordinary renames never open anything (FR-004/005/006). A
 * failed commit leaves the placeholder pending so a retry still opens a tab,
 * and a failed read of the created file surfaces an error instead of a tab.
 */

function makeNode(id: string, name: string, kind: 'file' | 'directory'): TreeNode {
  return { id, name, kind, children: kind === 'directory' ? [] : null, loadState: 'loaded' }
}

function makeSession(): EditingSession {
  return { documents: [], activeId: null, untitledCounter: 0 }
}

const movedPath = 'notes/fresh.md'

let root: Root | null = null
const container = document.createElement('div')

beforeEach(() => {
  document.body.appendChild(container)
  window.api = {
    moveEntry: () =>
      Promise.resolve({ ok: true, value: { path: movedPath, name: 'fresh.md', kind: 'file' } }),
    readFile: () =>
      Promise.resolve({
        ok: true,
        value: { path: movedPath, name: 'fresh.md', content: '', mtimeMs: 0, size: 0 }
      }),
    trashEntry: () => Promise.resolve({ ok: true, trashed: true })
  } as unknown as typeof window.api
})

afterEach(() => {
  root?.unmount()
  root = null
  container.remove()
  vi.restoreAllMocks()
})

function makeHarness(opts: { pendingCreates?: Set<string> } = {}) {
  const pendingCreateRef = { current: opts.pendingCreates ?? new Set<string>() }
  const workspaceRef = {
    current: { name: null, root: null, nodes: [], selectedId: null, error: null }
  }
  const sessionRef = { current: makeSession() }
  const opened: Array<{ file: OpenedFile; explicitNew: boolean }> = []
  const errors: string[] = []
  let api!: ReturnType<typeof useWorkspaceTree>

  const session = {
    doClose: () => {},
    isDirtyLive: () => false,
    openFileFromExplorer: (file: OpenedFile, explicitNew = false) => {
      opened.push({ file, explicitNew })
    }
  }

  function Harness() {
    api = useWorkspaceTree({
      dispatch: () => {},
      dispatchWorkspace: () => {},
      sessionRef,
      workspaceRef,
      dialog: {
        dialogInFlightRef: { current: false },
        releaseDialogSurface: () => {},
        showOperationError: (message: string) => {
          errors.push(message)
        }
      } as unknown as Parameters<typeof useWorkspaceTree>[0]['dialog'],
      session: session as unknown as Parameters<typeof useWorkspaceTree>[0]['session'],
      treeApiRef: { current: null },
      pendingCreateRef,
      createCounterRef: { current: 0 },
      setPendingEditId: () => {}
    })
    return null
  }

  root = createRoot(container)
  act(() => root!.render(<Harness />))
  return { api, opened, errors }
}

describe('useWorkspaceTree creation commit opens a new tab (spec 058)', () => {
  it('opens the renamed file in a new tab after a confirmed file creation', async () => {
    const placeholder = makeNode('notes/new-file-1.md', 'new-file-1.md', 'file')
    const { api, opened } = makeHarness({ pendingCreates: new Set(['notes/new-file-1.md']) })

    let ok: boolean | undefined
    await act(async () => {
      ok = await api.handleRename(placeholder, 'fresh.md')
    })

    expect(ok).toBe(true)
    expect(opened).toHaveLength(1)
    expect(opened[0].file.path).toBe(movedPath)
    expect(opened[0].explicitNew).toBe(true)
  })

  it('opens the placeholder path when the creation name is confirmed unchanged', async () => {
    // Confirming without editing keeps the placeholder name, so toPath equals
    // fromPath and no move happens, but the file is still on disk and must open.
    window.api = {
      readFile: () =>
        Promise.resolve({
          ok: true,
          value: {
            path: 'notes/new-file-1.md',
            name: 'new-file-1.md',
            content: '',
            mtimeMs: 0,
            size: 0
          }
        })
    } as unknown as typeof window.api
    const placeholder = makeNode('notes/new-file-1.md', 'new-file-1.md', 'file')
    const { api, opened } = makeHarness({ pendingCreates: new Set(['notes/new-file-1.md']) })

    let ok: boolean | undefined
    await act(async () => {
      ok = await api.handleRename(placeholder, 'new-file-1.md')
    })

    expect(ok).toBe(true)
    expect(opened).toHaveLength(1)
    expect(opened[0].file.path).toBe('notes/new-file-1.md')
    expect(opened[0].explicitNew).toBe(true)
  })

  it('opens nothing when the creation is cancelled (FR-004)', async () => {
    const { api, opened } = makeHarness({ pendingCreates: new Set(['notes/new-file-1.md']) })

    await act(async () => {
      api.handleEditingCancelled('notes/new-file-1.md')
    })

    expect(opened).toHaveLength(0)
  })

  it('opens nothing when the name is rejected (FR-004)', async () => {
    const placeholder = makeNode('notes/new-file-1.md', 'new-file-1.md', 'file')
    const { api, opened } = makeHarness({ pendingCreates: new Set(['notes/new-file-1.md']) })

    let ok: boolean | undefined
    await act(async () => {
      // Invalid: no markdown extension.
      ok = await api.handleRename(placeholder, 'fresh.txt')
    })

    expect(ok).toBe(false)
    expect(opened).toHaveLength(0)
  })

  it('a failed commit leaves the placeholder pending so a retry opens a tab (FR-001)', async () => {
    const placeholder = makeNode('notes/new-file-1.md', 'new-file-1.md', 'file')
    const pendingCreates = new Set(['notes/new-file-1.md'])
    const { api, opened } = makeHarness({ pendingCreates })

    // The committed name collides on disk: the move fails, nothing opens.
    window.api = {
      moveEntry: () => Promise.resolve({ ok: false, code: 'CONFLICT', message: 'Already exists' }),
      readFile: () =>
        Promise.resolve({
          ok: true,
          value: { path: 'x.md', name: 'x.md', content: '', mtimeMs: 0, size: 0 }
        })
    } as unknown as typeof window.api

    let ok: boolean | undefined
    await act(async () => {
      ok = await api.handleRename(placeholder, 'beta.md')
    })
    expect(ok).toBe(false)
    expect(opened).toHaveLength(0)

    // The placeholder is still pending, so an accepted retry opens its tab.
    window.api = {
      moveEntry: () =>
        Promise.resolve({ ok: true, value: { path: movedPath, name: 'fresh.md', kind: 'file' } }),
      readFile: () =>
        Promise.resolve({
          ok: true,
          value: { path: movedPath, name: 'fresh.md', content: '', mtimeMs: 0, size: 0 }
        })
    } as unknown as typeof window.api

    await act(async () => {
      ok = await api.handleRename(placeholder, 'fresh.md')
    })
    expect(ok).toBe(true)
    expect(opened).toHaveLength(1)
    expect(opened[0].file.path).toBe(movedPath)
  })

  it('a failed read of the created file surfaces an error and opens no tab', async () => {
    const placeholder = makeNode('notes/new-file-1.md', 'new-file-1.md', 'file')
    const { api, opened, errors } = makeHarness({
      pendingCreates: new Set(['notes/new-file-1.md'])
    })
    window.api = {
      moveEntry: () =>
        Promise.resolve({ ok: true, value: { path: movedPath, name: 'fresh.md', kind: 'file' } }),
      readFile: () => Promise.resolve({ ok: false, message: 'Could not read the file' })
    } as unknown as typeof window.api

    let ok: boolean | undefined
    await act(async () => {
      ok = await api.handleRename(placeholder, 'fresh.md')
    })

    expect(ok).toBe(true)
    expect(opened).toHaveLength(0)
    expect(errors).toEqual(['Could not read the file'])
  })

  it('opens nothing for a confirmed folder creation (FR-006)', async () => {
    const placeholder = makeNode('notes/new-folder-1', 'new-folder-1', 'directory')
    const { api, opened } = makeHarness({ pendingCreates: new Set(['notes/new-folder-1']) })

    let ok: boolean | undefined
    await act(async () => {
      ok = await api.handleRename(placeholder, 'docs')
    })

    expect(ok).toBe(true)
    expect(opened).toHaveLength(0)
  })

  it('opens nothing for an ordinary rename of an existing file (FR-005)', async () => {
    const existing = makeNode('notes/a.md', 'a.md', 'file')
    const { api, opened } = makeHarness()

    let ok: boolean | undefined
    await act(async () => {
      ok = await api.handleRename(existing, 'b.md')
    })

    expect(ok).toBe(true)
    expect(opened).toHaveLength(0)
  })
})

import { isWithinOrEqual } from './workspace'
import { splitFrontmatter, joinFrontmatter } from '../domain/frontmatter'
import type { OpenedFile } from '../../shared/ipc-contract'

export function markdownSame(a: string, b: string): boolean {
  const normalize = (s: string) => s.replace(/\r\n/g, '\n')
  const A = normalize(a)
  const B = normalize(b)
  return A === B || A === `${B}\n` || B === `${A}\n`
}

export function editorMatchesContent(live: string, content: string): boolean {
  const L = live.replace(/\r\n/g, '\n')
  const C = content.replace(/\r\n/g, '\n')
  return L === C || L === `${C}\n`
}

export interface DocumentState {
  id: string

  panelId: string
  path: string | null

  canonicalPath?: string
  title: string
  baseline: string

  editorBaseline: string
  content: string

  frontmatter: string
  dirty: boolean
  diskBytes: string | null
  editorState: 'live' | 'evicted'
  cursorOffset: number
  scrollTop: number

  sourceSelectionAnchor: number
  sourceSelectionHead: number
  sourceScrollTop: number
  lastActiveAt: number
  externalState: 'clean' | 'changedOnDisk' | 'deletedOnDisk'
  contentVersion: number
  /** Monotonic user-edit revision used to reject stale save completions. */
  revision?: number

  view: 'formatted' | 'source'

  pendingReplacement?: DocumentState
}

export interface EditingSession {
  documents: DocumentState[]
  activeId: string | null
  untitledCounter: number
}

export function createEmpty(counter: number): DocumentState {
  const id = `untitled-${counter}`
  return {
    id,
    panelId: id,
    path: null,
    title: `Untitled-${counter}`,
    baseline: '',
    editorBaseline: '',
    content: '',
    frontmatter: '',
    dirty: false,
    diskBytes: null,
    editorState: 'live',
    cursorOffset: 0,
    scrollTop: 0,
    sourceSelectionAnchor: 0,
    sourceSelectionHead: 0,
    sourceScrollTop: 0,
    lastActiveAt: Date.now(),
    externalState: 'clean',
    contentVersion: 0,
    revision: 0,
    view: 'formatted'
  }
}

export function openFile(opened: {
  path: string | null
  name: string
  content: string
  mtimeMs: number
  size: number
  canonicalPath?: string
  view?: 'formatted' | 'source'
}): DocumentState {
  const path = opened.path
  const id = path || `file-${Date.now()}`
  const { frontmatter, body } = splitFrontmatter(opened.content)
  return {
    id,
    panelId: id,
    path,
    canonicalPath: opened.canonicalPath,
    title: opened.name,
    baseline: opened.content,
    editorBaseline: body,
    content: body,
    frontmatter,
    dirty: false,
    diskBytes: null,
    editorState: 'live',
    cursorOffset: 0,
    scrollTop: 0,
    sourceSelectionAnchor: 0,
    sourceSelectionHead: 0,
    sourceScrollTop: 0,
    lastActiveAt: Date.now(),
    externalState: 'clean',
    contentVersion: 0,
    revision: 0,
    view: opened.view ?? 'formatted'
  }
}

interface OpenExistingPayload {
  value: OpenedFile & { view?: 'formatted' | 'source' }
  mode?: 'replace' | 'new'
}

export type DocumentsAction =
  | {
      type: 'OPEN_NEW'
    }
  | { type: 'OPEN_EXISTING'; payload: OpenExistingPayload }
  | { type: 'COMMIT_STAGED_REPLACEMENT'; payload: { outgoingId: string; incomingId: string } }
  | { type: 'CANCEL_STAGED_REPLACEMENT'; payload: { outgoingId: string; incomingId?: string } }
  | { type: 'ACTIVATE'; payload: { id: string } }
  | { type: 'UPDATE_CONTENT'; payload: { id: string; content: string } }
  | { type: 'CAPTURE_BASELINE'; payload: { id: string; baseline: string } }
  | {
      type: 'SAVE_SUCCESS'
      payload: { id: string; path: string; content: string; revision?: number }
    }
  | { type: 'SAVE_FAILED'; payload: { id: string } }
  | { type: 'CLOSE'; payload: { id: string } }
  | { type: 'EVICT'; payload: { id: string } }
  | { type: 'REACTIVATE'; payload: { id: string; cursorOffset: number; scrollTop: number } }
  | {
      type: 'CAPTURE_EDITOR_STATE'
      payload: { id: string; cursorOffset: number; scrollTop: number }
    }
  | {
      type: 'CAPTURE_SOURCE_CONTEXT'
      payload: { id: string; selectionAnchor: number; selectionHead: number; scrollTop: number }
    }
  | { type: 'RELOAD'; payload: { id: string; content: string } }
  | { type: 'UPDATE_PATH'; payload: { id: string; path: string } }
  | { type: 'REROUTE_PATHS'; payload: { fromPath: string; toPath: string } }
  | { type: 'EXTERNAL_CHANGE'; payload: { path: string; kind: 'changed' | 'removed' } }
  | { type: 'SET_VIEW'; payload: { id: string; view: 'formatted' | 'source' } }
  | { type: 'REFRESH_FROM_SOURCE'; payload: { id: string; content: string } }

export function handleOpenNew(state: EditingSession): EditingSession {
  const counter = state.untitledCounter + 1
  const doc = createEmpty(counter)
  return {
    ...state,
    untitledCounter: counter,
    documents: [...state.documents, doc],
    activeId: doc.id
  }
}

export function handleOpenExisting(state: EditingSession, p: OpenExistingPayload): EditingSession {
  const value = p.value
  const existing = state.documents.find(
    (d) =>
      (d.path === value.path && value.path !== null) ||
      (value.path === null &&
        d.canonicalPath !== undefined &&
        value.canonicalPath !== undefined &&
        d.canonicalPath === value.canonicalPath)
  )
  if (existing) {
    if (value.view && existing.view !== value.view) {
      return {
        ...state,
        activeId: existing.id,
        documents: state.documents.map((d) =>
          d.id === existing.id
            ? {
                ...d,
                view: value.view!,
                editorState: d.editorState === 'evicted' ? 'live' : d.editorState
              }
            : d
        )
      }
    }
    return {
      ...state,
      activeId: existing.id,
      documents: state.documents.map((d) =>
        d.id === existing.id && d.editorState === 'evicted' ? { ...d, editorState: 'live' } : d
      )
    }
  }
  const doc = openFile(value)
  if (p.mode === 'replace') {
    const active = state.documents.find((d) => d.id === state.activeId)
    if (active && !active.dirty) {
      return {
        ...state,
        documents: state.documents.map((d) =>
          d.id === active.id ? { ...d, pendingReplacement: { ...doc, panelId: d.panelId } } : d
        )
      }
    }
  }
  return {
    ...state,
    documents: [...state.documents, doc],
    activeId: doc.id
  }
}

export function handleCommitStagedReplacement(
  state: EditingSession,
  payload: { outgoingId: string; incomingId: string }
): EditingSession {
  const outgoing = state.documents.find((d) => d.id === payload.outgoingId)
  const incoming = outgoing?.pendingReplacement
  if (!outgoing || !incoming || incoming.id !== payload.incomingId || outgoing.dirty) return state
  return {
    ...state,
    documents: state.documents.map((d) => (d.id === outgoing.id ? incoming : d)),
    activeId: state.activeId === outgoing.id ? incoming.id : state.activeId
  }
}

export function handleCancelStagedReplacement(
  state: EditingSession,
  payload: { outgoingId: string; incomingId?: string }
): EditingSession {
  return {
    ...state,
    documents: state.documents.map((d) => {
      if (d.id !== payload.outgoingId || !d.pendingReplacement) return d
      if (payload.incomingId && d.pendingReplacement.id !== payload.incomingId) return d
      return { ...d, pendingReplacement: undefined }
    })
  }
}

export function handleActivateDoc(state: EditingSession, id: string): EditingSession {
  const target = state.documents.find((d) => d.id === id)
  if (target) {
    return {
      ...state,
      activeId: id,
      documents: state.documents.map((d) => (d.id === id ? { ...d, lastActiveAt: Date.now() } : d))
    }
  }
  return state
}

export function handleUpdateContent(
  state: EditingSession,
  payload: { id: string; content: string }
): EditingSession {
  const { id, content } = payload
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.id === id
        ? d.view === 'source'
          ? // Spec 021 FR-007: the source textarea holds the FULL file, so every
            (() => {
              const { frontmatter, body } = splitFrontmatter(content)
              return {
                ...d,
                frontmatter,
                content: body,
                dirty: joinFrontmatter(frontmatter, body) !== d.baseline,
                revision: (d.revision ?? 0) + 1,
                lastActiveAt: Date.now()
              }
            })()
          : {
              ...d,
              content,
              dirty: !markdownSame(content, d.editorBaseline),
              revision: (d.revision ?? 0) + 1,
              lastActiveAt: Date.now()
            }
        : d
    )
  }
}

export function handleCaptureBaseline(
  state: EditingSession,
  payload: { id: string; baseline: string }
): EditingSession {
  const { id, baseline } = payload
  return {
    ...state,
    documents: state.documents.map((d) => {
      if (d.id === id) return { ...d, editorBaseline: baseline }
      if (d.pendingReplacement?.id === id) {
        return { ...d, pendingReplacement: { ...d.pendingReplacement, editorBaseline: baseline } }
      }
      return d
    })
  }
}

export function handleSaveSuccess(
  state: EditingSession,
  payload: { id: string; path: string; content: string }
): EditingSession {
  const { id, path, content } = payload
  const frontmatter = state.documents.find((d) => d.id === id)?.frontmatter ?? ''
  const body = content.startsWith(frontmatter) ? content.slice(frontmatter.length) : content
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.id === id
        ? {
            ...d,
            path: path || d.path,
            title: path ? path.split('/').pop() || d.title : d.title,
            baseline: content,
            editorBaseline: body,
            dirty: joinFrontmatter(d.frontmatter, d.content) !== content,
            externalState: 'clean'
          }
        : d
    )
  }
}

export function handleSaveFailed(state: EditingSession): EditingSession {
  return state
}

export function handleCloseDoc(state: EditingSession, id: string): EditingSession {
  const filtered = state.documents.filter((d) => d.id !== id)
  let activeId = state.activeId
  if (state.activeId === id) {
    const idx = state.documents.findIndex((d) => d.id === id)
    if (filtered.length > 0) {
      activeId = filtered[Math.min(idx, filtered.length - 1)].id
    } else {
      activeId = null
    }
  }
  return { ...state, documents: filtered, activeId }
}

export function handleEvict(state: EditingSession, id: string): EditingSession {
  return {
    ...state,
    documents: state.documents.map((d) => (d.id === id ? { ...d, editorState: 'evicted' } : d))
  }
}

export function handleReactivate(
  state: EditingSession,
  payload: { id: string; cursorOffset: number; scrollTop: number }
): EditingSession {
  const { id, cursorOffset, scrollTop } = payload
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.id === id ? { ...d, editorState: 'live', cursorOffset, scrollTop } : d
    )
  }
}

export function handleCaptureEditorState(
  state: EditingSession,
  payload: { id: string; cursorOffset: number; scrollTop: number }
): EditingSession {
  const { id, cursorOffset, scrollTop } = payload
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.id === id ? { ...d, cursorOffset, scrollTop, lastActiveAt: Date.now() } : d
    )
  }
}

export function handleCaptureSourceContext(
  state: EditingSession,
  payload: { id: string; selectionAnchor: number; selectionHead: number; scrollTop: number }
): EditingSession {
  const { id, selectionAnchor, selectionHead, scrollTop } = payload
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.id === id
        ? {
            ...d,
            sourceSelectionAnchor: selectionAnchor,
            sourceSelectionHead: selectionHead,
            sourceScrollTop: Math.max(0, scrollTop)
          }
        : d
    )
  }
}

export function handleReload(
  state: EditingSession,
  payload: { id: string; content: string }
): EditingSession {
  const { id, content } = payload
  const { frontmatter, body } = splitFrontmatter(content)
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.id === id
        ? {
            ...d,
            frontmatter,
            content: body,
            baseline: content,
            editorBaseline: body,
            dirty: false,
            externalState: 'clean',
            cursorOffset: 0,
            scrollTop: 0,
            sourceSelectionAnchor: 0,
            sourceSelectionHead: 0,
            sourceScrollTop: 0,
            contentVersion: d.contentVersion + 1,
            revision: (d.revision ?? 0) + 1
          }
        : d
    )
  }
}

export function handleUpdatePath(
  state: EditingSession,
  payload: { id: string; path: string }
): EditingSession {
  const { id, path } = payload
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.id === id ? { ...d, path, title: path.split('/').pop() || d.title } : d
    )
  }
}

export function handleReroutePaths(
  state: EditingSession,
  payload: { fromPath: string; toPath: string }
): EditingSession {
  const { fromPath, toPath } = payload
  return {
    ...state,
    documents: state.documents.map((d) => {
      if (!d.path) return d
      if (!isWithinOrEqual(d.path, fromPath)) return d
      const suffix = d.path.slice(fromPath.length)
      const newPath = toPath + suffix
      return { ...d, path: newPath, title: newPath.split('/').pop() || d.title }
    })
  }
}

export function handleExternalChange(
  state: EditingSession,
  payload: { path: string; kind: 'changed' | 'removed' }
): EditingSession {
  const { path, kind } = payload
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.path === path
        ? {
            ...d,
            externalState: kind === 'removed' ? 'deletedOnDisk' : 'changedOnDisk'
          }
        : d
    )
  }
}

export function handleSetView(
  state: EditingSession,
  payload: { id: string; view: 'formatted' | 'source' }
): EditingSession {
  const { id, view } = payload
  const target = state.documents.find((d) => d.id === id)
  if (!target || target.view === view) return state
  return {
    ...state,
    documents: state.documents.map((d) => (d.id === id ? { ...d, view } : d))
  }
}

export function handleRefreshFromSource(
  state: EditingSession,
  payload: { id: string; content: string }
): EditingSession {
  const { id, content } = payload
  const { frontmatter, body } = splitFrontmatter(content)
  return {
    ...state,
    documents: state.documents.map((d) =>
      d.id === id
        ? {
            ...d,
            frontmatter,
            content: body,
            editorBaseline: body,
            // Spec 044 D2: the stored caret offset and scroll survive the
            // refresh so returning from a source edit restores position
            // (clamped by applyCursorState) instead of resetting to the top.
            contentVersion: d.contentVersion + 1
          }
        : d
    )
  }
}

export function documentsReducer(state: EditingSession, action: DocumentsAction): EditingSession {
  switch (action.type) {
    case 'OPEN_NEW':
      return handleOpenNew(state)
    case 'OPEN_EXISTING':
      return handleOpenExisting(state, action.payload)
    case 'COMMIT_STAGED_REPLACEMENT':
      return handleCommitStagedReplacement(state, action.payload)
    case 'CANCEL_STAGED_REPLACEMENT':
      return handleCancelStagedReplacement(state, action.payload)
    case 'ACTIVATE':
      return handleActivateDoc(state, action.payload.id)
    case 'UPDATE_CONTENT':
      return handleUpdateContent(state, action.payload)
    case 'CAPTURE_BASELINE':
      return handleCaptureBaseline(state, action.payload)
    case 'SAVE_SUCCESS':
      if (action.payload.revision !== undefined) {
        const document = state.documents.find((d) => d.id === action.payload.id)
        if (document && document.revision !== action.payload.revision) return state
      }
      return handleSaveSuccess(state, action.payload)
    case 'SAVE_FAILED':
      return handleSaveFailed(state)
    case 'CLOSE':
      return handleCloseDoc(state, action.payload.id)
    case 'EVICT':
      return handleEvict(state, action.payload.id)
    case 'REACTIVATE':
      return handleReactivate(state, action.payload)
    case 'CAPTURE_EDITOR_STATE':
      return handleCaptureEditorState(state, action.payload)
    case 'CAPTURE_SOURCE_CONTEXT':
      return handleCaptureSourceContext(state, action.payload)
    case 'RELOAD':
      return handleReload(state, action.payload)
    case 'UPDATE_PATH':
      return handleUpdatePath(state, action.payload)
    case 'REROUTE_PATHS':
      return handleReroutePaths(state, action.payload)
    case 'EXTERNAL_CHANGE':
      return handleExternalChange(state, action.payload)
    case 'SET_VIEW':
      return handleSetView(state, action.payload)
    case 'REFRESH_FROM_SOURCE':
      return handleRefreshFromSource(state, action.payload)
    default:
      return state
  }
}

export function getActiveDocument(state: EditingSession): DocumentState | null {
  return state.documents.find((d) => d.id === state.activeId) || null
}

export function hasDirtyDocuments(state: EditingSession): boolean {
  return state.documents.some((d) => d.dirty)
}

export function getDirtyDocuments(state: EditingSession): DocumentState[] {
  return state.documents.filter((d) => d.dirty)
}

export type CloseDecision = 'prompt' | 'close'

export function planClose(state: EditingSession, id: string): CloseDecision {
  const doc = state.documents.find((d) => d.id === id)
  if (!doc) return 'close'
  return doc.dirty ? 'prompt' : 'close'
}

export type QuitDecision = 'prompt' | 'quit'

export function planQuit(state: EditingSession): QuitDecision {
  return hasDirtyDocuments(state) ? 'prompt' : 'quit'
}

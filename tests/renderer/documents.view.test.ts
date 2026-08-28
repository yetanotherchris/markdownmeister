import { describe, it, expect } from 'vitest'
import { documentsReducer, editorMatchesContent } from '../../src/renderer/state/documents'
import { createSession } from './helpers'

describe('documents reducer', () => {
  describe('view mode (spec 002)', () => {
    it('new documents default to formatted view', () => {
      const s1 = documentsReducer(createSession(), { type: 'OPEN_NEW' })
      expect(s1.documents[0].view).toBe('formatted')
    })

    it('opened files default to formatted view', () => {
      const state = documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1 } }
      })
      expect(state.documents[0].view).toBe('formatted')
    })

    it('OPEN_EXISTING with view source opens the file in source view', () => {
      const state = documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: {
          value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1, view: 'source' }
        }
      })
      expect(state.documents[0].view).toBe('source')
    })

    it('OPEN_EXISTING with view source switches an already-open formatted tab without duplicating', () => {
      const s1 = documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1 } }
      })
      const id = s1.documents[0].id
      const s2 = documentsReducer(s1, {
        type: 'OPEN_EXISTING',
        payload: {
          value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1, view: 'source' }
        }
      })
      expect(s2.documents).toHaveLength(1)
      expect(s2.activeId).toBe(id)
      expect(s2.documents[0].view).toBe('source')
    })

    it('OPEN_EXISTING without view leaves an existing tab untouched (dedupe unchanged)', () => {
      const s1 = documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1 } }
      })
      const id = s1.documents[0].id
      const s2 = documentsReducer(s1, {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1 } }
      })
      expect(s2.documents).toHaveLength(1)
      expect(s2.documents[0].view).toBe('formatted')
      expect(s2.activeId).toBe(id)
    })

    it('SET_VIEW flips the view and leaves content and dirty untouched', () => {
      let state = documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1 } }
      })
      const id = state.documents[0].id
      state = documentsReducer(state, { type: 'UPDATE_CONTENT', payload: { id, content: 'y' } })
      state = documentsReducer(state, { type: 'SET_VIEW', payload: { id, view: 'source' } })
      expect(state.documents[0].view).toBe('source')
      expect(state.documents[0].content).toBe('y')
      expect(state.documents[0].dirty).toBe(true)
    })

    it('SET_VIEW with the same view is a no-op (same state reference, no re-render)', () => {
      const state = documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1 } }
      })
      const id = state.documents[0].id
      const after = documentsReducer(state, {
        type: 'SET_VIEW',
        payload: { id, view: 'formatted' }
      })
      expect(after).toBe(state)
      expect(state.documents[0].view).toBe('formatted')
      expect(state.documents).toHaveLength(1)
    })

    it('SET_VIEW does not affect other documents', () => {
      const s1 = documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'a.md', name: 'a.md', content: 'a', mtimeMs: 1, size: 1 } }
      })
      const s2 = documentsReducer(s1, {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'b.md', name: 'b.md', content: 'b', mtimeMs: 1, size: 1 } }
      })
      const aId = s2.documents[0].id
      const bId = s2.documents[1].id
      expect(aId).not.toBe(bId)
      const s3 = documentsReducer(s2, { type: 'SET_VIEW', payload: { id: aId, view: 'source' } })
      expect(s3.documents.find((d) => d.id === aId)?.view).toBe('source')
      expect(s3.documents.find((d) => d.id === bId)?.view).toBe('formatted')
    })

    it('captures source selection and scroll without changing document text or dirty state', () => {
      let state = documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'f.md', name: 'f.md', content: 'source', mtimeMs: 1, size: 6 } }
      })
      const id = state.documents[0].id
      state = documentsReducer(state, {
        type: 'CAPTURE_SOURCE_CONTEXT',
        payload: { id, selectionAnchor: 2, selectionHead: 5, scrollTop: 120 }
      })
      const document = state.documents[0]
      expect(document.sourceSelectionAnchor).toBe(2)
      expect(document.sourceSelectionHead).toBe(5)
      expect(document.sourceScrollTop).toBe(120)
      expect(document.content).toBe('source')
      expect(document.dirty).toBe(false)
    })

    it('REFRESH_FROM_SOURCE replaces content, bumps version, keeps dirty, retains cursor/scroll', () => {
      let state = documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1 } }
      })
      const id = state.documents[0].id
      state = documentsReducer(state, {
        type: 'UPDATE_CONTENT',
        payload: { id, content: 'raw [ ] text' }
      })
      state = documentsReducer(state, {
        type: 'CAPTURE_EDITOR_STATE',
        payload: { id, cursorOffset: 42, scrollTop: 137 }
      })
      const before = state.documents[0]
      state = documentsReducer(state, {
        type: 'REFRESH_FROM_SOURCE',
        payload: { id, content: '*edited* raw' }
      })
      const after = state.documents[0]
      expect(after.content).toBe('*edited* raw')
      expect(after.baseline).toBe('x')
      expect(after.dirty).toBe(true)
      // Spec 044 D2: offsets survive the refresh so position restores on
      // return instead of every source-edit round trip landing at the top.
      expect(after.cursorOffset).toBe(42)
      expect(after.scrollTop).toBe(137)
      expect(after.contentVersion).toBe(before.contentVersion + 1)
    })

    it('REFRESH_FROM_SOURCE keeps baseline so a clean doc stays clean when text unchanged', () => {
      const state = documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1 } }
      })
      const id = state.documents[0].id
      const after = documentsReducer(state, {
        type: 'REFRESH_FROM_SOURCE',
        payload: { id, content: 'x' }
      })
      expect(after.documents[0].content).toBe('x')
      expect(after.documents[0].baseline).toBe('x')
      expect(after.documents[0].dirty).toBe(false)
    })
  })
  describe('caret sync state (spec 052)', () => {
    const open = () =>
      documentsReducer(createSession(), {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1 } }
      })

    it('new and opened documents seed the initial source context at the top', () => {
      const opened = open()
      expect(opened.documents[0].sourceSeed).toEqual({
        anchor: 0,
        head: 0,
        reveal: false,
        textLength: 1
      })
      const fresh = documentsReducer(createSession(), { type: 'OPEN_NEW' })
      expect(fresh.documents[0].sourceSeed).toEqual({
        anchor: 0,
        head: 0,
        reveal: false,
        textLength: 0
      })
    })

    it('SEED_SOURCE_CONTEXT writes selection, scroll, and seed without touching text or dirty', () => {
      let state = open()
      const id = state.documents[0].id
      state = documentsReducer(state, { type: 'UPDATE_CONTENT', payload: { id, content: 'y' } })
      const revisionBefore = state.documents[0].revision
      state = documentsReducer(state, {
        type: 'SEED_SOURCE_CONTEXT',
        payload: {
          id,
          selectionAnchor: 12,
          selectionHead: 12,
          scrollTop: 30,
          seed: { anchor: 12, head: 12, reveal: true, textLength: 30 }
        }
      })
      const doc = state.documents[0]
      expect(doc.sourceSelectionAnchor).toBe(12)
      expect(doc.sourceSelectionHead).toBe(12)
      expect(doc.sourceScrollTop).toBe(30)
      expect(doc.sourceSeed).toEqual({ anchor: 12, head: 12, reveal: true, textLength: 30 })
      expect(doc.content).toBe('y')
      expect(doc.dirty).toBe(true)
      expect(doc.revision).toBe(revisionBefore)
    })

    it('SEED_SOURCE_CONTEXT does not affect other documents', () => {
      let state = open()
      state = documentsReducer(state, {
        type: 'OPEN_EXISTING',
        payload: { value: { path: 'g.md', name: 'g.md', content: 'g', mtimeMs: 1, size: 1 } }
      })
      const aId = state.documents[0].id
      const bId = state.documents[1].id
      state = documentsReducer(state, {
        type: 'SEED_SOURCE_CONTEXT',
        payload: {
          id: aId,
          selectionAnchor: 7,
          selectionHead: 7,
          scrollTop: 0,
          seed: { anchor: 7, head: 7, reveal: true, textLength: 7 }
        }
      })
      expect(state.documents.find((d) => d.id === aId)?.sourceSeed?.anchor).toBe(7)
      expect(state.documents.find((d) => d.id === bId)?.sourceSeed).toEqual({
        anchor: 0,
        head: 0,
        reveal: false,
        textLength: 1
      })
    })

    it('PRIME_VISUAL_CARET sets the mapped block and CLEAR_VISUAL_CARET consumes it', () => {
      let state = open()
      const id = state.documents[0].id
      state = documentsReducer(state, {
        type: 'PRIME_VISUAL_CARET',
        payload: { id, blockIndex: 2, blockCount: 5 }
      })
      expect(state.documents[0].cursorSync).toEqual({ blockIndex: 2, blockCount: 5 })
      state = documentsReducer(state, { type: 'CLEAR_VISUAL_CARET', payload: { id } })
      expect(state.documents[0].cursorSync).toBeUndefined()
    })

    it('RELOAD clears a primed sync and resets the seed to the zero context', () => {
      let state = open()
      const id = state.documents[0].id
      state = documentsReducer(state, {
        type: 'SEED_SOURCE_CONTEXT',
        payload: {
          id,
          selectionAnchor: 9,
          selectionHead: 9,
          scrollTop: 0,
          seed: { anchor: 9, head: 9, reveal: true, textLength: 9 }
        }
      })
      state = documentsReducer(state, {
        type: 'PRIME_VISUAL_CARET',
        payload: { id, blockIndex: 1, blockCount: 2 }
      })
      state = documentsReducer(state, { type: 'RELOAD', payload: { id, content: 'fresh' } })
      const doc = state.documents[0]
      expect(doc.cursorSync).toBeUndefined()
      expect(doc.sourceSeed).toEqual({ anchor: 0, head: 0, reveal: false, textLength: 5 })
    })

    it('EVICT clears a primed sync and neutralizes the seed reveal', () => {
      let state = open()
      const id = state.documents[0].id
      state = documentsReducer(state, {
        type: 'SEED_SOURCE_CONTEXT',
        payload: {
          id,
          selectionAnchor: 9,
          selectionHead: 9,
          scrollTop: 0,
          seed: { anchor: 9, head: 9, reveal: true, textLength: 9 }
        }
      })
      state = documentsReducer(state, {
        type: 'PRIME_VISUAL_CARET',
        payload: { id, blockIndex: 1, blockCount: 2 }
      })
      state = documentsReducer(state, { type: 'EVICT', payload: { id } })
      const doc = state.documents[0]
      expect(doc.cursorSync).toBeUndefined()
      expect(doc.sourceSeed).toEqual({ anchor: 9, head: 9, reveal: false, textLength: 1 })
    })

    it('OPEN_EXISTING flipping an open tab to source re-seeds from the stored context', () => {
      let state = open()
      const id = state.documents[0].id
      state = documentsReducer(state, {
        type: 'CAPTURE_SOURCE_CONTEXT',
        payload: { id, selectionAnchor: 4, selectionHead: 6, scrollTop: 12 }
      })
      state = documentsReducer(state, {
        type: 'PRIME_VISUAL_CARET',
        payload: { id, blockIndex: 1, blockCount: 2 }
      })
      state = documentsReducer(state, {
        type: 'OPEN_EXISTING',
        payload: {
          value: { path: 'f.md', name: 'f.md', content: 'x', mtimeMs: 1, size: 1, view: 'source' }
        }
      })
      const doc = state.documents[0]
      expect(doc.view).toBe('source')
      expect(doc.sourceSeed).toEqual({ anchor: 4, head: 6, reveal: false, textLength: 1 })
      expect(doc.cursorSync).toBeUndefined()
    })
  })
  describe('editorMatchesContent (spec 002, return-to-formatted remount)', () => {
    it('editor output equal to stored content is unchanged', () => {
      expect(editorMatchesContent('# title', '# title')).toBe(true)
    })

    it("the editor's single appended trailing newline is unchanged", () => {
      expect(editorMatchesContent('# title\n', '# title')).toBe(true)
    })

    it('CRLF disk content matches a live editor that normalized EOLs', () => {
      expect(editorMatchesContent('# title\n\nbody\n', '# title\r\n\r\nbody')).toBe(true)
    })

    it('an extra blank line at EOF is a real difference (not dropped)', () => {
      expect(editorMatchesContent('# title\n', '# title\n\n')).toBe(false)
    })

    it('a missing editor newline (content has it, editor does not) is not the editor normalization', () => {
      expect(editorMatchesContent('# title', '# title\n')).toBe(false)
    })

    it('content with real edits is different', () => {
      expect(editorMatchesContent('# title\n\nEdited.', '# title\n')).toBe(false)
    })
  })
})

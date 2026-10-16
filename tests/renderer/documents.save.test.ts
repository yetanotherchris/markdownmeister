import { describe, expect, it } from 'vitest'
import { documentsReducer } from '../../src/renderer/state/documents'
import { createSession } from './helpers'

/**
 * Spec 069 data-model: SAVE_SUCCESS stores a null path, replaces canonicalPath,
 * and takes the title from the file name. SAVE_FAILED leaves the document.
 */

function opened(path: string | null, canonicalPath?: string) {
  return documentsReducer(createSession(), {
    type: 'OPEN_EXISTING',
    payload: {
      value: {
        path,
        name: path ? (path.split('/').pop() ?? 'file.md') : 'outside.md',
        content: 'hello',
        mtimeMs: 1,
        size: 5,
        canonicalPath
      }
    }
  })
}

describe('SAVE_SUCCESS association (spec 069)', () => {
  it('keeps an in-folder path and canonical path on an in-place save', () => {
    const state = opened('notes/a.md', 'C:/folder/notes/a.md')
    const id = state.documents[0].id
    const dirty = documentsReducer(state, {
      type: 'UPDATE_CONTENT',
      payload: { id, content: 'edited' }
    })
    const saved = documentsReducer(dirty, {
      type: 'SAVE_SUCCESS',
      payload: { id, path: 'notes/a.md', content: 'edited' }
    })
    expect(saved.documents[0].path).toBe('notes/a.md')
    expect(saved.documents[0].canonicalPath).toBe('C:/folder/notes/a.md')
    expect(saved.documents[0].dirty).toBe(false)
    expect(saved.documents[0].title).toBe('a.md')
  })

  it('stores a null path for an opened file outside the folder', () => {
    const state = opened(null, 'C:/outside/a.md')
    const id = state.documents[0].id
    const saved = documentsReducer(state, {
      type: 'SAVE_SUCCESS',
      payload: { id, path: null, canonicalPath: 'C:/outside/a.md', content: 'hello' }
    })
    expect(saved.documents[0].path).toBeNull()
    expect(saved.documents[0].canonicalPath).toBe('C:/outside/a.md')
    expect(saved.documents[0].title).toBe('outside.md')
  })

  it('clears a previous relative path when Save As chooses a file outside the folder', () => {
    const state = opened('notes/a.md', 'C:/folder/notes/a.md')
    const id = state.documents[0].id
    const saved = documentsReducer(state, {
      type: 'SAVE_SUCCESS',
      payload: {
        id,
        path: null,
        canonicalPath: 'C:/elsewhere/b.md',
        name: 'b.md',
        content: 'hello'
      }
    })
    expect(saved.documents[0].path).toBeNull()
    expect(saved.documents[0].canonicalPath).toBe('C:/elsewhere/b.md')
    expect(saved.documents[0].title).toBe('b.md')
  })

  it('retargets Save As onto a file inside the folder', () => {
    const state = opened(null, 'C:/outside/a.md')
    const id = state.documents[0].id
    const saved = documentsReducer(state, {
      type: 'SAVE_SUCCESS',
      payload: {
        id,
        path: 'notes/b.md',
        canonicalPath: 'C:/folder/notes/b.md',
        name: 'b.md',
        content: 'hello'
      }
    })
    expect(saved.documents[0].path).toBe('notes/b.md')
    expect(saved.documents[0].canonicalPath).toBe('C:/folder/notes/b.md')
    expect(saved.documents[0].title).toBe('b.md')
  })

  it('leaves the association unchanged when a direct save fails', () => {
    const state = opened(null, 'C:/outside/a.md')
    const id = state.documents[0].id
    const dirty = documentsReducer(state, {
      type: 'UPDATE_CONTENT',
      payload: { id, content: 'edited' }
    })
    const failed = documentsReducer(dirty, { type: 'SAVE_FAILED', payload: { id } })
    expect(failed.documents[0].path).toBeNull()
    expect(failed.documents[0].canonicalPath).toBe('C:/outside/a.md')
    expect(failed.documents[0].dirty).toBe(true)
    expect(failed.documents[0].content).toBe('edited')
  })
})

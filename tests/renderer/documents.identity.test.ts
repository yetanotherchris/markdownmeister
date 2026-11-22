import { describe, it, expect } from 'vitest'
import { documentsReducer } from '../../src/renderer/state/documents'
import type { EditingSession } from '../../src/renderer/state/documents'
import { createSession } from './helpers'

/**
 * Spec 073 US1: a file opened before its folder has `path: null` and a
 * canonical identity. The later explorer read supplies a workspace-relative
 * path and the same identity, so both requests describe one document.
 */

const identity = 'C:\\workspace\\dir\\a.md'

interface FileLike {
  path: string | null
  name: string
  content: string
  mtimeMs: number
  size: number
  canonicalPath?: string
}

/** Open File with no folder open: no relative path, but main supplies identity. */
function noFolderOpen(): FileLike {
  return { path: null, name: 'a.md', content: '# a', mtimeMs: 1, size: 3, canonicalPath: identity }
}

/** Explorer read of the same file once its folder is open. */
function explorerRead(): FileLike {
  return {
    path: 'a.md',
    name: 'a.md',
    content: '# a',
    mtimeMs: 2,
    size: 3,
    canonicalPath: identity
  }
}

function openExisting(
  state: EditingSession,
  value: FileLike,
  mode?: 'replace' | 'new'
): EditingSession {
  return documentsReducer(state, { type: 'OPEN_EXISTING', payload: { value, mode } })
}

function edit(state: EditingSession, id: string): EditingSession {
  return documentsReducer(state, {
    type: 'UPDATE_CONTENT',
    payload: { id, content: 'FIRST edited' }
  })
}

describe('handleOpenExisting: spec 073 US1 identity match', () => {
  it('activates a no-folder tab when the explorer read supplies the same identity', () => {
    const s1 = openExisting(createSession(), noFolderOpen())
    const firstId = s1.activeId!
    const s2 = edit(s1, firstId)
    expect(s2.documents[0].dirty).toBe(true)

    const s3 = openExisting(s2, explorerRead())

    expect(s3.documents).toHaveLength(1)
    expect(s3.documents[0].id).toBe(firstId)
    expect(s3.activeId).toBe(firstId)
    expect(s3.documents[0].content).toBe('FIRST edited')
    expect(s3.documents[0].dirty).toBe(true)
    expect(s3.documents[0].path).toBe(null)
    expect(s3.documents[0].canonicalPath).toBe(identity)
    expect(s3.documents[0].pendingReplacement).toBeUndefined()
  })

  it('keeps the relative path when the no-folder open arrives second', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const firstId = s1.activeId!
    const s2 = edit(s1, firstId)

    const s3 = openExisting(s2, noFolderOpen())

    expect(s3.documents).toHaveLength(1)
    expect(s3.documents[0].id).toBe(firstId)
    expect(s3.activeId).toBe(firstId)
    expect(s3.documents[0].content).toBe('FIRST edited')
    expect(s3.documents[0].dirty).toBe(true)
    expect(s3.documents[0].path).toBe('a.md')
    expect(s3.documents[0].canonicalPath).toBe(identity)
  })

  it('ignores mode replace on an identity match and stages nothing', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const aId = s1.activeId!
    const s2 = openExisting(s1, {
      path: 'b.md',
      name: 'b.md',
      content: '# b',
      mtimeMs: 1,
      size: 3,
      canonicalPath: 'C:\\workspace\\dir\\b.md'
    })
    expect(s2.documents).toHaveLength(2)
    expect(s2.activeId).not.toBe(aId)

    const s3 = openExisting(s2, noFolderOpen(), 'replace')

    expect(s3.documents).toHaveLength(2)
    expect(s3.activeId).toBe(aId)
    expect(s3.documents.some((d) => d.pendingReplacement !== undefined)).toBe(false)
  })

  it('does not match a null-path document from a relative path without an identity', () => {
    const s1 = openExisting(createSession(), noFolderOpen())
    const s2 = openExisting(s1, {
      path: 'a.md',
      name: 'a.md',
      content: '# a',
      mtimeMs: 2,
      size: 3
    })

    expect(s2.documents).toHaveLength(2)
    expect(s2.documents.map((d) => d.path)).toEqual([null, 'a.md'])
  })
})

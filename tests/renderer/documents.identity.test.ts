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
  view?: 'formatted' | 'source'
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
  it('activates a no-folder tab and adopts the explorer route', () => {
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
    expect(s3.documents[0].path).toBe('a.md')
    expect(s3.documents[0].title).toBe('a.md')
    expect(s3.documents[0].canonicalPath).toBe(identity)
    expect(s3.documents[0].pendingReplacement).toBeUndefined()
  })

  it('adopts the null path when the no-folder open arrives second', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const firstId = s1.activeId!
    const s2 = edit(s1, firstId)

    const s3 = openExisting(s2, noFolderOpen())

    expect(s3.documents).toHaveLength(1)
    expect(s3.documents[0].id).toBe(firstId)
    expect(s3.activeId).toBe(firstId)
    expect(s3.documents[0].content).toBe('FIRST edited')
    expect(s3.documents[0].dirty).toBe(true)
    expect(s3.documents[0].path).toBe(null)
    expect(s3.documents[0].title).toBe('a.md')
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

describe('handleOpenExisting: spec 073 US2 identity across routes', () => {
  const otherIdentity = 'C:\\workspace\\dir2\\a.md'

  function fileAt(pathValue: string | null, canonicalPath: string | undefined): FileLike {
    return {
      path: pathValue,
      name: 'a.md',
      content: '# a',
      mtimeMs: 3,
      size: 3,
      canonicalPath
    }
  }

  it('matches an explorer read with the operating-system open shape', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const id = s1.activeId!
    const s2 = edit(s1, id)

    const s3 = openExisting(s2, fileAt(null, identity))

    expect(s3.documents).toHaveLength(1)
    expect(s3.activeId).toBe(id)
    expect(s3.documents[0].path).toBe(null)
    expect(s3.documents[0].content).toBe('FIRST edited')
    expect(s3.documents[0].dirty).toBe(true)
  })

  it('matches a path containing .. that resolves to the same identity', () => {
    const s1 = openExisting(createSession(), fileAt('dir/a.md', identity))
    const id = s1.activeId!
    const s2 = edit(s1, id)

    const s3 = openExisting(s2, fileAt('dir/sub/../a.md', identity))

    expect(s3.documents).toHaveLength(1)
    expect(s3.activeId).toBe(id)
    expect(s3.documents[0].path).toBe('dir/sub/../a.md')
    expect(s3.documents[0].title).toBe('a.md')
    expect(s3.documents[0].content).toBe('FIRST edited')
  })

  it('opens two tabs for the same relative path with different identities', () => {
    const s1 = openExisting(createSession(), fileAt('a.md', identity))
    const s2 = openExisting(s1, fileAt('a.md', otherIdentity))

    expect(s2.documents).toHaveLength(2)
    expect(s2.documents.map((d) => d.path)).toEqual(['a.md', 'a.md'])
    expect(new Set(s2.documents.map((d) => d.id)).size).toBe(2)
    expect(s2.documents.map((d) => d.canonicalPath)).toEqual([identity, otherIdentity])
  })

  it('backfills a missing identity on activation without changing the path', () => {
    const s1 = openExisting(createSession(), fileAt('a.md', undefined))
    const id = s1.activeId!

    const s2 = openExisting(s1, explorerRead())

    expect(s2.documents).toHaveLength(1)
    expect(s2.activeId).toBe(id)
    expect(s2.documents[0].path).toBe('a.md')
    expect(s2.documents[0].content).toBe('# a')
    expect(s2.documents[0].dirty).toBe(false)
    expect(s2.documents[0].canonicalPath).toBe(identity)
  })

  it('backfills a missing identity when the activation also switches view', () => {
    const s1 = openExisting(createSession(), fileAt('a.md', undefined))
    const id = s1.activeId!

    const s2 = openExisting(s1, { ...explorerRead(), view: 'source' })

    expect(s2.documents).toHaveLength(1)
    expect(s2.activeId).toBe(id)
    expect(s2.documents[0].path).toBe('a.md')
    expect(s2.documents[0].view).toBe('source')
    expect(s2.documents[0].canonicalPath).toBe(identity)
  })

  it('replaces the identity on Save As and opens the old file separately', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const id = s1.activeId!
    const savedIdentity = 'C:\\workspace\\dir\\b.md'

    const saved = documentsReducer(s1, {
      type: 'SAVE_SUCCESS',
      payload: {
        id,
        path: null,
        canonicalPath: savedIdentity,
        name: 'b.md',
        content: '# a'
      }
    })
    expect(saved.documents[0].path).toBeNull()
    expect(saved.documents[0].canonicalPath).toBe(savedIdentity)
    expect(saved.documents[0].title).toBe('b.md')

    const reopened = openExisting(saved, explorerRead())

    expect(reopened.documents).toHaveLength(2)
    expect(reopened.documents.find((d) => d.id === id)?.canonicalPath).toBe(savedIdentity)
    expect(reopened.documents.find((d) => d.path === 'a.md')?.canonicalPath).toBe(identity)
  })

  it('keeps the identity and title on a plain save', () => {
    const s1 = openExisting(createSession(), explorerRead())

    const saved = documentsReducer(s1, {
      type: 'SAVE_SUCCESS',
      payload: { id: s1.activeId!, path: 'a.md', content: '# a saved' }
    })

    expect(saved.documents[0].path).toBe('a.md')
    expect(saved.documents[0].canonicalPath).toBe(identity)
    expect(saved.documents[0].title).toBe('a.md')
  })

  it('clears the identity on rename and backfills the new one on reopen', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const id = s1.activeId!

    const renamed = documentsReducer(s1, {
      type: 'REROUTE_PATHS',
      payload: { fromPath: 'a.md', toPath: 'renamed.md' }
    })
    expect(renamed.documents).toHaveLength(1)
    expect(renamed.documents[0].id).toBe(id)
    expect(renamed.documents[0].path).toBe('renamed.md')
    expect(renamed.documents[0].title).toBe('renamed.md')
    expect(renamed.documents[0].canonicalPath).toBeUndefined()

    const renamedIdentity = 'C:\\workspace\\dir\\renamed.md'
    const reopened = openExisting(renamed, fileAt('renamed.md', renamedIdentity))
    expect(reopened.documents).toHaveLength(1)
    expect(reopened.documents[0].id).toBe(id)
    expect(reopened.documents[0].canonicalPath).toBe(renamedIdentity)
  })

  it('clears the identity when UPDATE_PATH retargets the document', () => {
    const s1 = openExisting(createSession(), explorerRead())

    const moved = documentsReducer(s1, {
      type: 'UPDATE_PATH',
      payload: { id: s1.activeId!, path: 'moved/a.md' }
    })

    expect(moved.documents[0].path).toBe('moved/a.md')
    expect(moved.documents[0].canonicalPath).toBeUndefined()
  })

  it('keeps the identity on a reroute that does not change the path', () => {
    const s1 = openExisting(createSession(), explorerRead())

    const rerouted = documentsReducer(s1, {
      type: 'REROUTE_PATHS',
      payload: { fromPath: 'a.md', toPath: 'a.md' }
    })

    expect(rerouted.documents[0].path).toBe('a.md')
    expect(rerouted.documents[0].canonicalPath).toBe(identity)
  })

  it('stages a spec 024 replacement when the file is not open', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const activeId = s1.activeId!
    const otherIdentityValue = 'C:\\workspace\\dir\\b.md'

    const s2 = openExisting(s1, { ...fileAt('b.md', otherIdentityValue), name: 'b.md' }, 'replace')

    expect(s2.documents).toHaveLength(1)
    expect(s2.activeId).toBe(activeId)
    expect(s2.documents[0].path).toBe('a.md')
    expect(s2.documents[0].pendingReplacement?.path).toBe('b.md')
    expect(s2.documents[0].pendingReplacement?.canonicalPath).toBe(otherIdentityValue)
  })

  it('lets an identity match take precedence over mode replace', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const aId = s1.activeId!
    const s2 = openExisting(s1, { ...fileAt('b.md', 'C:\\workspace\\dir\\b.md'), name: 'b.md' })
    expect(s2.documents).toHaveLength(2)
    expect(s2.activeId).not.toBe(aId)

    const s3 = openExisting(s2, fileAt(null, identity), 'replace')

    expect(s3.documents).toHaveLength(2)
    expect(s3.activeId).toBe(aId)
    expect(s3.documents.every((d) => d.pendingReplacement === undefined)).toBe(true)
  })
})

describe('handleOpenExisting: workspace route rebinding', () => {
  function fileAt(pathValue: string | null, canonicalPath: string, name = 'a.md'): FileLike {
    return { path: pathValue, name, content: '# a', mtimeMs: 4, size: 3, canonicalPath }
  }

  it('adopts a deeper relative path after the workspace root changes', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const id = s1.activeId!
    const s2 = edit(s1, id)

    const s3 = openExisting(s2, fileAt('dir/a.md', identity))

    expect(s3.documents).toHaveLength(1)
    expect(s3.documents[0].id).toBe(id)
    expect(s3.documents[0].path).toBe('dir/a.md')
    expect(s3.documents[0].title).toBe('a.md')
    expect(s3.documents[0].content).toBe('FIRST edited')
    expect(s3.documents[0].baseline).toBe('# a')
    expect(s3.documents[0].dirty).toBe(true)
    expect(s3.documents[0].canonicalPath).toBe(identity)
  })

  it('adopts a null path when the file is reopened outside the workspace', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const id = s1.activeId!
    const s2 = edit(s1, id)

    const s3 = openExisting(s2, fileAt(null, identity))

    expect(s3.documents).toHaveLength(1)
    expect(s3.documents[0].id).toBe(id)
    expect(s3.documents[0].path).toBe(null)
    expect(s3.documents[0].title).toBe('a.md')
    expect(s3.documents[0].content).toBe('FIRST edited')
    expect(s3.documents[0].dirty).toBe(true)
  })

  it('keeps the title when the incoming route is the same path', () => {
    const s1 = openExisting(createSession(), explorerRead())

    const s2 = openExisting(s1, fileAt('a.md', identity, 'display.md'))

    expect(s2.documents).toHaveLength(1)
    expect(s2.documents[0].path).toBe('a.md')
    expect(s2.documents[0].title).toBe('a.md')
  })

  it('adopts the route in the explicit view-switch branch', () => {
    const s1 = openExisting(createSession(), explorerRead())
    const id = s1.activeId!

    const s2 = openExisting(s1, { ...fileAt('dir/a.md', identity), view: 'source' })

    expect(s2.documents).toHaveLength(1)
    expect(s2.documents[0].id).toBe(id)
    expect(s2.documents[0].path).toBe('dir/a.md')
    expect(s2.documents[0].view).toBe('source')
    expect(s2.documents[0].content).toBe('# a')
  })

  it('does not adopt the route of a different file with the same relative path', () => {
    const s1 = openExisting(createSession(), explorerRead())

    const s2 = openExisting(s1, fileAt('a.md', 'C:\\workspace\\dir2\\a.md', 'other.md'))

    expect(s2.documents).toHaveLength(2)
    expect(s2.documents[0].path).toBe('a.md')
    expect(s2.documents[0].title).toBe('a.md')
  })
})

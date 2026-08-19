import { describe, it, expect } from 'vitest'
import { documentsReducer, openFile } from '../../src/renderer/state/documents'
import type { EditingSession } from '../../src/renderer/state/documents'
import { createSession } from './helpers'

const file = (path: string, name = path) => ({ path, name, content: `# ${name}`, mtimeMs: 1, size: name.length + 3 })

function openExisting(state: EditingSession, path: string, mode?: 'replace'): EditingSession {
  return documentsReducer(state, { type: 'OPEN_EXISTING', payload: { value: file(path), mode } })
}

function openNew(state: EditingSession): EditingSession {
  return documentsReducer(state, { type: 'OPEN_NEW' })
}

function dirty(state: EditingSession, id: string): EditingSession {
  return documentsReducer(state, { type: 'UPDATE_CONTENT', payload: { id, content: 'edited' } })
}

describe('handleOpenExisting — spec 024 replace mode', () => {
  it('FR-001 stages a clean active tab replacement without changing the visible document', () => {
    const s1 = openExisting(createSession(), 'a.md')
    const aId = s1.activeId
    const s2 = openExisting(s1, 'b.md', 'replace')

    expect(s2.documents).toHaveLength(1)
    expect(s2.documents[0].path).toBe('a.md')
    expect(s2.documents[0].title).toBe('a.md')
    expect(s2.documents[0].dirty).toBe(false)
    expect(s2.activeId).toBe(aId)
    expect(s2.documents[0].pendingReplacement?.path).toBe('b.md')
  })

  it('FR-002 a dirty active tab opens a new tab, leaving the dirty tab', () => {
    let s1 = openExisting(createSession(), 'a.md')
    const aId = s1.activeId!
    s1 = dirty(s1, aId)
    expect(s1.documents.find(d => d.id === aId)?.dirty).toBe(true)

    const s2 = openExisting(s1, 'b.md', 'replace')
    expect(s2.documents).toHaveLength(2)
    expect(s2.documents.find(d => d.id === aId)?.dirty).toBe(true)
    expect(s2.activeId).not.toBe(aId)
  })

  it('FR-009 a clean untitled tab stages a replacement', () => {
    const s1 = openNew(createSession())
    const untitledId = s1.activeId!
    const s2 = openExisting(s1, 'a.md', 'replace')

    expect(s2.documents).toHaveLength(1)
    expect(s2.documents[0].id).toBe(untitledId)
    expect(s2.documents[0].pendingReplacement?.path).toBe('a.md')
  })

  it('FR-003 an existing tab for the target path is activated, never replaced', () => {
    const s1 = openExisting(createSession(), 'a.md')
    const s2 = openExisting(s1, 'b.md') // b active, clean
    const s3 = openExisting(s2, 'a.md', 'replace')

    expect(s3.documents).toHaveLength(2)
    expect(s3.activeId).toBe(s1.documents[0].id)
    expect(s3.documents.map(d => d.path)).toEqual(['a.md', 'b.md'])
  })

  it('FR-004 with no active tab a new tab is created', () => {
    const s = openExisting(createSession(), 'a.md', 'replace')
    expect(s.documents).toHaveLength(1)
    expect(s.documents[0].path).toBe('a.md')
  })

  it('commits a ready staged replacement atomically with a fresh clean document', () => {
    const s1 = openExisting(createSession(), 'a.md')
    const aId = s1.activeId!
    const s2 = openExisting(s1, 'b.md', 'replace')

    const incomingId = s2.documents[0].pendingReplacement!.id
    const s3 = documentsReducer(s2, {
      type: 'COMMIT_STAGED_REPLACEMENT',
      payload: { outgoingId: aId, incomingId }
    })
    const replaced = s3.documents[0]
    expect(replaced.path).toBe('b.md')
    expect(replaced.title).toBe('b.md')
    expect(replaced.content).toBe('# b.md')
    expect(replaced.baseline).toBe('# b.md')
    expect(replaced.dirty).toBe(false)
    // The old document identity (and its undo history) is gone.
    expect(s3.documents.some(d => d.id === aId)).toBe(false)
  })

  it('cancels a staged replacement without changing the outgoing document', () => {
    const s1 = openExisting(createSession(), 'a.md')
    const s2 = openExisting(s1, 'b.md', 'replace')
    const s3 = documentsReducer(s2, {
      type: 'CANCEL_STAGED_REPLACEMENT',
      payload: { outgoingId: s1.activeId! }
    })
    expect(s3.documents[0].path).toBe('a.md')
    expect(s3.documents[0].pendingReplacement).toBeUndefined()
  })

  it('supersedes an obsolete staged replacement with the latest request', () => {
    const s1 = openExisting(createSession(), 'a.md')
    const s2 = openExisting(s1, 'b.md', 'replace')
    const s3 = openExisting(s2, 'c.md', 'replace')
    expect(s3.documents).toHaveLength(1)
    expect(s3.documents[0].path).toBe('a.md')
    expect(s3.documents[0].pendingReplacement?.path).toBe('c.md')
  })

  it('rejects a commit if the outgoing document became dirty while staging', () => {
    const s1 = openExisting(createSession(), 'a.md')
    const s2 = openExisting(s1, 'b.md', 'replace')
    const s3 = dirty(s2, s1.activeId!)
    const s4 = documentsReducer(s3, {
      type: 'COMMIT_STAGED_REPLACEMENT',
      payload: { outgoingId: s1.activeId!, incomingId: s2.documents[0].pendingReplacement!.id }
    })
    expect(s4.documents[0].path).toBe('a.md')
    expect(s4.documents[0].dirty).toBe(true)
  })

  it('drops a pending replacement when its outgoing tab closes', () => {
    const s1 = openExisting(createSession(), 'a.md')
    const s2 = openExisting(s1, 'b.md', 'replace')
    const s3 = documentsReducer(s2, { type: 'CLOSE', payload: { id: s1.activeId! } })
    expect(s3.documents).toHaveLength(0)
    expect(s3.activeId).toBeNull()
  })

  it('mode absent behaves as before (new tab)', () => {
    const s1 = openExisting(createSession(), 'a.md')
    const s2 = openExisting(s1, 'b.md')
    expect(s2.documents).toHaveLength(2)
  })

  it('openFile still yields a fresh document identity', () => {
    const a = openFile(file('a.md'))
    const b = openFile(file('b.md'))
    expect(a.id).toBe('a.md')
    expect(b.id).toBe('b.md')
    expect(a.dirty).toBe(false)
  })
})

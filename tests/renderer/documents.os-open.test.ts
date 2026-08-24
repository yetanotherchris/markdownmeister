import { describe, it, expect } from 'vitest'
import { documentsReducer, openFile } from '../../src/renderer/state/documents'
import type { EditingSession } from '../../src/renderer/state/documents'
import { createSession } from './helpers'

/**
 * Detached files (`path: null`) carry a `canonicalPath`
 * (the realpath main supplied) so FR-007, "activate the existing tab, never
 * create a duplicate", holds outside the workspace too.
 */

interface OsFileLike {
  path: string | null
  name: string
  content: string
  mtimeMs: number
  size: number
  canonicalPath?: string
}

function osFile(canonicalPath: string, name = 'notes.md'): OsFileLike {
  return { path: null, name, content: `# ${name}`, mtimeMs: 1, size: 3, canonicalPath }
}

function openExisting(state: EditingSession, value: OsFileLike): EditingSession {
  return documentsReducer(state, { type: 'OPEN_EXISTING', payload: { value } })
}

describe('handleOpenExisting — spec 006 detached-file dedupe (FR-007)', () => {
  it('opens a detached file as a new tab', () => {
    const s = openExisting(createSession(), osFile('C:\\notes\\a.md'))
    expect(s.documents).toHaveLength(1)
    expect(s.documents[0].path).toBe(null)
    expect(s.documents[0].canonicalPath).toBe('C:\\notes\\a.md')
  })

  it('re-opening the same detached file activates the existing tab (no duplicate)', () => {
    const s1 = openExisting(createSession(), osFile('C:\\notes\\a.md'))
    const firstId = s1.activeId
    const s2 = openExisting(s1, osFile('C:\\notes\\a.md'))

    expect(s2.documents).toHaveLength(1)
    expect(s2.activeId).toBe(firstId)
  })

  it('two detached files with different canonical paths each open a tab', () => {
    const s1 = openExisting(createSession(), osFile('C:\\notes\\a.md'))
    const s2 = openExisting(s1, osFile('C:\\notes\\b.md'))

    expect(s2.documents).toHaveLength(2)
  })

  it('a same-canonical-path open also activates a workspace-relative document', () => {
    // A doc opened with a workspace-relative path, then an OS-open of the same
    // file arrives with its canonical realpath.
    const rel: OsFileLike = {
      path: 'notes/a.md',
      name: 'a.md',
      content: '# a',
      mtimeMs: 1,
      size: 3,
      canonicalPath: 'C:\\workspace\\notes\\a.md'
    }
    const s1 = documentsReducer(createSession(), { type: 'OPEN_EXISTING', payload: { value: rel } })
    const firstId = s1.activeId
    const s2 = openExisting(s1, osFile('C:\\workspace\\notes\\a.md'))

    expect(s2.documents).toHaveLength(1)
    expect(s2.activeId).toBe(firstId)
  })
})

describe('openFile — spec 006 canonicalPath', () => {
  it('stores the canonical path on the document', () => {
    const doc = openFile(osFile('C:\\notes\\a.md'))
    expect(doc.canonicalPath).toBe('C:\\notes\\a.md')
  })

  it('leaves canonicalPath unset when main did not supply one', () => {
    const doc = openFile({ path: 'a.md', name: 'a.md', content: '# a', mtimeMs: 1, size: 3 })
    expect(doc.canonicalPath).toBeUndefined()
  })
})

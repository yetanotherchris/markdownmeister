import { describe, it, expect } from 'vitest'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getSearchQuery } from '@codemirror/search'
import {
  closeSourceSearchAndRefocus,
  findNextSourceMatch,
  findPreviousSourceMatch,
  openSourceSearch,
  setSourceSearchQuery,
  sourceSearchExtension,
  sourceSearchIsOpen,
  type SourceSearchSnapshot
} from '../../../src/renderer/search/sourceSearch'

interface Harness {
  view: EditorView
  snapshots: SourceSearchSnapshot[]
  transactionEvents: Array<{ docChanged: boolean }>
  destroy: () => void
}

function makeView(doc: string, anchor?: number): Harness {
  const snapshots: SourceSearchSnapshot[] = []
  const transactionEvents: Array<{ docChanged: boolean }> = []
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: anchor === undefined ? undefined : EditorSelection.single(anchor),
      extensions: [
        sourceSearchExtension((snapshot) => snapshots.push({ ...snapshot })),
        EditorView.updateListener.of((update) => {
          update.transactions.forEach((tr) => transactionEvents.push({ docChanged: tr.docChanged }))
        })
      ]
    }),
    parent
  })
  return {
    view,
    snapshots,
    transactionEvents,
    destroy: () => {
      view.destroy()
      parent.remove()
    }
  }
}

function lastSnapshot(harness: Harness): SourceSearchSnapshot {
  return harness.snapshots[harness.snapshots.length - 1]
}

describe('sourceSearch (spec 056 FR-002/004/010/011)', () => {
  it('matches every occurrence case-insensitively and places the caret on the first', () => {
    const harness = makeView('Alpha alpha ALPHA')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'alpha')
    expect(lastSnapshot(harness)).toMatchObject({ open: true, current: 0, total: 3 })
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 0, head: 5 })
    harness.destroy()
  })

  it('matches markdown characters literally instead of as a pattern', () => {
    const harness = makeView('a *b* [c] end')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, '*b* [c]')
    expect(lastSnapshot(harness).total).toBe(1)
    harness.destroy()
  })

  it('treats backslash sequences literally, never as escapes', () => {
    // The document holds the two characters \ n and a real newline. Literal
    // matching finds only the two-character sequence; unquoting would also
    // match the real newline and report 2.
    const harness = makeView('first\\nsecond\nthird')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, '\\n')
    expect(lastSnapshot(harness).total).toBe(1)
    harness.destroy()
  })

  it('finds occurrences inside the frontmatter block', () => {
    const harness = makeView('---\ntitle: hello\n---\n\n# hello there')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'hello')
    expect(lastSnapshot(harness).total).toBe(2)
    expect(harness.view.state.selection.main.anchor).toBe(11)
    harness.destroy()
  })

  it('places the caret on the first match at or after the caret, wrapping at the end', () => {
    const harness = makeView('foo bar foo')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'foo')
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 0, head: 3 })

    harness.view.dispatch({ selection: EditorSelection.single(5) })
    setSourceSearchQuery(harness.view, 'foo')
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 8, head: 11 })
    expect(lastSnapshot(harness).current).toBe(1)

    setSourceSearchQuery(harness.view, 'foo')
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 8, head: 11 })

    harness.view.dispatch({ selection: EditorSelection.single(11) })
    setSourceSearchQuery(harness.view, 'foo')
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 0, head: 3 })
    expect(lastSnapshot(harness).current).toBe(0)
    harness.destroy()
  })

  it('reports zero matches calmly and leaves the caret untouched', () => {
    const harness = makeView('foo bar')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'foo')
    setSourceSearchQuery(harness.view, 'zzz')
    expect(lastSnapshot(harness)).toMatchObject({ open: true, current: 0, total: 0 })
    expect(harness.view.state.selection.main.anchor).toBe(0)
    harness.destroy()
  })

  it('treats a whitespace-only query as no query', () => {
    const harness = makeView('a b c')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, '   ')
    expect(lastSnapshot(harness)).toMatchObject({ open: true, current: 0, total: 0 })
    expect(harness.view.state.selection.main.anchor).toBe(0)
    harness.destroy()
  })

  it('keeps the caret on the growing match while the query is typed', () => {
    const harness = makeView('foo foo')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'f')
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 0, head: 1 })
    setSourceSearchQuery(harness.view, 'fo')
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 0, head: 2 })
    setSourceSearchQuery(harness.view, 'foo')
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 0, head: 3 })
    expect(lastSnapshot(harness)).toMatchObject({ current: 0, total: 2 })
    harness.destroy()
  })
})

describe('sourceSearch navigation (spec 056 US2/FR-006)', () => {
  it('steps next and previous with wrap-around at both ends', () => {
    const harness = makeView('aa xx aa yy aa')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'aa')
    expect(lastSnapshot(harness)).toMatchObject({ current: 0, total: 3 })

    findNextSourceMatch(harness.view)
    expect(lastSnapshot(harness).current).toBe(1)
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 6, head: 8 })

    findNextSourceMatch(harness.view)
    expect(lastSnapshot(harness).current).toBe(2)
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 12, head: 14 })

    findNextSourceMatch(harness.view)
    expect(lastSnapshot(harness).current).toBe(0)
    expect(harness.view.state.selection.main).toMatchObject({ anchor: 0, head: 2 })

    findPreviousSourceMatch(harness.view)
    expect(lastSnapshot(harness).current).toBe(2)

    findPreviousSourceMatch(harness.view)
    expect(lastSnapshot(harness).current).toBe(1)
    harness.destroy()
  })

  it('navigation is a no-op while the query matches nothing', () => {
    const harness = makeView('foo bar')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'zzz')
    const before = harness.view.state.selection.main.anchor
    findNextSourceMatch(harness.view)
    findPreviousSourceMatch(harness.view)
    expect(harness.view.state.selection.main.anchor).toBe(before)
    expect(lastSnapshot(harness).total).toBe(0)
    harness.destroy()
  })

  it('refreshes the count against edited content while the box stays open', () => {
    const harness = makeView('foo foo')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'foo')
    expect(lastSnapshot(harness).total).toBe(2)

    harness.view.dispatch({ changes: { from: 0, insert: 'foo ' } })
    expect(lastSnapshot(harness).total).toBe(3)

    harness.view.dispatch({ changes: { from: 0, to: 4, insert: '' } })
    expect(lastSnapshot(harness).total).toBe(2)
    harness.destroy()
  })
})

describe('sourceSearch dismissal (spec 056 US3/FR-008/009/014)', () => {
  it('search operations dispatch selection-only transactions so dirty cannot flip', () => {
    const harness = makeView('foo bar foo')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'foo')
    findNextSourceMatch(harness.view)
    findPreviousSourceMatch(harness.view)
    closeSourceSearchAndRefocus(harness.view)
    expect(harness.transactionEvents.length).toBeGreaterThan(0)
    for (const event of harness.transactionEvents) expect(event.docChanged).toBe(false)
    expect(harness.view.state.doc.toString()).toBe('foo bar foo')
    harness.destroy()
  })

  it('close clears state, drops the query, and returns focus to the text', () => {
    const harness = makeView('foo bar')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'foo')
    expect(sourceSearchIsOpen(harness.view)).toBe(true)
    closeSourceSearchAndRefocus(harness.view)
    expect(lastSnapshot(harness)).toEqual({ open: false, current: 0, total: 0 })
    expect(sourceSearchIsOpen(harness.view)).toBe(false)
    expect(getSearchQuery(harness.view.state).valid).toBe(false)
    expect(harness.view.hasFocus).toBe(true)
    harness.destroy()
  })

  it('reopening after a close starts with no query and no matches', () => {
    const harness = makeView('foo bar')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'foo')
    closeSourceSearchAndRefocus(harness.view)
    openSourceSearch(harness.view)
    expect(lastSnapshot(harness)).toEqual({ open: true, current: 0, total: 0 })
    harness.destroy()
  })

  it('reopening while open keeps the query and the match state', () => {
    const harness = makeView('foo bar foo')
    openSourceSearch(harness.view)
    setSourceSearchQuery(harness.view, 'foo')
    openSourceSearch(harness.view)
    expect(lastSnapshot(harness)).toMatchObject({ open: true, current: 0, total: 2 })
    harness.destroy()
  })
})

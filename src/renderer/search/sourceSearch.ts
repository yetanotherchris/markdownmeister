import {
  EditorSelection,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
  type Text
} from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import {
  findNext as findNextCommand,
  findPrevious as findPreviousCommand,
  getSearchQuery,
  SearchQuery,
  search as searchPackage,
  setSearchQuery
} from '@codemirror/search'

/** Glue between the shared SearchPanel and @codemirror/search for the source
 *  view (spec 056). The package's default panel and keymap are never used: the
 *  package provides the query state and the find commands, and this module
 *  adds highlights, counts, and open/close so both editing views present one
 *  search experience. */

export interface SourceSearchSnapshot {
  open: boolean
  /** Zero-based index of the current match; 0 when there are none. */
  current: number
  total: number
}

interface SearchSpan {
  from: number
  to: number
}

const matchMark = Decoration.mark({ class: 'cm-searchMatch' })
const currentMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-current' })

const setSourceSearchOpen = StateEffect.define<boolean>()

interface SourceSearchState {
  open: boolean
  query: SearchQuery
  spans: SearchSpan[]
}

function buildQuery(term: string): SearchQuery {
  // A whitespace-only term counts as no query, and literal matching keeps
  // markdown characters out of pattern interpretation (FR-010).
  const search = term.trim() === '' ? '' : term
  return new SearchQuery({ search, caseSensitive: false, literal: true, regexp: false })
}

function scanSpans(query: SearchQuery, doc: Text): SearchSpan[] {
  const spans: SearchSpan[] = []
  if (!query.valid) return spans
  const cursor = query.getCursor(doc)
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    spans.push({ from: next.value.from, to: next.value.to })
  }
  return spans
}

/** The match containing the caret, else the next one at or after it, wrapping
 *  to the first match once the caret passes the last one. */
function currentMatchIndex(spans: SearchSpan[], anchor: number): number {
  if (spans.length === 0) return 0
  const index = spans.findIndex((span) => span.to > anchor)
  return index === -1 ? 0 : index
}

const sourceSearchField = StateField.define<SourceSearchState>({
  create: () => ({ open: false, query: buildQuery(''), spans: [] }),
  update(value, tr) {
    let { open, query } = value
    for (const effect of tr.effects) {
      if (effect.is(setSourceSearchOpen)) open = effect.value
      else if (effect.is(setSearchQuery)) query = effect.value
    }
    if (open === value.open && query.eq(value.query) && !tr.docChanged) return value
    // One full-document scan per query change or edit while the box is open;
    // closed search never scans.
    return { open, query, spans: open ? scanSpans(query, tr.newDoc) : [] }
  }
})

export function sourceSearchIsOpen(view: EditorView): boolean {
  return view.state.field(sourceSearchField).open
}

function highlighterClass(onSnapshot: (snapshot: SourceSearchSnapshot) => void) {
  return class {
    decorations: DecorationSet = Decoration.none
    private last: SourceSearchSnapshot = { open: false, current: 0, total: 0 }

    update(update: ViewUpdate) {
      const { open, spans } = update.state.field(sourceSearchField)
      const current = currentMatchIndex(spans, update.state.selection.main.anchor)
      if (open && spans.length > 0) {
        const builder = new RangeSetBuilder<Decoration>()
        spans.forEach((span, index) => {
          builder.add(span.from, span.to, index === current ? currentMark : matchMark)
        })
        this.decorations = builder.finish()
      } else {
        this.decorations = Decoration.none
      }
      const snapshot: SourceSearchSnapshot = { open, current, total: spans.length }
      if (
        snapshot.open !== this.last.open ||
        snapshot.current !== this.last.current ||
        snapshot.total !== this.last.total
      ) {
        this.last = snapshot
        onSnapshot({ ...snapshot })
      }
    }
  }
}

/** Search state and match highlighting for a source editor. The package's
 *  own highlighter stays dormant while its panel is closed, so decorations
 *  come from this plugin instead; the default keymap is not included. */
export function sourceSearchExtension(
  onSnapshot: (snapshot: SourceSearchSnapshot) => void
): Extension {
  return [
    searchPackage(),
    sourceSearchField,
    ViewPlugin.fromClass(highlighterClass(onSnapshot), {
      decorations: (value) => value.decorations
    })
  ]
}

export function openSourceSearch(view: EditorView): void {
  if (sourceSearchIsOpen(view)) return
  view.dispatch({ effects: setSourceSearchOpen.of(true) })
}

/** Closes the box, clears the query, and removes highlights without touching
 *  focus; used for the automatic close when a source tab is deactivated. */
export function closeSourceSearch(view: EditorView): void {
  if (!sourceSearchIsOpen(view)) return
  view.dispatch({ effects: [setSourceSearchOpen.of(false), setSearchQuery.of(buildQuery(''))] })
}

/** The user-initiated dismissal path (Escape, close button): focus returns to
 *  the text, with the caret wherever navigation last placed it (FR-008). */
export function closeSourceSearchAndRefocus(view: EditorView): void {
  closeSourceSearch(view)
  view.focus()
}

export function setSourceSearchQuery(view: EditorView, term: string): void {
  const query = buildQuery(term)
  view.dispatch({ effects: setSearchQuery.of(query) })
  if (!query.valid) return
  const { spans } = view.state.field(sourceSearchField)
  if (spans.length === 0) return
  // FR-004: place the caret on the current match for the new query. The
  // anchor is the selection as it stood before this query change, so typing a
  // longer query keeps the caret on the growing match instead of walking one
  // match forward per keystroke.
  const span = spans[currentMatchIndex(spans, view.state.selection.main.anchor)]
  view.dispatch({ selection: EditorSelection.single(span.from, span.to), scrollIntoView: true })
}

export function findNextSourceMatch(view: EditorView): void {
  // Guard: the package's find commands fall back to opening their default
  // panel when the query is invalid; a valid query with zero matches simply
  // does nothing.
  if (getSearchQuery(view.state).valid) findNextCommand(view)
}

export function findPreviousSourceMatch(view: EditorView): void {
  if (getSearchQuery(view.state).valid) findPreviousCommand(view)
}

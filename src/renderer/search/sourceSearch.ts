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
import { SearchQuery } from '@codemirror/search'

/** Glue between the shared SearchPanel and @codemirror/search for the source
 *  view (spec 056). The package's query engine does the scanning (literal,
 *  case-insensitive, whole-document); this module owns the search state, the
 *  highlight decorations, the counts, and the navigation. The package's own
 *  panel, keymap, state field, and find commands are not used: its highlighter
 *  stays dormant while its panel is closed, and its find commands both fall
 *  back to opening that panel and manage a match selection rather than a
 *  caret, which the spec's caret semantics (FR-004/008) rule out. */

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
const setSourceSearchQueryEffect = StateEffect.define<SearchQuery>()

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

/** The match the caret sits on (inclusive end, so a caret at a match's last
 *  character still counts as that match), else the next one at or after it,
 *  wrapping to the first match once the caret passes the last one. */
function currentMatchIndex(spans: SearchSpan[], caret: number): number {
  if (spans.length === 0) return 0
  let index = spans.findIndex((span) => span.from <= caret && caret <= span.to)
  if (index !== -1) return index
  index = spans.findIndex((span) => span.from > caret)
  return index === -1 ? 0 : index
}

/** First match ending after the anchor: the match containing it, else the
 *  next one at or after it, wrapping to the first match from the end. */
function nextMatchIndex(spans: SearchSpan[], anchor: number): number {
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
      else if (effect.is(setSourceSearchQueryEffect)) query = effect.value
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
      const current = currentMatchIndex(spans, update.state.selection.main.head)
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

/** Search state and match highlighting for a source editor. */
export function sourceSearchExtension(
  onSnapshot: (snapshot: SourceSearchSnapshot) => void
): Extension {
  return [
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
  view.dispatch({
    effects: [setSourceSearchOpen.of(false), setSourceSearchQueryEffect.of(buildQuery(''))]
  })
}

/** The user-initiated dismissal path (Escape, close button): focus returns to
 *  the text, with the caret wherever navigation last placed it (FR-008). */
export function closeSourceSearchAndRefocus(view: EditorView): void {
  closeSourceSearch(view)
  view.focus()
}

export function setSourceSearchQuery(view: EditorView, term: string): void {
  const query = buildQuery(term)
  view.dispatch({ effects: setSourceSearchQueryEffect.of(query) })
  if (!query.valid) return
  const { spans } = view.state.field(sourceSearchField)
  if (spans.length === 0) return
  // FR-004: place the caret on the current match for the new query. The
  // anchor is the selection as it stood before this query change, so typing a
  // longer query keeps the caret on the growing match instead of walking one
  // match forward per keystroke. The caret is collapsed at the match's end so
  // typing continues from it and can never replace the match.
  const span = spans[nextMatchIndex(spans, view.state.selection.main.head)]
  view.dispatch({ selection: EditorSelection.cursor(span.to), scrollIntoView: true })
}

/** Moves the caret to the neighbouring match, wrapping around at both ends
 *  (FR-006). The caret convention is "at a match's end", so next skips any
 *  match ending exactly at the caret and previous skips one ending after it. */
function navigateSourceMatch(view: EditorView, step: 1 | -1): void {
  const { spans } = view.state.field(sourceSearchField)
  if (spans.length === 0) return
  const caret = view.state.selection.main.head
  let index = -1
  if (step === 1) {
    index = spans.findIndex((span) => span.from > caret)
    if (index === -1) index = 0
  } else {
    for (let i = spans.length - 1; i >= 0; i--) {
      if (spans[i].to < caret) {
        index = i
        break
      }
    }
    if (index === -1) index = spans.length - 1
  }
  view.dispatch({ selection: EditorSelection.cursor(spans[index].to), scrollIntoView: true })
}

export function findNextSourceMatch(view: EditorView): void {
  navigateSourceMatch(view, 1)
}

export function findPreviousSourceMatch(view: EditorView): void {
  navigateSourceMatch(view, -1)
}

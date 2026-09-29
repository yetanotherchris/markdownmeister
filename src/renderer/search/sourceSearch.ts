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
import { isolateHistory } from '@codemirror/commands'
import { SearchQuery } from '@codemirror/search'
import { nonOverlapping } from './findMatches'

/** Glue between the shared SearchPanel and @codemirror/search for the source
 *  view (spec 056, extended by 061). The package's query engine does the
 *  scanning (literal, case-insensitive, whole-document); this module owns the
 *  search state, the highlight decorations, the counts, the navigation, and
 *  the replacement. The package's own panel, keymap, state field, and find
 *  commands are not used: its highlighter stays dormant while its panel is
 *  closed, and its find commands both fall back to opening that panel and
 *  manage a match selection rather than a caret, which the spec's caret
 *  semantics (FR-004/008) rule out.
 *
 *  Naming note: state accessors carry the `sourceSearch` prefix (mirroring the
 *  visual module's `visualSearchIsOpen`), while actions use the `...Source...`
 *  infix because the unprefixed names are taken by the visual module and the
 *  two are imported together in SourceView. */

export interface SourceSearchSnapshot {
  open: boolean
  /** Whether the replace row is revealed; false when the box is closed. */
  replaceOpen: boolean
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
const setSourceSearchReplaceOpenEffect = StateEffect.define<boolean>()
const setSourceSearchReplacementEffect = StateEffect.define<string>()

interface SourceSearchState {
  open: boolean
  replaceOpen: boolean
  query: SearchQuery
  replacement: string
  spans: SearchSpan[]
}

function emptyState(): SourceSearchState {
  return { open: false, replaceOpen: false, query: buildQuery(''), replacement: '', spans: [] }
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
  create: emptyState,
  update(value, tr) {
    let { open, replaceOpen, query, replacement } = value
    for (const effect of tr.effects) {
      if (effect.is(setSourceSearchOpen)) open = effect.value
      else if (effect.is(setSourceSearchQueryEffect)) query = effect.value
      else if (effect.is(setSourceSearchReplaceOpenEffect)) replaceOpen = effect.value
      else if (effect.is(setSourceSearchReplacementEffect)) replacement = effect.value
    }
    const unchanged =
      open === value.open &&
      replaceOpen === value.replaceOpen &&
      replacement === value.replacement &&
      query.eq(value.query) &&
      !tr.docChanged
    if (unchanged) return value
    // One full-document scan per query change or edit while the box is open;
    // closed search never scans.
    return { open, replaceOpen, query, replacement, spans: open ? scanSpans(query, tr.newDoc) : [] }
  }
})

export function sourceSearchIsOpen(view: EditorView): boolean {
  return view.state.field(sourceSearchField).open
}

function highlighterClass(onSnapshot: (snapshot: SourceSearchSnapshot) => void) {
  return class {
    decorations: DecorationSet = Decoration.none
    private last: SourceSearchSnapshot = { open: false, replaceOpen: false, current: 0, total: 0 }

    update(update: ViewUpdate) {
      const { open, replaceOpen, spans } = update.state.field(sourceSearchField)
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
      const snapshot: SourceSearchSnapshot = { open, replaceOpen, current, total: spans.length }
      if (
        snapshot.open !== this.last.open ||
        snapshot.replaceOpen !== this.last.replaceOpen ||
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

/** Closes the box, clears the query and replacement, and removes highlights
 *  without touching focus; used for the automatic close when a source tab is
 *  deactivated. */
export function closeSourceSearch(view: EditorView): void {
  if (!sourceSearchIsOpen(view)) return
  view.dispatch({
    effects: [
      setSourceSearchOpen.of(false),
      setSourceSearchQueryEffect.of(buildQuery('')),
      setSourceSearchReplaceOpenEffect.of(false),
      setSourceSearchReplacementEffect.of('')
    ]
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

export function setSourceSearchReplaceOpen(view: EditorView, open: boolean): void {
  view.dispatch({ effects: setSourceSearchReplaceOpenEffect.of(open) })
}

export function setSourceSearchReplacement(view: EditorView, text: string): void {
  view.dispatch({ effects: setSourceSearchReplacementEffect.of(text) })
}

/** Replaces the current match only, then moves the caret onto the first
 *  remaining match after the inserted text (FR-004). No-op while nothing
 *  matches or the box is closed. */
export function replaceCurrentSourceMatch(view: EditorView): void {
  const state = view.state.field(sourceSearchField)
  if (!state.open || !state.query.valid || state.spans.length === 0) return
  const span = state.spans[currentMatchIndex(state.spans, view.state.selection.main.head)]
  const insert = state.replacement
  const end = span.from + insert.length
  // The post-change spans are computed from the document we are about to
  // create, so the caret can be placed on the next match in the same
  // transaction instead of briefly resting on the text just inserted.
  const newDoc = view.state.doc.replace(span.from, span.to, view.state.toText(insert))
  const remaining = scanSpans(state.query, newDoc)
  const target = remaining.find((candidate) => candidate.from >= end) ?? remaining[0]
  view.dispatch({
    changes: { from: span.from, to: span.to, insert },
    selection: EditorSelection.cursor(target ? target.to : end),
    scrollIntoView: true,
    annotations: isolateHistory.of('full')
  })
}

/** Replaces every non-overlapping occurrence in one action (FR-005, FR-017)
 *  as a single undo step. The replacement text is never re-scanned, so a
 *  replacement containing the query is not replaced again (FR-008). */
export function replaceAllSourceMatches(view: EditorView): void {
  const state = view.state.field(sourceSearchField)
  if (!state.open || !state.query.valid) return
  const kept = nonOverlapping(state.spans)
  if (kept.length === 0) return
  const changeSet = view.state.changes(
    kept.map((span) => ({ from: span.from, to: span.to, insert: state.replacement }))
  )
  const remaining = scanSpans(state.query, changeSet.apply(view.state.doc))
  const target = remaining[0]
  view.dispatch({
    changes: changeSet,
    selection: target ? EditorSelection.cursor(target.to) : undefined,
    scrollIntoView: target != null,
    annotations: isolateHistory.of('full')
  })
}

/** Moves the caret to the neighbouring match, wrapping around at both ends
 *  (FR-006). The caret convention is "at a match's end", so next takes the
 *  first match starting after the caret and previous takes the last match
 *  ending strictly before it. */
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

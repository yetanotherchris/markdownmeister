# Research: Search Box for Source Editing

**Feature**: specs/056-source-view-search | **Date**: 2026-09-02

Findings that resolve the plan's open questions, with the evidence and the rejected alternatives.

## R1. The source editor's own ecosystem ships a maintained search package

**Decision**: Add `@codemirror/search` (6.7.x) and drive it programmatically.

**Evidence**: The npm registry lists `@codemirror/search` 6.7.2, described as "Search functionality for the CodeMirror code editor", MIT-licensed, depending only on `@codemirror/view` and `@codemirror/state`, which the source view already uses. The package is already present in the dependency tree as a transitive dependency of the editor stack, so promoting it to a direct dependency adds zero new packages. The source view is otherwise plain text, so a general text search engine is exactly what the package provides.

**Alternatives rejected**:

- _Reusing spec 055's ProseMirror matcher over the source text_: duplicates a maintained package's core work and loses the package's selection/caret integration.
- _Hand-rolling search over the editor state_: same duplication, plus highlight and wrap edge cases the package already solved.

**Dependency justification** (constitution: dependencies must be justified): one package, from the same upstream family as the four CodeMirror packages already in use, replacing a nontrivial amount of hand-written search code. This is the plan's single new dependency.

## R2. The package's query engine is driven programmatically; its panel, state field, and find commands are not used

**Decision**: Build the query with the package's query type (literal, case-insensitive) and scan with `query.getCursor`; the glue owns the search state (a small CodeMirror StateField holding open flag, query, and the match spans), the highlight decorations, the counts, and the navigation. The panel above the source text is the app's own shared `SearchPanel`, not the package's built-in panel.

**Evidence** (read from the installed `@codemirror/search` 6.7.1 `dist/index.cjs` and `dist/index.d.ts`, task 1.1 verification obligation):

- `search(config?)` installs exactly `[searchState field, Prec.low(searchHighlighter), baseTheme]`. It ships **no keymap**; `searchKeymap` is a separate export that is only active if the host adds it. Not registering it (R4) is the default, so the find shortcut cannot double-handle.
- The package's `searchHighlighter` returns `Decoration.none` unless its own panel is open (`if (!panel || !query.spec.valid) return Decoration.none`). Since the app never opens that panel, **match highlighting is not automatic**: the glue adds its own decoration marks (`cm-searchMatch`, plus a distinct current-match class) driven by its own match scan.
- `new SearchQuery({ search, caseSensitive: false, literal: true, regexp: false })` gives the required matching semantics: `literal: true` keeps markdown characters (asterisks, brackets, backslashes) matched literally instead of unquoted, and an empty `search` makes the query `valid: false`, which the glue treats as "no active query" (no highlights, zero matches).
- `query.getCursor(doc)` iterates `{ from, to }` over the whole document; the glue uses one full-document scan per query change or edit while the box is open, and never scans while it is closed.

**Why the package's state field and find commands were dropped** (found during implementation, replacing the initial "drive it via `setSearchQuery` + `findNext`/`findPrevious`" approach): the glue placed a collapsed caret (the spec's FR-004/008 caret semantics), and the package's commands are selection-based and assume their own range selection. `findPrevious` recomputes its search start from `selection.main.from`, so with a caret at a match's end it re-finds the same match instead of stepping back; and both commands fall back to `openSearchPanel` when the query is invalid. Navigation over the glue's own span array is a few lines, removes the panel-fallback hazard, and keeps one caret-placement path for query changes and navigation alike. The package is still what does the actual scanning work (R1).

**Alternatives rejected**:

- _Using the package's default panel_: foreign UI, inconsistent with the visual view's search box, and a second focus/Escape behaviour to reconcile with the app.
- _Relying on the package's built-in highlighter_: it is panel-gated and would force opening the foreign UI.
- _Keeping the package's find commands and collapsing their selection afterwards_: `findPrevious` then steps onto the same match (boundary condition above), so navigation would need its own span logic anyway.

## R3. Caret placement is the glue's; search caret movements are collapsed and selection-only

**Decision**: The glue places a collapsed caret at the current match's end on query changes and on navigation. Search-driven caret movements are plain selection-only transactions, so the document, its dirty state, and the undo history are untouched (FR-009).

**Evidence**: The source view already reports selection changes upward through its coalesced context capture (src/renderer/editor/SourceView.tsx selection reporting), which is the same path every user caret movement takes. A selection moved by search is therefore indistinguishable from a user's movement for all existing bookkeeping, including the caret context kept for switching back to the visual view (archived spec 052).

**Refinements found during implementation**:

- The caret is collapsed at the match's **end** because a collapsed caret is what the spec means by "the text caret is placed at it so editing can continue from that spot": typing then appends and can never replace a matched word (constitution Principle III). The end (not the start) is what keeps stepping forward natural: the next match is the first one starting after the caret.
- While the box is open, the per-keystroke selection/scroll updates suspend the source view's context capture (the store write that feeds caret sync). Capturing per keystroke re-rendered the whole app on every character, and the explorer's row focus effect then stole the panel input's focus mid-typing. The context is captured once on close, deactivation, or the next non-search event, so nothing is lost.
- Query changes anchor at the selection as it stood before the query change (typing a longer query keeps the caret on the growing match instead of walking one match forward per keystroke).
- The glue asserts in unit tests that search dispatches selection-only transactions so the dirty state cannot flip (FR-009); that assertion is a test, not a convention.

## R4. The shortcut shares spec 055's route; the package keymap must not double-handle it

**Decision**: The find command arrives through the main-process shortcut added in spec 055 and is routed to the source host when the source view is active. The package's default keymap entry for the find shortcut is not registered in the source view's keymap.

**Evidence**: Application shortcuts flow through the main-process shortcut table and the `'menu:command'` route (src/main/shortcuts.ts, src/renderer/hooks/useMenuCommands.ts); registering the package's own keymap binding would create a second handler racing the first.

## R5. Frontmatter is searched with no extra work

**Decision**: Search covers the full displayed text.

**Evidence**: The source view renders the joined frontmatter and body as one text document, so the search package sees the frontmatter like any other text and FR-011 holds by construction.

## R6. Word wrap is orthogonal

**Decision**: No interaction between search and the word wrap compartment.

**Evidence**: Word wrap is configured through the source view's existing compartment (src/renderer/editor/SourceView.tsx:134-139) and affects only line layout; highlight decorations and find commands operate on text positions independent of wrapping. The only obligation is e2e coverage with wrap on and off so the guarantee is pinned (FR-013).

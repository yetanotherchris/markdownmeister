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

## R2. The package is driven programmatically; its default panel UI is not used

**Decision**: Build the query with the package's query type (literal, case-insensitive), apply it via its state effect, and navigate with its find-next/find-previous commands; the panel above the source text is the app's own shared `SearchPanel`, not the package's built-in panel. Match highlighting is provided by a small decoration plugin in the glue module, because the package's own highlighter is dormant while its panel is closed.

**Evidence** (read from the installed `@codemirror/search` 6.7.1 `dist/index.cjs` and `dist/index.d.ts`, task 1.1 verification obligation):

- `search(config?)` installs exactly `[searchState field, Prec.low(searchHighlighter), baseTheme]`. It ships **no keymap**; `searchKeymap` is a separate export that is only active if the host adds it. Not registering it (R4) is the default, so the find shortcut cannot double-handle.
- The package's `searchHighlighter` returns `Decoration.none` unless its own panel is open (`if (!panel || !query.spec.valid) return Decoration.none`). Since the app never opens that panel, **match highlighting is not automatic**: the glue adds its own decoration marks (`cm-searchMatch`, plus a distinct current-match class) driven by the same query state.
- The query is applied with `setSearchQuery.of(new SearchQuery({ search, caseSensitive: false, literal: true, regexp: false }))`: `literal: true` keeps markdown characters (asterisks, brackets, backslashes) matched literally instead of unquoted, and an empty `search` makes the query `valid: false`, which the glue treats as "no active query" (no highlights, zero matches).
- `findNext`/`findPrevious` dispatch `selection` + a screen-reader announcement effect + `EditorView.scrollIntoView` with `userEvent: "select.search"`. They change no document text. Caveat: both are wrapped in `searchCommand`, which falls back to `openSearchPanel` when the search state is missing or the query is invalid, so the glue must only call them while a valid query with at least one match exists.
- `query.getCursor(state)` iterates `{ from, to }` over the whole document; the glue uses one full-document scan per query change for counts and decorations.

**Alternatives rejected**:

- _Using the package's default panel_: foreign UI, inconsistent with the visual view's search box, and a second focus/Escape behaviour to reconcile with the app.
- _Relying on the package's built-in highlighter_: it is panel-gated and would force opening the foreign UI.

## R3. Caret placement comes free from the find commands

**Decision**: Let the package's find-next/find-previous commands move the editor selection to the current match; do not manage caret positions separately.

**Evidence**: The source view already reports selection changes upward through its coalesced context capture (src/renderer/editor/SourceView.tsx selection reporting), which is the same path every user caret movement takes. A selection moved by search is therefore indistinguishable from a user's movement for all existing bookkeeping, including the caret context kept for switching back to the visual view (archived spec 052).

**Refinement found during implementation**: the package's `findNext` searches from the end of the current selection, so driving it per keystroke while the user types a query walks one match forward per character. Query changes therefore place the caret from the glue's own match scan, anchored at the selection as it stood before the query change (typing a longer query keeps the caret on the growing match); the package's find commands still own next/previous navigation, where stepping forward is exactly what is wanted. Both paths dispatch plain selection-only transactions, so the reporting path and the dirty-state guarantee are unchanged. The glue must still assert that search dispatches selection-only transactions so the dirty state cannot flip (FR-009); that assertion is a unit/e2e test, not a convention.

## R4. The shortcut shares spec 055's route; the package keymap must not double-handle it

**Decision**: The find command arrives through the main-process shortcut added in spec 055 and is routed to the source host when the source view is active. The package's default keymap entry for the find shortcut is not registered in the source view's keymap.

**Evidence**: Application shortcuts flow through the main-process shortcut table and the `'menu:command'` route (src/main/shortcuts.ts, src/renderer/hooks/useMenuCommands.ts); registering the package's own keymap binding would create a second handler racing the first.

## R5. Frontmatter is searched with no extra work

**Decision**: Search covers the full displayed text.

**Evidence**: The source view renders the joined frontmatter and body as one text document, so the search package sees the frontmatter like any other text and FR-011 holds by construction.

## R6. Word wrap is orthogonal

**Decision**: No interaction between search and the word wrap compartment.

**Evidence**: Word wrap is configured through the source view's existing compartment (src/renderer/editor/SourceView.tsx:134-139) and affects only line layout; highlight decorations and find commands operate on text positions independent of wrapping. The only obligation is e2e coverage with wrap on and off so the guarantee is pinned (FR-013).

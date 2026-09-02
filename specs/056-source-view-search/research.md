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

**Decision**: Build the query with the package's query type (literal, case-insensitive), apply it via its state effect, and navigate with its find-next/find-previous commands; the panel above the source text is the app's own shared `SearchPanel`, not the package's built-in panel.

**Evidence**: The package separates its search engine (query, effects, find commands) from its default panel UI, so the UI can be replaced wholesale. The app needs one consistent search box across both views (spec assumption), and the package's default panel brings its own styling, keymap, and close behaviour that would fight the app's chrome.

**Verification obligation**: The exact export names and effect shapes must be read from the installed package's type definitions during implementation (task 1.1) before wiring; this plan records the package's existence and role, not a memorised API. One specific open point to resolve there: whether match highlighting is automatic once the query effect is applied or requires the package's explicit highlight control; wire whichever the types show and record the finding in this file.

**Alternatives rejected**:

- _Using the package's default panel_: foreign UI, inconsistent with the visual view's search box, and a second focus/Escape behaviour to reconcile with the app.

## R3. Caret placement comes free from the find commands

**Decision**: Let the package's find-next/find-previous commands move the editor selection to the current match; do not manage caret positions separately.

**Evidence**: The source view already reports selection changes upward through its coalesced context capture (src/renderer/editor/SourceView.tsx selection reporting), which is the same path every user caret movement takes. A selection moved by search is therefore indistinguishable from a user's movement for all existing bookkeeping, including the caret context kept for switching back to the visual view (archived spec 052).

**Consequence**: FR-004 (caret on the current match) and "behaves like any caret movement" hold without new state. The glue module must still assert that search dispatches selection-only transactions so the dirty state cannot flip (FR-009); that assertion is a unit/e2e test, not a convention.

## R4. The shortcut shares spec 055's route; the package keymap must not double-handle it

**Decision**: The find command arrives through the main-process shortcut added in spec 055 and is routed to the source host when the source view is active. The package's default keymap entry for the find shortcut is not registered in the source view's keymap.

**Evidence**: Application shortcuts flow through the main-process shortcut table and the `'menu:command'` route (src/main/shortcuts.ts, src/renderer/hooks/useMenuCommands.ts); registering the package's own keymap binding would create a second handler racing the first.

## R5. Frontmatter is searched with no extra work

**Decision**: Search covers the full displayed text.

**Evidence**: The source view renders the joined frontmatter and body as one text document, so the search package sees the frontmatter like any other text and FR-011 holds by construction.

## R6. Word wrap is orthogonal

**Decision**: No interaction between search and the word wrap compartment.

**Evidence**: Word wrap is configured through the source view's existing compartment (src/renderer/editor/SourceView.tsx:134-139) and affects only line layout; highlight decorations and find commands operate on text positions independent of wrapping. The only obligation is e2e coverage with wrap on and off so the guarantee is pinned (FR-013).

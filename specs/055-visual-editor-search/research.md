# Research: Search Box for Visual Editing

**Feature**: specs/055-visual-editor-search | **Date**: 2026-09-02

Findings that resolve the plan's open questions, with the evidence and the rejected alternatives. Line references are against the tree at the time of writing.

## R1. No search exists to build on, and no new dependency is warranted

**Decision**: Build the search as a small in-repo plugin over the editor's existing foundation.

**Evidence**: The renderer has no find/search feature anywhere today (a scan of `src/` for find/search/match/query surfaces nothing), the editor stack has no search package (`@codemirror/search` is not even installed), and the visual editor exposes no search capability of its own. The highlighting primitive needed (decorations) already ships inside the editor stack via prosemirror-view as a transitive dependency.

**Alternatives rejected**:

- _A third-party ProseMirror search package_: the candidates are thinly maintained, and the required code is small and pure; adding a dependency for it contradicts the constitution's preference for existing dependencies.

## R2. Decorations, not document edits

**Decision**: The plugin highlights matches with inline decorations and never touches the document.

**Evidence**: prosemirror-view provides `Decoration` and `DecorationSet`; inline decorations wrap rendered text without changing the document model, so undo history, dirty tracking, and round-trip saving are untouched by construction. The plugin state holds the query and the match positions and recomputes on document changes and on a query-set effect, but only while a search is active. The exact decoration API surface must be verified against the installed type definitions during implementation (task 2.1) rather than trusted from memory.

**Consequence**: FR-009 (search never changes content, dirty state, or undo) holds by construction, not by discipline.

## R3. Match computation is per-block concatenation with a boundary sentinel

**Decision**: For each top-level block, concatenate its text content, run a case-insensitive literal scan over that string, and map match offsets back through the block's text nodes to document positions. The concatenation joins segments with a sentinel character that cannot occur in the text or be typed in the query, so a query can match across inline formatting boundaries inside a paragraph but can never match across block boundaries.

**Evidence**: A query like "bold end" must find its target when the phrase crosses inline nodes (for example an emphasis boundary) within one paragraph, so per-text-node scanning alone is insufficient. Scanning the whole document as one string would produce false matches spanning separate blocks (a heading ending "in" and a paragraph starting "time" would match "in time"), which the sentinel prevents.

**Alternatives rejected**:

- _Per-text-node scanning only_: misses the common cross-inline-node phrase, failing FR-011's spirit.
- _Whole-document concatenation_: false cross-block matches, which a user reads as a wrong highlight.

## R4. The shortcut rides the existing menu command channel

**Decision**: Register the find shortcut in the main process shortcut table and deliver it to the renderer as an existing-style command; the renderer routes it to the active document's visual host.

**Evidence**: Application shortcuts are already registered in the main process via `before-input-event` (src/main/shortcuts.ts:47-58) and delivered as `'menu:command'`, routed by `useMenuCommands` (src/renderer/hooks/useMenuCommands.ts:25-77); every existing shortcut (save, open, close tab) works this way. Adding a second mechanism for Ctrl/Cmd+F would create two shortcut paths to keep in sync.

**Alternatives rejected**:

- _Renderer-level key capture inside the editor_: races the main-process handler and would not fire when the editor is not focused.

**Consequence**: Spec 056 (source view search) must use the same route so both views share one shortcut mechanism; the command router distinguishes the target by the active view.

## R5. Cost is one linear scan per keystroke, only while the box is open

**Decision**: Recompute all matches from scratch on each query change and each document change while the search is active; no incremental index.

**Evidence**: The matcher is O(document text) per recomputation; for a 10,000-line document (a few hundred kilobytes of text) a scan is far inside the imperceptibility budget, and it runs only while the box is open. With the box closed the plugin holds no state and does no work.

**Alternatives rejected**:

- _An incremental match index updated on every edit_: state to keep consistent across every edit path (typing, paste, undo, reload, external change) for zero user-visible gain, since a fresh scan is already fast enough.

# Tasks: Caret Line Sync Between Editing Views

## Phase 1: Mapping domain (R2, R3, FR-001/002/005)

- [x] 1.1 Write unit tests `tests/renderer/domain/caretSync.test.ts`: block table spans (heading, paragraph, list, quote, code, frontmatter offset), top-level index at offset (boundary, doc end, empty), `planSourceSeed` (mapped anchor, count-mismatch fallback, empty body), `planVisualRestore` (frontmatter clamp, gap nearest with tie to following block, trailing clamp, mid-block), `planReturnRestore` (untouched exact, moved, edited)
- [x] 1.2 Implement `src/renderer/domain/caretSync.ts`: `buildBlockTable` (one remark parse of the displayed text, frontmatter length carried separately), `topLevelBlockIndex`, `planSourceSeed`, `planVisualRestore`, `planReturnRestore`; any failure returns null, never throws
- [x] 1.3 Verify: `npm run test -- caretSync`

## Phase 2: State support (R4, FR-003/004/006/007)

- [x] 2.1 Extend `tests/renderer/documents.view.test.ts`: SEED_SOURCE_CONTEXT writes selection, scroll, and seed without touching dirty or revision; PRIME_VISUAL_CARET sets the mapped block; CLEAR_VISUAL_CARET consumes it; RELOAD and EVICT clear primed sync and neutralize the seed; openFile seeds the initial source context
- [x] 2.2 Implement in `src/renderer/state/documents.ts`: optional `sourceSeed` and `cursorSync` on `DocumentState`, three new actions, default seed on open/new, seed on the open-existing view flip to source, clear on RELOAD/EVICT
- [x] 2.3 Verify: `npm run test -- documents.view`

## Phase 3: Block-index caret restore (R5)

- [x] 3.1 Extend `tests/renderer/cursorRestore.test.ts`: `planBlockRestore` resolves each top-level block to a valid inline selection, rejects count mismatches and empty docs
- [x] 3.2 Implement `planBlockRestore` in `src/renderer/editor/cursorRestore.ts` (boundary offset by child sizes, `TextSelection.near`)
- [x] 3.3 Verify: `npm run test -- cursorRestore`

## Phase 4: Switch wiring (R1, R4, R5)

- [x] 4.1 `instancePool.getSelectionGeometry`: live selection anchor plus top-level child sizes without serializing
- [x] 4.2 `useDocumentSession.captureContentForSwitch` returns the text the source view will display (captured or stored), null when serialization fails
- [x] 4.3 `useSourceViewToggle`: seed the source context on both entry paths (mapped when the pool provides geometry and the parse correlates, stored otherwise); on return, apply `planReturnRestore` and dispatch PRIME before any refresh, preserving today's refresh decision
- [x] 4.4 `SourceView`: optional reveal that scrolls the seeded caret into view on mount or first activation instead of applying the stored scroll
- [x] 4.5 `CrepeHost` applies a primed block restore ahead of the stored offset and reports consumption; `EditorPanel` and `App` pass the sync fields and clear the prime
- [x] 4.6 Verify: `npm run typecheck` and `npm run lint`

## Phase 5: E2E scenarios

- [x] 5.1 Write `tests/e2e/caret-sync.spec.ts`: visual caret in a mid-document paragraph maps to a line of that paragraph in source (FR-001); caret in a heading/list/quote/code block maps into that block (FR-002); round trip without touching the source caret restores the visual caret and scroll exactly (FR-003); moving the source caret to a distant block maps the visual caret into that block (FR-004); editing in source keeps the edit and lands in the caret's block (FR-004)
- [x] 5.2 Build and run: `npm run test:e2e -- caret-sync`, iterate to green without weakening path or data-loss guarantees

## Phase 6: Full verification and archive

- [x] 6.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`
- [x] 6.2 Append new files to `scripts.format:check`; `npx prettier --check` touched files
- [x] 6.3 Archive: `git mv specs/052-caret-line-sync specs/archive/052-caret-line-sync`, set Status Archived

## Phase 7: Review fixes (findings from the five PR reviews)

- [x] 7.1 Critical: map CRLF documents in CodeMirror's LF-normalized offset space (`normalizeCaretText` in caretSync.ts); seeded anchors and return offsets no longer drift one byte per line, and out-of-range anchors cannot throw in the source mount; unit tests for the CRLF offset spaces
- [x] 7.2 Major: reveal the mapped caret in the visual host explicitly (`revealCaretInView`), since ProseMirror's transaction scrollIntoView does not reach the scrollable host in this layout; e2e now asserts the returned caret is on screen
- [x] 7.3 Major: hook-level tests for the switch glue (`tests/renderer/sourceViewToggleSync.test.tsx`): mapped entry, count-mismatch fallback, untouched return, moved return, normalization-vs-edit distinction, edited return
- [x] 7.4 Major/minor: e2e coverage for frontmatter entry and return (US1-3/US1-4/US3-2), a CRLF document, and a table block (FR-002)
- [x] 7.5 Minor: consume a refused `cursorSync` prime so it cannot fire on a later activation; re-arm the SourceView reveal under StrictMode; simplify SEED_SOURCE_CONTEXT to carry only the seed; `storedSeed` helper; import the domain `VisualRestorePlan` type in CrepeHost; update research.md R5 to record the implemented shape

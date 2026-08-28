# Tasks: Caret Line Sync Between Editing Views

## Phase 1: Mapping domain (R2, R3, FR-001/002/005)

- [x] 1.1 Write unit tests `tests/renderer/domain/caretSync.test.ts`: block table spans (heading, paragraph, list, quote, code, frontmatter offset), top-level index at offset (boundary, doc end, empty), `planSourceSeed` (mapped anchor, count-mismatch fallback, empty body), `planVisualRestore` (frontmatter clamp, gap nearest with tie to following block, trailing clamp, mid-block), `planReturnRestore` (untouched exact, moved, edited)
- [x] 1.2 Implement `src/renderer/domain/caretSync.ts`: `buildBlockTable` (one remark parse of the displayed text, frontmatter length carried separately), `topLevelBlockIndex`, `planSourceSeed`, `planVisualRestore`, `planReturnRestore`; any failure returns null, never throws
- [x] 1.3 Verify: `npm run test -- caretSync`

## Phase 2: State support (R4, FR-003/004/006/007)

- [ ] 2.1 Extend `tests/renderer/documents.view.test.ts`: SEED_SOURCE_CONTEXT writes selection, scroll, and seed without touching dirty or revision; PRIME_VISUAL_CARET sets the mapped block; CLEAR_VISUAL_CARET consumes it; RELOAD and EVICT clear primed sync and neutralize the seed; openFile seeds the initial source context
- [ ] 2.2 Implement in `src/renderer/state/documents.ts`: optional `sourceSeed` and `cursorSync` on `DocumentState`, three new actions, default seed on open/new, seed on the open-existing view flip to source, clear on RELOAD/EVICT
- [ ] 2.3 Verify: `npm run test -- documents.view`

## Phase 3: Block-index caret restore (R5)

- [ ] 3.1 Extend `tests/renderer/cursorRestore.test.ts`: `planBlockRestore` resolves each top-level block to a valid inline selection, rejects count mismatches and empty docs
- [ ] 3.2 Implement `planBlockRestore` in `src/renderer/editor/cursorRestore.ts` (boundary offset by child sizes, `TextSelection.near`)
- [ ] 3.3 Verify: `npm run test -- cursorRestore`

## Phase 4: Switch wiring (R1, R4, R5)

- [ ] 4.1 `instancePool.getSelectionGeometry`: live selection anchor plus top-level child sizes without serializing
- [ ] 4.2 `useDocumentSession.captureContentForSwitch` returns the text the source view will display (captured or stored), null when serialization fails
- [ ] 4.3 `useSourceViewToggle`: seed the source context on both entry paths (mapped when the pool provides geometry and the parse correlates, stored otherwise); on return, apply `planReturnRestore` and dispatch PRIME before any refresh, preserving today's refresh decision
- [ ] 4.4 `SourceView`: optional reveal that scrolls the seeded caret into view on mount or first activation instead of applying the stored scroll
- [ ] 4.5 `CrepeHost` applies a primed block restore ahead of the stored offset and reports consumption; `EditorPanel` and `App` pass the sync fields and clear the prime
- [ ] 4.6 Verify: `npm run typecheck` and `npm run lint`

## Phase 5: E2E scenarios

- [ ] 5.1 Write `tests/e2e/caret-sync.spec.ts`: visual caret in a mid-document paragraph maps to a line of that paragraph in source (FR-001); caret in a heading/list/quote/code block maps into that block (FR-002); round trip without touching the source caret restores the visual caret and scroll exactly (FR-003); moving the source caret to a distant block maps the visual caret into that block (FR-004); editing in source keeps the edit and lands in the caret's block (FR-004)
- [ ] 5.2 Build and run: `npm run test:e2e -- caret-sync`, iterate to green without weakening path or data-loss guarantees

## Phase 6: Full verification and archive

- [ ] 6.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`
- [ ] 6.2 Append new files to `scripts.format:check`; `npx prettier --check` touched files
- [ ] 6.3 Archive: `git mv specs/052-caret-line-sync specs/archive/052-caret-line-sync`, set Status Archived

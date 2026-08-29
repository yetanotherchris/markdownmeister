# Tasks: View-Switching Caret Sync and Word Wrap Toggle Fixes

## Phase 1: Lenient source-entry correlation (FR-001/002, US1)

- [ ] 1.1 Write unit tests `tests/renderer/domain/caretSync.test.ts`: `planSourceSeed` with `trailingEmptyParagraph` correlating a doc ending in a list (caret in a mid-doc block maps to that block, caret in the trailing artifact maps to the last real block); leniency refused when the counts differ by more than one; leniency refused when `trailingEmptyParagraph` is false and the counts mismatch (today's fallback); empty-body fallback unchanged
- [ ] 1.2 Implement in `src/renderer/domain/caretSync.ts`: `planSourceSeed` accepts `trailingEmptyParagraph?: boolean`; when true and `childSizes.length === table.blocks.length + 1`, correlate against `childSizes.slice(0, -1)`; all other paths unchanged, failures return null
- [ ] 1.3 Verify: `npm run test -- caretSync`

## Phase 2: Geometry reports the artifact (FR-002, US1)

- [ ] 2.1 Extend `instancePool.getSelectionGeometry` in `src/renderer/editor/instancePool.ts` to also return `trailingEmptyParagraph` (last child `type.name === 'paragraph' && nodeSize === 2`)
- [ ] 2.2 Update `tests/renderer/sourceViewToggleSync.test.tsx` stub editor to expose child `type` names and add a mapped-entry case with a trailing empty paragraph; update `useSourceViewToggle.ts` to pass `trailingEmptyParagraph` into `planSourceSeed`
- [ ] 2.3 Verify: `npm run test -- sourceViewToggleSync`

## Phase 3: Return-path restore accepts the artifact (FR-003/004, US2)

- [ ] 3.1 Extend `tests/renderer/cursorRestore.test.ts`: `planBlockRestore` accepts `doc.childCount === blockCount + 1` when the trailing child is an empty paragraph; refuses when the extra trailing child is not an empty paragraph; existing count-mismatch refusals unchanged
- [ ] 3.2 Implement the widened check in `planBlockRestore` in `src/renderer/editor/cursorRestore.ts`
- [ ] 3.3 Verify: `npm run test -- cursorRestore`

## Phase 4: Word Wrap grey off-state (FR-005/006, US3)

- [ ] 4.1 Update `src/renderer/editor/editor.css`: `.source-word-wrap` off background becomes `var(--mm-surface-secondary)`; keep the accent `[aria-pressed='true']` state and a distinct hover
- [ ] 4.2 Update `tests/e2e/word-wrap.spec.ts` to assert the off-state background is the grey surface and the on-state remains the accent
- [ ] 4.3 Verify: `npm run test:e2e -- word-wrap`

## Phase 5: E2E scenarios for trailing-block documents (US1/US2)

- [ ] 5.1 Write `tests/e2e/caret-sync.spec.ts` additions: long doc ending in a list with the caret in a mid-doc paragraph maps to that paragraph on entry (FR-001); a doc ending in a table and a doc ending in a code block map into the containing block (FR-001/002); moving the source caret to a distant block in a list-ending doc maps the return into that block and reveals it (FR-003); an untouched round trip on a list-ending doc restores exactly (FR-003)
- [ ] 5.2 Build and run: `npm run test:e2e -- caret-sync`, iterate to green without weakening path or data-loss guarantees

## Phase 6: Full verification and archive

- [ ] 6.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`
- [ ] 6.2 Append new/changed files to `scripts.format:check`; `npx prettier --check` touched files
- [ ] 6.3 Remove the temporary diagnostic spec `tests/e2e/zz-diagnostic.spec.ts`
- [ ] 6.4 Archive: `git mv specs/053-view-sync-fixes specs/archive/053-view-sync-fixes`, set Status Archived
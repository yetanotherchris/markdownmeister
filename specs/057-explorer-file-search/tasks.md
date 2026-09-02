# Tasks: File Explorer Search

## Phase 1: Predicate and restore helpers (R2, R3, FR-003/006/008)

- [ ] 1.1 Write unit tests `tests/renderer/explorerSearch.test.ts`: case-insensitive substring on the name only; a folder matching does not surface children unless they match (FR-006); empty and whitespace-only terms mean no filtering; open-state snapshot/restore round-trips; selection restore
- [ ] 1.2 Implement `src/renderer/explorer/explorerSearch.ts`: the match predicate (name field only) and the open-state/selection snapshot and reapply helpers; pure, never throws
- [ ] 1.3 Verify: `npm run test -- explorerSearch`

## Phase 2: Input and tree wiring (R1, R3, R5, FR-001/002/004/005/009/013/014)

- [ ] 2.1 Verify against the installed react-arborist behaviour whether clearing the term restores the pre-filter open state; if not, wire the snapshot/reapply helpers; record the finding in research.md R3
- [ ] 2.2 Add the labelled search input row above the tree in `src/renderer/explorer/Tree.tsx` with term state in the explorer container; pass `searchTerm`/`searchMatch` to the tree
- [ ] 2.3 Implement Escape (clear term, restore, focus the tree) and a clear control; a whitespace-only term counts as no filter
- [ ] 2.4 Add the calm empty-state message shown when nothing matches (FR-009); ensure the term resets on workspace change and restart (FR-013)
- [ ] 2.5 Verify: `npm run typecheck` and `npm run lint`

## Phase 3: E2E scenarios

- [ ] 3.1 Write `tests/e2e/explorer-search.spec.ts`: live filtering on typing (US1); matches inside collapsed folders become visible with ancestors shown (FR-004); non-matching entries hidden (FR-005); folder-name match shows the folder only (FR-006); no-match empty state (FR-009); activating a match opens the file exactly as unfiltered activation does, including duplicate-tab focus (US3/FR-010); activating a matching folder focuses and expands it like unfiltered activation (FR-011); clearing restores expansion and selection exactly (US2/FR-008); Escape clears and refocuses the tree (FR-014); existing create/rename/delete flows still work while filtered; a large generated workspace (thousands of entries) filters without perceptible lag (FR-012/SC-002)
- [ ] 3.2 Build and run: `npm run test:e2e -- explorer-search`, iterate to green

## Phase 4: Full verification and archive

- [ ] 4.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`
- [ ] 4.2 Append new source/test files to `scripts.format:check`; `npx prettier --check` touched files
- [ ] 4.3 Archive: `git mv specs/057-explorer-file-search specs/archive/057-explorer-file-search`, set Status Archived

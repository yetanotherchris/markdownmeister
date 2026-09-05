# Tasks: File Explorer Search

## Phase 1: Predicate and empty-state helpers (R2, R3, FR-003/005/006/009)

- [X] 1.1 Write unit tests `tests/renderer/explorerSearch.test.ts`: case-insensitive substring on the name only; a folder name matching reports a match even when its children do not (FR-006); empty and whitespace-only terms mean no filtering; no-match case for the empty state
- [X] 1.2 Implement `src/renderer/explorer/explorerSearch.ts`: the match predicate (name field only) and the no-match check used for the empty state; pure, never throws. Per the R3 finding the open-state snapshot/reapply is not needed (the library restores it); selection snapshot/restore lives in the Tree transition effect and is pinned by e2e, not unit tests
- [X] 1.3 Verify: `npm run test -- explorerSearch`

## Phase 2: Input and tree wiring (R1, R3, R5, FR-001/002/004/005/009/013/014)

- [X] 2.1 Verify against the installed react-arborist behaviour whether clearing the term restores the pre-filter open state: verified from the package source that the open slice keeps separate unfiltered/filtered maps and the provider clears only the filtered map on an empty term, so open state restores automatically and the snapshot/reapply helpers are not wired; recorded in research.md R3
- [X] 2.2 Add the labelled search input row above the tree in `src/renderer/explorer/Tree.tsx` with term state in App.tsx; pass `searchTerm`/`searchMatch` to the tree; tree height accounts for the search row
- [X] 2.3 Implement Escape (clear term, restore, focus the tree) and a clear control; a whitespace-only term counts as no filter
- [X] 2.4 Add the calm empty-state message shown when nothing matches (FR-009); the term resets on workspace change and restart (FR-013)
- [X] 2.5 Verify: `npm run typecheck` and `npm run lint`

## Phase 3: E2E scenarios

- [X] 3.1 Write `tests/e2e/explorer-search.spec.ts`: live filtering on typing (US1); matches inside collapsed-but-loaded folders become visible with ancestors shown (FR-004; never-loaded folders are out of scope per FR-007, recorded in spec.md); a never-opened folder is not searched until loaded (FR-007); non-matching entries hidden (FR-005); folder-name match shows the folder only even when loaded (FR-006); no-match empty state that preserves expansion on clear (FR-009/FR-008); activating a match opens the file exactly as unfiltered activation does, including duplicate-tab focus (US3/FR-010); activating a matching folder focuses it like unfiltered activation, double-click collapse included (FR-011); clearing restores expansion and selection exactly (US2/FR-008); Escape clears and refocuses the tree (FR-014); create/rename/delete flows still work while filtered, with the create case made timing-proof past the tree's 500ms edit window (US3-3, R6b); the term resets on workspace change and restart (FR-013); a 5,000-entry workspace filters without perceptible lag (FR-012/SC-002)
- [X] 3.2 Build and run: `npm run test:e2e -- explorer-search`, iterate to green (11/11 passing)

## Phase 4: Full verification and archive

- [X] 4.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` — all green (383 e2e tests, 1010 unit tests)
- [X] 4.2 Append new source/test files to `scripts.format:check`; `npx prettier --check` touched files (CRLF checkout means the local check needs LF normalization; the three new files match Prettier's output)
- [X] 4.3 Archive: `git mv specs/057-explorer-file-search specs/archive/057-explorer-file-search`, set Status Archived

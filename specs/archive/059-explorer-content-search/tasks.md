# Tasks: Explorer Content Search

## Phase 1: Main-process scan and IPC (R1, R2, FR-001/002/011/012)

- [X] 1.1 Write unit tests `tests/main/search.test.ts`: case-insensitive content substring; markdown-only files; never-opened folders included; empty/whitespace term returns no matches; symlink to a file outside the root is skipped (adversarial, Principle II); oversized files skipped; unreadable dirs/files skipped; posix relative paths match the tree's id style
- [X] 1.2 Implement `src/main/fs/search.ts`: recursive root-bounded walk returning matching relative paths; `isMarkdown`-only; Dirent-based, no symlink following; 1 MB size cap; silent skip on read errors
- [X] 1.3 Add the `searchContents` named operation to `src/shared/ipc-contract.ts` and `src/preload/index.ts`; implement the handler in `src/main/ipc/handlers/search.ts` (term validated as bounded plain string, never a path; uses the validated workspace root); register it in `src/main/ipc/register.ts`
- [X] 1.4 Verify: `npm run test -- search` and `npm run typecheck`

## Phase 2: Renderer wiring (R3, R4, R5, FR-003/004/005/006/007/008/009/010)

- [X] 2.1 Write unit tests `tests/renderer/contentSearch.test.ts`: ancestor-directory derivation from a relative path; content-match id set construction; the extended predicate (editing exemption, content-match id, name match)
- [X] 2.2 Implement `src/renderer/explorer/contentSearch.ts`: pure helpers for ancestor directories and the match predicate
- [X] 2.3 Implement `src/renderer/hooks/useContentSearch.ts`: 250 ms debounce on the trimmed term, stale-response sequence guard, content-match state + settled flag, and ancestor-folder loading through the existing EXPAND actions; reset on workspace change
- [X] 2.4 Wire the hook in `App.tsx` and pass the content-match id set + settled flag to `Tree.tsx`; extend `searchMatch` and the empty-state condition there
- [X] 2.5 Verify: `npm run typecheck`, `npm run lint`, `npm run test`

## Phase 3: E2E scenarios and existing-suite adjustment (R6, US1-3, FR-001..012)

- [X] 3.1 Adjust the spec 057 FR-007 scenario in `tests/e2e/explorer-search.spec.ts` so its searched word appears in a filename but not in the content (content search now reaches never-opened folders; the fixture gains a file whose name and content differ)
- [X] 3.2 Write `tests/e2e/explorer-content-search.spec.ts`: a unique content phrase in a never-opened folder surfaces the file with ancestors (US1); filename match and content match appear together and filename matches never disappear (FR-003); a content-only match (name differs) is shown (FR-005); no match at all keeps the empty state (FR-009); opening a content-matched file and editing leaves the file byte-identical apart from the edit (FR-006, SC-004); clearing restores the tree and resets content matches (FR-007); term + content matches reset on workspace change and restart (FR-008); a common word in a generated 5,000-file workspace returns matches within a bounded wait (FR-010, SC-002); a whitespace term triggers no content search
- [X] 3.3 Build and run: `npm run test:e2e -- explorer`, iterate to green

## Phase 4: Full verification and archive

- [X] 4.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`
- [X] 4.2 Append new source/test files to `scripts.format:check`; `npx prettier --check` touched files (LF-normalized locally for the CRLF checkout)
- [X] 4.3 Archive: `git mv specs/059-explorer-content-search specs/archive/059-explorer-content-search`, set Status Archived
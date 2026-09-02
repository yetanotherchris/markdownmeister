# Tasks: New Explorer File Opens in a Tab

## Phase 1: Hook behaviour (R1, R2, FR-001/003/004/005/006/007)

- [ ] 1.1 Read the open-function signatures in `src/renderer/hooks/useDocumentSession.ts` (R2 verification obligation) and confirm the new-tab mode parameter before wiring
- [ ] 1.2 Extend the existing hook-level tests for the create/rename/cancel flow (tests/renderer/): confirming a creation commit opens the created path in a new active tab; cancellation and failed naming open nothing; folder creation opens nothing; a creation whose path is already open focuses the existing tab; a dirty neighbouring tab keeps its unsaved changes
- [ ] 1.3 Implement in `src/renderer/hooks/useWorkspaceTree.ts`: track the placeholder entry between `handleCreate` and commit/cancel; on a confirmed commit of that entry, force a new-tab open of the final path through the existing open function; ordinary renames are unaffected
- [ ] 1.4 Verify: `npm run test` (documents and workspace suites)

## Phase 2: E2E scenarios (R4)

- [ ] 2.1 Update the creation scenario in `tests/e2e/organize.spec.ts` to the new specified behaviour: the created file opens in an active tab showing an empty, clean document (deliberate expectation change, recorded in research.md R4)
- [ ] 2.2 Write `tests/e2e/new-file-tab.spec.ts`: create with a dirty active tab (new tab active, dirty tab intact and recoverable); cancel the naming input (no tab, no placeholder file); confirm an invalid name (no tab); create a file in a subfolder (the correct file from that subfolder opens); create a folder (no tab); create a file whose path is already open (existing tab focused, no duplicate); assert the untitled-document flow is unchanged, with `tests/e2e/double-click-new-tab.spec.ts` as the existing guard (FR-008)
- [ ] 2.3 Build and run: `npm run test:e2e -- organize new-file-tab`, iterate to green

## Phase 3: Full verification and archive

- [ ] 3.1 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`
- [ ] 3.2 Append touched test files to `scripts.format:check`; `npx prettier --check` touched files
- [ ] 3.3 Archive: `git mv specs/058-new-file-opens-tab specs/archive/058-new-file-opens-tab`, set Status Archived

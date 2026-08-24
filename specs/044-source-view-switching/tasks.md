# Tasks: Reliable Source View Switching

## Phase 1: Reproduction first

- [ ] 1.1 Write e2e reproduction scenarios in `tests/e2e/source.spec.ts`: typed-text-before-switch, click-at-document-end (trailing section) then immediate View source, edited round trip caret position
- [ ] 1.2 Build the unfixed app and run the reproduction scenarios; record the failures as evidence of the R2 mechanism before any production change

## Phase 2: Switch-time capture (D1, fixes FR-001/002/003)

- [ ] 2.1 Add the switch-time capture policy to `src/renderer/domain/dirty.ts` (`planSwitchCapture`) with the baseline-doc identity fast path
- [ ] 2.2 Expose `captureContentForSwitch` in `useDocumentSession.ts`; call it from `useSourceViewToggle.ts` (`handleShowSource`, `openPathInSource`) before `SET_VIEW 'source'`
- [ ] 2.3 Unit tests: `tests/renderer/domain/sourceSwitchCapture.test.ts` truth table (evicted, identity fast path with zero serialisations, drift captures, normalization tolerance, dirty-flag independence)
- [ ] 2.4 Verify: `npm run test -- sourceSwitchCapture`, then rebuild and rerun the reproduction scenarios

## Phase 3: Offset retention through refresh (D2, FR-004/005 precondition)

- [ ] 3.1 `handleRefreshFromSource` in `src/renderer/state/documents.ts` stops zeroing `cursorOffset`/`scrollTop`
- [ ] 3.2 Update `tests/renderer/documents.view.test.ts` REFRESH_FROM_SOURCE expectations from zeroing to retention
- [ ] 3.3 Verify: `npm run test -- documents.view`

## Phase 4: Throw-safe position restore (D3, FR-004/005)

- [ ] 4.1 New pure helper `src/renderer/editor/cursorRestore.ts` (`planCursorRestore`: clamp, create-or-near fallback, clamped flag)
- [ ] 4.2 `CrepeHost.applyCursorState` uses the helper; when clamped, reveal the caret via `scrollIntoView()` instead of applying the stale scrollTop
- [ ] 4.3 Unit tests: `tests/renderer/cursorRestore.test.ts` (zero offset, plain restore, out-of-range clamp, atom-node fallback)
- [ ] 4.4 Verify: `npm run test -- cursorRestore`, rerun e2e position-restore scenarios

## Phase 5: Quiet failure surface (D4, FR-006)

- [ ] 5.1 New `src/renderer/editor/EditorErrorBoundary.tsx` (quiet message + Reload that resets the boundary and reloads the document without discarding edits)
- [ ] 5.2 Wrap each document panel in `App.tsx`; guard serialisation on the toggle path in `captureContentForSwitch`
- [ ] 5.3 Minimal styles for `.editor-error`
- [ ] 5.4 Verify: `npm run typecheck`, boundary renders message on a thrown render error (unit smoke via existing patterns)

## Phase 6: Scroll-capture hygiene (D5, FR-001 responsiveness)

- [ ] 6.1 `SourceView.tsx` coalesces scroll-driven context captures through requestAnimationFrame, last value wins, final capture on cleanup
- [ ] 6.2 Verify: manual toggle + existing source e2e suite still green

## Phase 7: Full verification and archive

- [ ] 7.1 `npm run lint`, `npm run typecheck`, `npm run test`
- [ ] 7.2 Rebuild, `npx playwright test tests/e2e/source.spec.ts` fully green; rerun untouched suites if time permits
- [ ] 7.3 Append new files to `scripts.format:check`; `npx prettier --check` all touched files
- [ ] 7.4 Archive: `git mv specs/044-source-view-switching specs/archive/044-source-view-switching`, set Status Archived

# Tasks: Reliable Source View Switching

## Phase 1: Reproduction first

- [x] 1.1 Write e2e reproduction scenarios in `tests/e2e/source.spec.ts`: typed-text-before-switch, click-at-document-end (trailing section) then immediate View source, edited round trip caret position
- [x] 1.2 Build the unfixed app and run the reproduction scenarios; record the failures as evidence of the R2 mechanism before any production change

## Phase 2: Switch-time capture (D1, fixes FR-001/002/003)

- [x] 2.1 Add the switch-time capture policy to `src/renderer/domain/dirty.ts` (`planSwitchCapture`) with the baseline-doc identity fast path
- [x] 2.2 Expose `captureContentForSwitch` in `useDocumentSession.ts`; call it from `useSourceViewToggle.ts` (`handleShowSource`, `openPathInSource`) before `SET_VIEW 'source'`
- [x] 2.3 Unit tests: `tests/renderer/domain/sourceSwitchCapture.test.ts` truth table (evicted, identity fast path with zero serialisations, drift captures, normalization tolerance, dirty-flag independence)
- [x] 2.4 Verify: `npm run test -- sourceSwitchCapture`, then rebuild and rerun the reproduction scenarios

## Phase 3: Offset retention through refresh (D2, FR-004/005 precondition)

- [x] 3.1 `handleRefreshFromSource` in `src/renderer/state/documents.ts` stops zeroing `cursorOffset`/`scrollTop`
- [x] 3.2 Update `tests/renderer/documents.view.test.ts` REFRESH_FROM_SOURCE expectations from zeroing to retention
- [x] 3.3 Verify: `npm run test -- documents.view`

## Phase 4: Throw-safe position restore (D3, FR-004/005)

- [x] 4.1 New pure helper `src/renderer/editor/cursorRestore.ts` (`planCursorRestore`: clamp, create-or-near fallback, clamped flag)
- [x] 4.2 `CrepeHost.applyCursorState` uses the helper; when clamped, reveal the caret via `scrollIntoView()` instead of applying the stale scrollTop
- [x] 4.3 Unit tests: `tests/renderer/cursorRestore.test.ts` (zero offset, plain restore, out-of-range clamp, atom-node fallback)
- [x] 4.4 Verify: `npm run test -- cursorRestore`, rerun e2e position-restore scenarios

## Phase 5: Quiet failure surface (D4, FR-006)

- [x] 5.1 New `src/renderer/editor/EditorErrorBoundary.tsx` (quiet message + Reload that resets the boundary and reloads the document without discarding edits)
- [x] 5.2 Wrap each document panel in `App.tsx`; guard serialisation on the toggle path in `captureContentForSwitch`
- [x] 5.3 Minimal styles for `.editor-error`
- [x] 5.4 Verify: `npm run typecheck`; boundary render-error smoke covered by `tests/renderer/editorErrorBoundary.test.tsx`; switch-path serializer-guard smoke covered by `tests/renderer/sourceViewSerializerGuard.test.tsx`

## Phase 6: Scroll-capture hygiene (D5, FR-001 responsiveness)

- [x] 6.1 `SourceView.tsx` coalesces scroll-driven context captures through requestAnimationFrame, last value wins, final capture on cleanup
- [x] 6.2 Verify: manual toggle + existing source e2e suite still green

## Phase 7: Full verification and archive

- [x] 7.1 `npm run lint`, `npm run typecheck`, `npm run test`
- [x] 7.2 Rebuild, `npx playwright test tests/e2e/source.spec.ts` fully green; rerun untouched suites if time permits
- [x] 7.3 Append new files to `scripts.format:check`; `npx prettier --check` all touched files
- [x] 7.4 Archive: `git mv specs/044-source-view-switching specs/archive/044-source-view-switching`, set Status Archived

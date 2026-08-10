# Implementation Plan: Double-Click Open in New Tab

**Branch**: `029-double-click-new-tab` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-double-click-new-tab/spec.md`

## Summary

When "Open explorer files in a new tab" is disabled, double-clicking a file in the
explorer opens it in its own NEW tab, leaving the previously active tab and its
content untouched (FR-001/002/009). The two clicks of a double-click are treated
as ONE gesture: the first click must not apply the setting's same-tab replacement
before the double-click lands (FR-003), so the single-click open is deferred by a
500 ms window. With the setting enabled, double-clicking produces the same result
as a single click (new tab, deduped — FR-004/005). Directories expand/collapse on
double-click and never open a tab (FR-006). Single-click behaviour is unchanged
(FR-007); no-tab and read-failure edge cases keep their existing behaviour
(FR-008, spec Edge Cases).

## Technical Context

**Language/Version**: TypeScript 5.8, strict: true, across main, preload and renderer.

**Primary Dependencies**: React 19, react-arborist 3.16. No new dependencies.

**Storage**: none — session-only behaviour.

**Testing**: Vitest (the pure `resolveFileOpenGesture` decision + deferral rules);
Playwright e2e (same-tab double-click new-tab across clean/dirty/untitled/no-tab/
already-open, new-tab-mode no-change, directory toggle, single-click unchanged).

**Target Platform**: Windows, macOS, Linux desktop.

**Project Type**: Desktop application (Electron), WYSIWYG markdown editor.

**Performance Goals**: the gesture decision is a single synchronous event-handler
route; deferral is one short timer per pending single-click (no polling).

**Constraints**: Principle III — the deferred single-click open goes through the
existing live-dirty gate (`isDirtyLive`), so the deferral can never cause a dirty
tab to be replaced or discarded. The double-click window is 500 ms to guarantee
FR-003 (spec Clarification 2026-08-10).

**Scale/Scope**: one pure gesture-decision module + one row click-routing change +
one hook integration + unit/e2e coverage. No IPC, preload, or main-process change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Process Isolation Is Absolute | Renderer-only; no IPC/preload/main change | **PASS** |
| II. Every Path Is Untrusted | No path handling touched | **PASS** |
| III. Never Lose The User's Words | Deferred single-click open reuses `openFileFromExplorer`'s live-dirty gate; a double-click replaces the pending open, never the dirty tab | **PASS** |
| IV. Calm, Predictable Editing | Mouse open becomes one explicit gesture path; keyboard activation (Space) unchanged | **PASS** |
| V. Test What Can Corrupt Or Escape | The gesture decision (the FR-003 data-loss boundary) gets unit tests for every branch and an e2e suite; existing open-in-current-tab tests must keep passing | **PASS** |

**Post-design re-check**: no principle is violated.

## Phase 1 Design decisions

**Gesture detection lives in the tree row's click handler via `e.detail`.**
react-arborist's `node.handleClick` fires `select()` + `activate()` on EVERY click
(its implementation for non-multi-select trees), and our `TreeNode` adds
`onClick={node.select}` + `onDoubleClick={node.activate}`. That means today a
single click opens the file twice (select path + activate path), and a double-click
opens it three times. This is not a foundation to build deferral on. Instead, the
row click handler for FILE nodes is replaced with a single gesture router that
calls `node.select()` (selection unchanged) and then, on `e.detail >= 2`, routes to
a NEW `onFileOpen(node, 'double-click')` prop; on `e.detail === 1` it routes to
`onFileOpen(node, 'single-click')`. The `e.detail` counter is native browser
double-click detection (OS double-click time), so no custom timing logic is needed
to decide "this click is the second of a double-click". Directory rows keep
`node.handleClick` and add `onDoubleClick={() => node.toggle()}` so expand/collapse
works (US3, Clarification 2026-08-10).

**The deferral is in `useWorkspaceTree`, keyed by file path.** `handleFileOpen`
receives the gesture:
- `double-click` → cancel any pending deferred open for that file, then
  `openFileFromExplorer(file, /* explicitNew */ true)` — reuses the spec-024
  explicit-new-tab path (middle-click), which also dedupes already-open files.
- `single-click`:
  - `fileOpenBehavior === 'new-tab'`, or no active tab, or dirty active, or file
    already open → open immediately. In every such case a double-click on the same
    file produces the same tab result (new tab / dedupe), so no deferral is needed
    (US2, FR-008/009/005).
  - `same-tab` with a CLEAN active tab and the file not open (i.e. the click would
    REPLACE) → defer by 500 ms, remembering the path and the active tab id. This is
    exactly the case FR-003 protects: without deferral, the first click of a
    double-click would already replace the tab. A double-click for the SAME file
    before the timer fires cancels it; a timer for a different file is left alone
    (each pending single-click commits independently).
  The deferred commit uses the normal `openFileFromExplorer` (no explicitNew), so
  the same-tab replace-clean-live behaviour (spec 024) is preserved. If the user
  switched to a different tab during the window, the commit opens a NEW tab instead
  of clobbering the tab they moved to (spec Edge Cases).

**`handleTreeSelect` stops opening files; the row gesture becomes the single open
path for files.** `handleTreeSelect` keeps only the `SELECT` dispatch (highlighting),
so the row gesture router is the sole mouse open path for file nodes and the
deferral cannot be bypassed by a second open call. `handleTreeActivate` stays for
keyboard Space activation (unchanged, immediate, respects the setting).

## Project Structure

### Documentation (this feature)

```text
specs/029-double-click-new-tab/
├── spec.md              # Requirements
├── plan.md              # This file
├── research.md          # R1…R3 decisions
├── data-model.md        # Gesture decision entity
├── quickstart.md        # Manual verification script
├── contracts/
│   └── file-open-gesture.md  # onFileOpen gesture contract + decision table
└── tasks.md             # (/speckit.tasks)
```

### Source Code (repository root)

```text
src/renderer/explorer/openGesture.ts  # NEW: pure resolveFileOpenGesture + DOUBLE_CLICK_WINDOW_MS
src/renderer/explorer/Tree.tsx        # row click → onFileOpen gesture; dir onDoubleClick → toggle
src/renderer/hooks/useWorkspaceTree.ts# NEW handleFileOpen (deferral) + handleTreeSelect slim
src/renderer/App.tsx                  # onFileOpen wiring
tests/renderer/openGesture.test.ts    # NEW: gesture decision matrix
tests/e2e/double-click-new-tab.spec.ts# NEW: e2e acceptance scenarios
```

**Structure decision**: the pure gesture decision is a leaf module (unit-testable,
no React); the row owns gesture detection; the hook owns timing/deferral and routes
into the existing session open gate.

## Phase status

- Phase 1: Foundational — `openGesture.ts` pure decision + `onFileOpen` prop plumbing
- Phase 2: US1 — same-tab double-click new tab (clean/dirty/untitled/no-tab/already-open)
- Phase 3: US2 — new-tab users see no change (double-click dedupes)
- Phase 4: US3 — directory double-click expand/collapse, never opens a tab
- Phase 5: Verification — unit + e2e
- Phase 6: Polish — gates, spec archive, status table

## Deferred / later features

- Configurable double-click window (fixed at 500 ms for now — spec Clarification)
- A distinct "double-click opens new tab" indicator/cursor (not specified)

## Complexity tracking

None — no principle violated.

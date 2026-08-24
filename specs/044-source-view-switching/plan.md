# Implementation Plan: Reliable Source View Switching

**Branch**: `spec-044-source-view-switching` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/044-source-view-switching/spec.md`

## Summary

The freeze on entering the source view is a store/editor divergence: edits made within a 200 ms listener debounce window (typically a trailing section inserted by clicking at the document end) are dropped by the lock that source view applies, so every subsequent toggle forces a full editor teardown, re-parse, and deferred destroy whose cost stacks until the renderer wedges; the same drop silently discards the user's just-typed text. The fix captures live editor bytes synchronously at switch time so divergence cannot occur, keeps caret and scroll offsets across the content-refresh path instead of zeroing them, makes position restoration throw-safe with scroll-into-view for clamped positions, coalesces per-frame scroll dispatches from the source view, and guards the specific exception sites on the switch path with one error boundary so a failure leaves a usable surface and a quiet message.

## Technical Context

**Language/Version**: TypeScript 5.8 strict (Electron main untouched; all changes in the renderer bundle)

**Primary Dependencies**: None new. Reuses the existing document store actions, editor instance pool, cursor-state capture/restore plumbing, and React.

**Storage**: No new persisted state. Cursor/scroll offsets already persist in the in-memory per-document state (`documents.ts:379-390`); this plan only stops erasing them.

**Testing**: Vitest unit tests for the capture policy, reducer offset retention, and the clamp/near helper; Playwright e2e against the real built app extending `tests/e2e/source.spec.ts`, including a reproduction script that must fail before the fix and pass after.

**Target Platform**: Windows/macOS/Linux desktop, identical behaviour.

**Performance Goals**: Switch latency stays flat across repeated toggles (SC-003); no serialisation of an unchanged document on switch entry beyond one cheap identity check.

**Constraints**: Constitution III (no silent text loss), IV (calm editing: quiet errors, preserved context), V (tests for the dirty/drop behaviour). Renderer stays sandboxed; no preload or IPC surface changes.

**Scale/Scope**: About 5 edited renderer modules, 1 small new component (error boundary), 2-3 new/updated unit suites, 1 extended e2e suite. No packaging, IPC, or spec-archaeology changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after design: renderer-only change, no new privileged surface.*

| Principle | Impact |
|-----------|--------|
| I. Process Isolation Is Absolute | Untouched - no Node/fs/Electron usage added to the renderer; no new channels |
| II. Every Path Is Untrusted | Untouched - no filesystem paths involved in the switch flow |
| III. Never Lose The User's Words | Strengthened - FR-003 closes the silent-drop window (research R2) where freshly typed text never reached the store; existing dirty guards unchanged |
| IV. Calm, Predictable Editing | Direct target - switches stop hanging (FR-001/002), position is restored (FR-004/005), failures become quiet and recoverable (FR-006) |
| V. Test What Can Corrupt Or Escape | Honoured - the drop window is exactly a data-corruption case: unit tests for the capture policy plus e2e reproduction scripts are mandatory gate items |

All gates pass. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/044-source-view-switching/
├── spec.md        # WHAT/WHY (this feature's contract)
├── plan.md        # This file
└── research.md    # Phase 0 output: R1-R6 findings with evidence
```

### Source Code (repository root)

```text
src/renderer/
├── hooks/
│   ├── useSourceViewToggle.ts   # EDIT: synchronous live-content capture before SET_VIEW 'source'
│   └── useDocumentSession.ts    # EDIT: expose capture-for-switch helper alongside flushLiveContent
├── domain/
│   └── dirty.ts                 # EDIT: switch-time capture policy (identity fast path, else UPDATE_CONTENT payload)
├── editor/
│   ├── CrepeHost.tsx            # EDIT: throw-safe selection restore + scroll-into-view when clamped
│   ├── SourceView.tsx           # EDIT: rAF-coalesced scroll capture
│   └── EditorErrorBoundary.tsx  # NEW: minimal boundary around the editor host subtree
├── chrome/
│   └── App.tsx                  # EDIT: wrap DocumentHost output in the boundary
└── state/
    └── documents.ts             # EDIT: REFRESH_FROM_SOURCE retains cursorOffset/scrollTop
tests/
├── renderer/
│   ├── documents.view.test.ts       # EDIT: refresh retains offsets (was zeroes)
│   └── domain/sourceSwitchCapture.test.ts  # NEW: capture policy truth table
└── e2e/
    └── source.spec.ts               # EDIT: reproduction, rapid-toggle, position-restore scenarios
```

**Structure Decision**: All changes stay inside the established renderer layout (hooks orchestrate, domain holds pure policy, editor owns surfaces, state owns the reducer). The error boundary lives beside the editor components it shields.

## Key Design Decisions

Full evidence in [research.md](research.md).

- **D1 Capture at switch time (fixes the freeze and the drop)**: entering the source view reads the mounted editor's current markdown synchronously and dispatches UPDATE_CONTENT only when it differs from stored bytes (identity fast path first). The debounced emission and its lock become harmless because the store already holds the latest bytes before the lock engages.
- **D2 Keep offsets through refresh**: REFRESH_FROM_SOURCE stops zeroing `cursorOffset`/`scrollTop`; restoration then flows through the existing `applyCursorState` path after the keyed remount. Deliberate behavioural change to a tested invariant, recorded here and in the spec.
- **D3 Throw-safe restoration**: replace the bare `TextSelection.create` with a resolve-and-near fallback so a stale offset inside a non-text location clamps instead of throwing; when the offset was clamped (content changed), reveal the caret via scroll-into-view instead of applying the stale scrollTop.
- **D4 Quiet failure surface**: one error boundary around the editor host renders a quiet inline message offering Reload for the affected tab; exception sites on the toggle path (serialisation, selection) are individually guarded so the boundary remains a last resort.
- **D5 Scroll-capture hygiene**: the source view's scroll listener coalesces through requestAnimationFrame, keeping last-value-wins semantics while removing a whole-app re-render per frame.

## Complexity Tracking

> No constitution violations. The notable rejected alternative: replaying locked emissions after unlock (keeps two racing sources of truth) and injecting content into surviving editor instances (unsupported API, re-decided with evidence during spec 001). Both recorded in research R2/R6.

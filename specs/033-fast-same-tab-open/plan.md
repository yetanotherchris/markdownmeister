# Implementation Plan: Fast Same-Tab Document Open

**Branch**: `phase-33-fast-same-tab-open` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/033-fast-same-tab-open/spec.md`

## Summary

Bring same-tab document opens under the 250 ms p95 target by removing redundant whole-document work from the open path: skip the second full parse at editor creation when the syntax pipeline already matches, prove outgoing-tab cleanliness without re-serializing untouched documents via a document-identity fast path, and defer the initial spellcheck pass off the presentation path. The staged-replacement transition model, dirty protection, fresh undo history, and all security boundaries are unchanged.

## Technical Context

**Language/Version**: TypeScript 5.8, React 19.2, Electron 43, Node 22

**Primary Dependencies**: `@milkdown/crepe` 7.21, React, Vitest, Playwright

**Storage**: None new; existing in-memory document session state (per-document baseline, pool entries)

**Testing**: Vitest unit/reducer tests; Playwright Electron end-to-end tests including a timing harness for SC-001/SC-004 and instrumentation counters for SC-002/SC-003

**Target Platform**: Desktop Electron application (Windows/macOS/Linux)

**Project Type**: Desktop application

**Performance Goals**: Same-tab open presents an interactive editor within 250 ms p95 for documents up to 10,000 lines (SC-001); exactly one full parse of incoming content per open (SC-002); at most one full serialization of incoming content per open (SC-003); linear scaling within 20% overhead at 10× size (SC-004)

**Constraints**: No new IPC channels, filesystem access, or preload API surface. Dirty-state decisions must remain exact — the fast path may only skip *proving* cleanliness when document identity proves no edit occurred; it must never widen what counts as clean. Fresh undo history per opened document is preserved (no cross-document editor reuse).

**Scale/Scope**: Renderer-only changes across the editor mount path (`CrepeHost`, `markdownSyntaxRuntime`, `spellcheckPlugin`), the session orchestration (`useDocumentSession`, `useFileOpenGesture`), the instance pool, and the documents reducer.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — see post-design notes below.*

| Principle | Plan response | Status |
|-----------|---------------|--------|
| Process Isolation Is Absolute | All changes are renderer-internal. No IPC, preload, or Node access changes. Instrumentation counters live in renderer memory only. | PASS |
| Every Path Is Untrusted | No path handling, validation, or file-read behaviour changes. | PASS |
| Never Lose The User's Words | The doc-identity fast path only skips serialization when the ProseMirror document object is reference-identical to the one captured at baseline — meaning no doc-changing transaction occurred. Any edit falls back to the exact live check. Pre-commit dirty re-check remains in place. | PASS |
| Calm, Predictable Editing | The feature's entire purpose is faster, calmer opens. Deferred spellcheck marks are sanctioned by spec assumption; marks arrive moments after presentation. Skipping the no-op re-parse also removes a spurious undo-history entry created at mount today. | PASS |
| Test What Can Corrupt Or Escape | New Vitest tests cover the fast-path correctness (edit-since-baseline must serialize), the options-equality guard (off/on toggle round-trip), and round-trip byte-equality of default vs swapped pipelines. E2E covers timing targets and existing acceptance scenarios. | PASS |

**Post-design re-check**: PASS. Phase 1 design introduced no IPC surface, no path handling, and no save-semantics changes. The only data-model additions are renderer-memory fields (applied-options map, recorded document identity, instrumentation counters) documented in [data-model.md](./data-model.md).

## Project Structure

### Documentation (this feature)

```text
specs/033-fast-same-tab-open/
├── plan.md              # This file
├── research.md          # Phase 0 output: evidence-backed decisions R1–R6
├── data-model.md        # Phase 1 output: state touched by this feature
├── contracts/
│   └── open-performance.md  # Internal renderer contracts
├── quickstart.md        # Phase 1 output: validation guide
└── tasks.md             # Phase 2 output (/speckit.tasks) — not yet created
```

### Source Code (repository root)

```text
src/renderer/
├── editor/
│   ├── CrepeHost.tsx               # Mount path: baseline capture, ready signal
│   ├── markdownSyntaxRuntime.ts    # Skip no-op reconfigure (parse #2 removal)
│   ├── markdownSyntaxOptions.ts    # Options equality helper
│   ├── instancePool.ts             # Pool entry gains recorded doc identity
│   ├── spellcheckPlugin.ts         # Defer initial whole-doc pass
│   └── openPerformance.ts          # NEW: instrumentation counters
├── domain/
│   └── dirty.ts                    # Doc-identity fast path in isDirtyLive
├── hooks/
│   ├── useDocumentSession.ts       # Wire fast path through open/commit gates
│   └── useFileOpenGesture.ts       # Gesture-time dirty check uses fast path
└── state/
    └── documents.ts                # Record doc identity at baseline capture

tests/
├── renderer/                       # Unit tests for guards, fast path, equality
└── e2e/open-performance.spec.ts    # NEW: SC-001..SC-004 timing + counters
```

**Structure Decision**: Existing single-project Electron layout; all work stays in the renderer tree plus its test directories. No new top-level structure.

## Design Decisions

- **Skip the no-op re-parse at create** (R1): track the syntax options applied to each editor in a module-level WeakMap; freshly mounted editors default to the stock defaults. When requested options equal applied options, run only the input-rule gate update and skip the parser/serializer swap and `replaceAll`. This removes the second full parse and the spurious mount-time undo entry.
- **Doc-identity fast path for outgoing dirty checks** (R2): record the ProseMirror `doc` object reference when a baseline is captured. If the live view's `doc` is reference-identical, no doc-changing transaction has occurred, so the document is exactly at baseline — clean with zero serializations. Any difference falls back to the existing full `getMarkdown()` comparison. Never widens dirtiness; closes the Principle III race exactly as today.
- **Keep exactly one incoming serialization** (R3): the baseline capture remains the single full serialization of incoming content per open. Deriving the baseline from raw disk text was evaluated and rejected (R3) — it resurrects the spec-002 false-dirty bug for files needing normalization (`-`→`*` bullets, autolinks, entities).
- **Defer the initial spellcheck pass** (R4): schedule the first whole-document pass via idle callback with a timeout bound, cancelled on destroy; incremental re-checks and the correction menu are unaffected.
- **Instrumentation counters** (R5): a small renderer-module counter records parses, serializations, and open durations per open, exposed to e2e tests through the page context without touching the preload API.
- **Timing harness** (R6): e2e measures open duration from the moment the open gesture commits (post double-click window) to editor-ready, aggregating p95 across runs against generated documents up to 10,000 lines.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

None. All five principles pass without deviation.

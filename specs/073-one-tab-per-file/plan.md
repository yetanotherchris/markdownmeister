# Implementation Plan: One Tab Per File

**Branch**: `spec-073-one-tab-per-file` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/073-one-tab-per-file/spec.md`

## Summary

Make every open tab carry the file's real identity, produced by the main process, and use that identity to decide whether an open request names an already-open file. The current renderer compares workspace-relative path strings, so a file opened before its folder has `path: null` while the same file opened from the explorer has a relative path, and `a.md` and `A.md` remain different strings on a case-insensitive filesystem. Both cases create a second tab and can silently overwrite the first tab's unsaved edits. The fix supplies the resolved real path as the existing `canonicalPath` field on every file read, replaces the path-only check with an identity-first comparison, and leaves save, close, quit, folder-switch, and external-change behaviour unchanged. This fixes F1 and F3 from the exploratory report, not F2 or F4.

## Technical Context

**Language/Version**: TypeScript 5.8 with `strict`, Node.js 22, Electron 43, React 19.

**Primary Dependencies**: Electron, React, electron-vite, Vitest, Playwright. No new runtime or development dependency is needed.

**Storage**: The filesystem is the only persistent store. Document state, including the identity string, stays in renderer memory for the session. No database, cache file, or migration is involved.

**Testing**: Vitest unit tests for the main-process identity helper, the `file:read` response, the pure comparison, and reducer behaviour. Playwright end-to-end tests run against the built Electron application. The Linux Docker e2e image is used for CI parity.

**Target Platform**: Desktop application on Windows, macOS, and Linux.

**Project Type**: Desktop application with main, preload, and renderer processes.

**Performance Goals**: At most one extra realpath resolution per `file:read`. The Open File, Save As, and opened-file write routes already resolve the path and reuse the same helper. No identity work on the keystroke path. The comparison scans the open tabs once per open request. No perceptible change to open latency.

**Constraints**: All path resolution stays in main. The renderer keeps no Node.js or filesystem access. The preload surface stays a fixed list of named operations with no generic `invoke`. No new prompt, confirmation, or message is introduced. Atomic saves are untouched. Spec 024 replacement behaviour is unchanged. Folder-switch tab handling and external rename or delete handling remain out of scope.

**Scale/Scope**: One workspace at a time, typically dozens of open tabs. Identity values are short absolute path strings held only in memory.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle or constraint | Gate | How the design satisfies it |
|--------------------------|------|-----------------------------|
| I. Process Isolation Is Absolute | PASS | The identity is computed in the main process. The renderer only compares the strings it already receives in `OpenedFile`. No preload operation, channel, or generic escape hatch is added. The renderer still has no `fs`, Node, or Electron module. |
| II. Every Path Is Untrusted | PASS | `file:read` still resolves and validates the workspace-relative path before reading. The identity is derived from that already-validated resolved path. The identity feature adds no renderer-initiated read or write through it. The existing `file:writeOpened` use for outside-folder saves is unchanged and keeps its main-side allowlist. Error redaction is unchanged. |
| III. Never Lose The User's Words | PASS | The change only decides whether an open request activates an existing tab. It does not change save, Save As, close, or quit. Activating a tab leaves its content, baseline, dirty flag, and undo history untouched. The fix removes a path where two tabs could overwrite each other. |
| IV. Calm, Predictable Editing | PASS | There is no new UI, dialog, focus change, or reflow. Identity comparison is synchronous and runs only when a file is opened. No disk or parse work is added to typing. Spec 024 replacement still decides between replace and new tab for files that are not already open. |
| V. Test What Can Corrupt Or Escape | PASS | Unit tests cover the identity comparison, all route shapes, the missing-identity fallback, case variants, and Save As. Main-process tests cover identity production and path containment. Playwright e2e covers F1, S3, F3, H12, H13, the H8 boundary, and the Save As identity transition. Existing path-containment and save tests stay in place. |
| Technology Constraints | PASS | TypeScript strict stays on. No `any` is added at the IPC boundary. No dependency is added. The preload API is not widened. |
| Development Workflow | PASS | The work follows the spec, plan, tasks, implement sequence. The only structural change, extracting the existing canonical-path helper into its own main module, is kept separate from the behavioural changes. No principle is violated, so Complexity Tracking stays empty. |

Re-check after Phase 1 design: all gates still pass. The design adds one main-process helper, one renderer comparison helper, and one field value on an existing payload. It adds no process boundary and no security-relevant access path.

## Project Structure

### Documentation (this feature)

```text
specs/073-one-tab-per-file/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── renderer.md      # Phase 1 output (/speckit.plan command)
├── checklists/
│   └── requirements.md  # Existing specification-quality checklist
└── spec.md              # Feature specification
```

`tasks.md` is created later by `/speckit.tasks` and is not part of this plan.

### Source Code (repository root)

```text
src/
├── main/
│   ├── fs/
│   │   ├── identity.ts            # New: canonicalPath, the single identity producer
│   │   ├── read.ts                # Changed: readFile returns canonicalPath
│   │   ├── paths.ts               # Unchanged: containment rules
│   │   └── write.ts               # Unchanged: atomic writes
│   ├── ipc/
│   │   └── handlers/
│   │       ├── context.ts         # Changed: uses and re-exports canonicalPath; openFileFromPath
│   │       ├── files.ts           # Unchanged channel surface; file:read now carries identity
│   │       └── recent.ts          # Unchanged; inherits openFileFromPath identity
│   └── osOpenHost.ts              # Unchanged; inherits openFileFromPath identity
├── preload/
│   └── index.ts                   # Unchanged: fixed named operations, no generic invoke
├── renderer/
│   ├── domain/
│   │   └── fileIdentity.ts        # New: sameFile comparison
│   ├── state/
│   │   └── documents.ts           # Changed: handleOpenExisting, handleReroutePaths
│   └── hooks/
│       ├── useDocumentSession.ts  # Changed: openWithDecision pre-check
│       ├── useFileOpenGesture.ts  # Changed: deferral heuristic uses sameFile
│       └── useSourceViewToggle.ts # Changed: context-menu opens resolve identity first
└── shared/
    └── ipc-contract.ts            # Unchanged shape; documents the canonicalPath guarantee

tests/
├── main/
│   ├── identity.test.ts           # New: native realpath, fallback, case behaviour
│   └── read.test.ts               # New: readFile returns canonicalPath
├── renderer/
│   ├── fileIdentity.test.ts       # New: comparison truth table
│   └── documents.identity.test.ts # New: route shapes, Save As, rename, spec 024
└── e2e/
    └── one-tab-per-file.spec.ts   # New: F1, S3, F3, H12, H13, H8, Save As
```

Existing tests that must keep passing unchanged include `tests/renderer/documents.open-replace.test.ts`, `tests/renderer/documents.os-open.test.ts`, `tests/renderer/documents.save.test.ts`, `tests/e2e/tabs.spec.ts`, `tests/e2e/open-in-current-tab.spec.ts`, and `tests/e2e/file-association.spec.ts`.

**Structure Decision**: The repository is a single Electron application. The feature stays inside the existing main, preload, renderer, shared, and tests directories. It adds one main-process helper module and one renderer domain module, and changes existing open and read paths. No new package, process, or build target is introduced.

## Design Overview

The identity is the existing `canonicalPath` value. Main computes it once from the resolved real path and returns it on every route that produces an `OpenedFile`, including `file:read`, which previously omitted it. The renderer compares identities first. If both documents have an identity, exact identity equality is the answer, and different identities are never the same file even when their relative paths match. If either side lacks an identity, the comparison falls back to exact workspace-relative path equality only when both paths are non-null. A null path never matches a relative path. Two documents with no path and no identity are never the same file.

The reducer's `handleOpenExisting` is the authoritative dedupe point. Every route that opens a file already funnels into `OPEN_EXISTING`: the menu Open File command, recent items, operating-system opens, explorer clicks, search results, new-tab actions, created-file opens, and the source-view context menu. `openWithDecision` uses the same comparison for its pre-check that decides whether the active tab may be replaced. The explorer gesture uses the comparison only for its deferral heuristic; the actual open still goes through `file:read` and the reducer, so the gesture cannot activate the wrong file.

Save As already replaces the tab's `canonicalPath` through `SAVE_SUCCESS`. After Save As, the tab represents the chosen file, and opening that file activates it. The old file is no longer represented by that tab and opens normally. Plain saves keep the identity. An in-app rename or move clears the affected document's identity, because the old absolute path no longer names the file; the next open of the moved file supplies the new identity and backfills it. Folder switching, external change routing, and Save As onto an already-open file are explicitly outside this feature; their current behaviour is preserved or recorded as a limitation.

## Implementation Sequence

1. Structural change: move the existing `canonicalPath` function from `src/main/ipc/handlers/context.ts` to `src/main/fs/identity.ts`, re-export it from `context.ts` for existing callers, and keep the implementation unchanged. This commit changes structure only and all tests stay green.
2. Main identity: switch `canonicalPath` to `fs.realpathSync.native` with the defined `fs.realpathSync` and `path.resolve` fallbacks. Add `canonicalPath` to `readFile` in `src/main/fs/read.ts`. Keep `openFileFromPath` and `saveFileDialog` producing identity through the same helper.
3. Renderer comparison: add `sameFile` in `src/renderer/domain/fileIdentity.ts` and use it in `handleOpenExisting` and `openWithDecision`. Backfill a missing identity when an existing tab is activated; never change its path or content.
4. Remaining open sites: use `sameFile` in the explorer gesture's deferral check. Change `openPathInSource` and `openPathInFormatted` to resolve the requested path through `file:read` first, then compare identities while preserving the existing live-editor view-switch lifecycle.
5. Lifecycle: clear `canonicalPath` in `handleReroutePaths` and in `handleUpdatePath` when a path changes. Keep `handleSaveSuccess` as the identity update point for Save As.
6. Tests: add the unit, main-process, and e2e coverage listed in Project Structure, then run the affected suites and the full e2e suite.
7. Verification: run the checks in `quickstart.md` on the local platform and, when Docker is available, in the Linux e2e image.

## Complexity Tracking

No constitution violations. No entry is required. The design adds no dependency, process boundary, generic preload operation, or save, close, or quit behaviour change.
